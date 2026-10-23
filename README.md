# Agentic CMO

A CMO agent that lives in Snowflake. One orchestrator manages one isolated agent per marketing channel. Each channel agent reads its own raw platform data and reports in one currency: MQL, SQL, cost per SQL, CAC. The CMO compares channels on that funnel, writes decision memos, and plans next year in the CFO's language.

Built on Snowflake Cortex Agents, Cortex Analyst, `AI_COMPLETE` and Claude.

```
 FRONTEND --REST + SSE--> FASTAPI BACKEND --PAT--> SNOWFLAKE (CMO_DB)
                             |
       deterministic routes  |-- SQL --------------------> CORE views + procs
       /q4/review            |-- parallel Agent Run -----> CH_GOOGLE.AGENT  CH_LINKEDIN.AGENT ...
                             |-- stream ----------------> CORE.CMO_AGENT (synthesizes the memo)
       channel onboarding    |-- stage / AI_COMPLETE ---> CH_<X> schema per channel

 CORE        CHANNEL_REGISTRY  FUNNEL_FACT (union of active MAP views)  RAW_CRM_LEADS
             ASSUMPTIONS  ALLOCATION  DECISION_LOG  MAPPING_HISTORY  FUNNEL_SV  CMO_AGENT
 CH_<X>      UPLOADS stage  RAW_* tables  MAP view  SV  REPORT()  RECONCILE()  AGENT
```

- **Isolation.** Each channel has its own schema, raw tables, semantic view and agent. A channel agent's tools touch only its schema. The CMO reads only `CORE`.
- **Numbers vs words.** Every number comes from SQL or a stored procedure. Claude plans, delegates, explains and writes memos. Every deterministic API response carries the SQL behind it.
- **Plugins.** A new channel is an API call and a CSV. No CMO code changes.

## Quickstart

Requires Python 3.12, [uv](https://docs.astral.sh/uv/), and a Snowflake connection in `~/.snowflake/connections.toml` using a programmatic access token:

```toml
[hackathon]
account = "ORG-ACCOUNT"
user = "YOU"
authenticator = "PROGRAMMATIC_ACCESS_TOKEN"
token = "<pat>"
role = "YOUR_ROLE"        # needs SNOWFLAKE.CORTEX_USER, CREATE DATABASE, CREATE WAREHOUSE
warehouse = "YOUR_WH"
```

```bash
uv sync
uv run python -m backend.app.setup        # CMO_DB, CMO_WH, core SQL, CMO agent (idempotent)
uv run python seed/generate.py            # demo CSVs in each platform's native shape
uv run python -m seed.load                # CRM + 4 channels through the plugin path
uv run uvicorn backend.app.main:app --port 8000
```

Environment: `CMO_CONNECTION` (default `hackathon`), `CMO_WAREHOUSE` (`CMO_WH`), `CMO_MODEL` (CMO agent), `CMO_CHANNEL_MODEL` (channel agents), `CMO_MAPPER_MODEL` (mapping). All three model variables default to `claude-sonnet-4-5`. Cross-region inference must reach the chosen model.

## Add a channel with your own data

```bash
B=http://127.0.0.1:8000
curl -X POST $B/channels -H 'content-type: application/json' -d '{
  "channel_id": "webinars", "display_name": "Webinars", "plan_usd": 8000,
  "description": "One row per session with platform and promo cost; qualified_leads are MQLs, sales_accepted are SQLs."}'
curl -X POST "$B/channels/webinars/files" -F files=@my_webinars.csv     # repeatable; ?replace=true to swap
curl -X POST $B/channels/webinars/mapping/propose                       # Claude writes, validator checks
curl -X POST $B/channels/webinars/mapping/approve                       # provisions the agent stack, goes live
```

What happens:

1. **Upload.** The CSV goes to `@CH_<X>.UPLOADS`, then `INFER_SCHEMA` creates `RAW_<file>` (numbers at full precision). Re-uploads append, and new columns are added.
2. **Outcome mode.** It is auto-detected. In **SELF** mode, the file already has SQL or won columns. In **CRM** mode, Claude joins to `CORE.RAW_CRM_LEADS` (upload with `POST /crm/files`) on whatever keys exist: utm fields, creative id, email, landing URL, event name.
3. **Propose.** `AI_COMPLETE` returns a structured mapping: `select_sql`, `raw_spend_sql`, `crm_mql_sql`, notes and assumptions. Pass `{"feedback": "..."}` to steer it.
4. **Validate.** Every mapping must pass these checks:
   - all three SQLs are read-only, and `select_sql` runs
   - no null dates or campaigns
   - MQLs ≥ SQLs ≥ won
   - mapped spend equals raw spend within $1
   - in CRM mode, MQLs equal the CRM count

   Failures go back to Claude, up to 3 attempts.
5. **Approve.** One template (`templates/channel.sql.j2`) creates the `MAP` view, semantic view, `REPORT()`, `RECONCILE()` and the channel `AGENT`. It then registers the channel and rebuilds `FUNNEL_FACT`. A later upload that changes columns sets the channel to `needs_mapping`.

`POST /channels/{id}/pause` and `/resume` take a channel out of, or back into, the funnel and the CMO fan-out.

**FUNNEL contract.** Every mapping produces one row per date and campaign with these columns: `date, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd, creative_text, audience`. `channel` is set by the platform.

## API

| Route | What |
|---|---|
| `GET /q4/strip` | budget left, cost per MQL / SQL, CAC (media and fully loaded), payback, projected SQLs |
| `GET /q4/channels` | per channel: spend vs plan, MQL, SQL, $/MQL, $/SQL, MQL→SQL, marginal $/SQL, projected SQLs |
| `GET /channels/{id}/campaigns` | campaign breakdown with creative and audience |
| `POST /q4/review` | **SSE**: strip, parallel channel reports, reallocation memo, CMO memo |
| `POST /q4/reallocate` | deterministic reallocation memo, no LLM |
| `GET /plan/scenarios?budget=&rule=12mo\|3yr` | optimal split, customers, ARR, avg and last-customer CAC, payback, year-1 and 3-year net, scale ceiling, scenario table |
| `GET /memos?status=`, `POST /memos/{id}/approve\|reject` | decision log. Approving updates `ALLOCATION` |
| `POST /ask` | **SSE**: free-form question to the CMO, which delegates via `ask_channel` |
| `POST /simulate?days=14` | appends telemetry in raw platform formats |
| `GET /assumptions`, `PUT /assumptions/{key}` | every non-measured number (ACV, margin, win rate, curve exponents...) |
| `POST /demo/reset` | clears decisions and restores the seed |

SSE events: `strip`, `delegation {channel, state, text, seconds}`, `memo`, `status`, `tool {name, input}` (includes chart specs from `data_to_chart`), `cmo_delta {text}`, `done`, `error`.

## The model

- **Q4.** Each channel's remaining-budget response is `SQLs = S·(y/X)^b`, with `X` and `S` the spend and SQLs so far. `PROPOSE_REALLOCATION` allocates the remaining budget greedily over a max-heap: O((B/step)·log C), optimal because b < 1 makes every curve concave. Moves under `AUTONOMY_LIMIT_PCT` auto-apply. Bigger moves wait for approval.
- **Annual plan.** `UNIT_ECON(budget, rule)` uses the same curves on annualized run rates, with floors from `MIN_SHARE:<channel>`. Last-customer CAC = marginal $/SQL ÷ win rate + sales cost. The ceiling is the largest budget whose last customer still pays back: one year of gross profit (`12mo`) or three (`3yr`). Under `3yr`, `cac_bound: false` means CAC is no longer the limit; sales capacity and market size are.
- **Assumptions.** All numbers in `seed/` and `ASSUMPTIONS` are demo values for Datasaur Foundry. Swap them via `PUT /assumptions/{key}` before showing anyone outside the team.

## Use it from Claude

`sql/50_mcp.sql` exposes the CMO agent and the funnel through the Snowflake-managed MCP server:

```
https://<account-host>/api/v2/databases/CMO_DB/schemas/CORE/mcp-servers/CMO_MCP
```

Add it to Claude Desktop or Claude.ai as a custom connector. For OAuth, use a security integration with a PUBLIC client type; see the Snowflake-managed MCP server docs.

## Tests

```bash
uv run pytest tests -q     # numbers the demo depends on, against the live CMO_DB
tests/smoke.sh 3           # full demo flow 3 times in a row against a running API
```

## Layout

```
sql/              00_setup  10_core  20_unit_econ  30_decisions  40_cmo_agent  50_mcp
templates/        channel.sql.j2 (one channel's full stack)  cmo_agent.sql.j2
backend/app/      main.py  orchestrator.py  queries.py  simulate.py  snowflake.py  setup.py
backend/app/channels/  ingest.py  mapping.py  provision.py
seed/             generate.py  load.py  csv/
tests/            test_numbers.py  smoke.sh
docs/DESIGN.md    design doc
```

## License

MIT
