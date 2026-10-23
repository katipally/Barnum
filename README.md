# Agentic CMO

A CMO agent that lives in Snowflake. One orchestrator manages one isolated agent per marketing channel: Google Ads, LinkedIn Ads, billboards, outbound email, SEO and GEO. Each channel agent reads its own raw platform export and reports what it actually measures. Where channels share a funnel (MQL, SQL, cost per SQL, CAC) the CMO compares them on it, writes decision memos, and plans next year in the CFO's language. A channel that does not measure a stage reports NULL, never zero.

Built on Snowflake Cortex Agents, Cortex Analyst, `AI_COMPLETE` and Claude.

```
 FRONTEND --REST + SSE--> FASTAPI BACKEND --PAT--> SNOWFLAKE (CMO_DB)
                             |
       deterministic routes  |-- SQL --------------------> CORE views + procs
       /now/review           |-- parallel Agent Run -----> CH_GOOGLE.AGENT  CH_LINKEDIN.AGENT ...
                             |-- stream ----------------> CORE.CMO_AGENT (synthesizes the memo)
       channel onboarding    |-- stage / AI_COMPLETE ---> CH_<X> schema per channel

 CORE        CHANNEL_REGISTRY  FUNNEL_FACT (union of active MAP views)  MQL_TO_SQL_RATE
             ASSUMPTIONS  ALLOCATION  DECISION_LOG  MAPPING_HISTORY  FUNNEL_SV  CMO_AGENT
 CH_<X>      UPLOADS stage  RAW_* tables  MAP view  SV  REPORT()  RECONCILE()  AGENT
```

- **Isolation.** Each channel has its own schema, raw tables, semantic view and agent. A channel agent's tools touch only its schema. The CMO reads only `CORE`.
- **Numbers vs words.** Every number comes from SQL or a stored procedure. Claude plans, delegates, explains and writes memos. Every deterministic API response carries the SQL behind it.
- **Plugins.** A new channel is an API call and a CSV. No CMO code changes.
- **Frontend.** The Next.js app in `frontend/` talks to this API through `CMO_API_URL` (see `frontend/README.md`).

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
uv run python -m seed.load_real ../test-data   # the 6 real exports (kept outside the repo) through the plugin path
uv run uvicorn backend.app.main:app --port 8000
```

Environment: `CMO_CONNECTION` (default `hackathon`), `CMO_WAREHOUSE` (`CMO_WH`), `CMO_MODEL` (CMO agent), `CMO_CHANNEL_MODEL` (channel agents), `CMO_MAPPER_MODEL` (mapping). All three model variables default to `claude-opus-5-5`. Cross-region inference must reach the chosen model.

Real exports are messy, so every upload passes through a normalizer: any encoding or BOM, comma or tab, report preambles, `1,129.58`, `6.65%`, mixed date formats. Column headers become SQL-safe names.

## Add a channel with your own data

```bash
B=http://127.0.0.1:8000
curl -X POST $B/channels -H 'content-type: application/json' -d '{
  "channel_id": "webinars", "display_name": "Webinars", "plan_usd": 8000,
  "window_start": "2026-01-01", "window_end": "2026-06-30",
  "description": "One row per session with platform and promo cost; qualified_leads are MQLs, sales_accepted are SQLs."}'
curl -X POST "$B/channels/webinars/files" -F files=@my_webinars.csv     # repeatable; ?replace=true to swap
curl -X POST $B/channels/webinars/mapping/propose                       # Claude writes, validator checks
curl -X POST $B/channels/webinars/mapping/approve                       # provisions the agent stack, goes live
```

What happens:

1. **Upload.** The CSV is normalized, staged in `@CH_<X>.UPLOADS`, then `INFER_SCHEMA` creates `RAW_<file>` (numbers at full precision). Re-uploads append, and new columns are added.
2. **Propose.** `AI_COMPLETE` returns a structured mapping: `select_sql`, `raw_spend_sql`, `measures` (which funnel fields this channel really has), `grain`, `window_start` / `window_end`, native `metrics` notes and assumptions. Fields the data cannot show stay NULL. Pass `{"feedback": "..."}` to steer it, or submit a hand-written mapping (`seed/mappings/`).
3. **Validate.** Every mapping must pass these checks:
   - `select_sql` is read-only and runs, with no null dates or campaigns
   - native metrics are numeric
   - fields declared not measured are NULL, never 0
   - MQLs ≥ SQLs
   - mapped spend equals raw spend within $1
   - rows fall inside the declared window

   Failures go back to Claude, up to 3 attempts.
4. **Approve.** One template (`templates/channel.sql.j2`) creates the `MAP` view, semantic view, `REPORT()`, `RECONCILE()` and the channel `AGENT`. It then registers the channel, sets its data window from the mapping, and rebuilds `FUNNEL_FACT`. A later upload that changes columns sets the channel to `needs_mapping`.

`POST /channels/{id}/pause` and `/resume` take a channel out of, or back into, the funnel and the CMO fan-out.

**FUNNEL contract.** Every mapping produces one row per date and campaign with these columns: `date, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd, creative_text, audience, metrics`. `metrics` holds the channel's additive native counts (clicks, opens, replies, ai_mentions...). `channel` is set by the platform. NULL means not measured and is excluded from sums and ratios, never counted as 0.

## API

| Route | What |
|---|---|
| `GET /now/strip` | measured spend, annual run rate, cost per MQL / SQL, CAC (media and fully loaded), payback, projected SQLs, MQL→SQL rate and its source |
| `GET /now/channels` | per channel: data window, what it measures, spend, MQL, SQL (and whether estimated), $/MQL, $/SQL, annual run rate, marginal $/SQL, native metrics |
| `GET /channels/{id}/campaigns` | campaign breakdown with creative and audience |
| `POST /now/review` | **SSE**: strip, parallel channel reports, reallocation memo, CMO memo |
| `POST /now/reallocate` | deterministic reallocation memo, no LLM |
| `GET /plan/current` | planned vs current annual spend per budget channel |
| `GET /plan/scenarios?budget=&rule=12mo\|3yr` | optimal split, unallocated budget, customers, ARR, avg and last-customer CAC, payback, year-1 and 3-year net, scale ceiling, scenario table |
| `GET /memos?status=`, `POST /memos/{id}/approve\|reject` | decision log. Approving updates `ALLOCATION` |
| `POST /ask` | **SSE**: free-form question to the CMO, which delegates via `ask_channel` |
| `GET /assumptions`, `PUT /assumptions/{key}` | every non-measured number (ACV, margin, win rate, curve exponents, scale cap...) |
| `POST /decisions/reset` | clears decisions and approved plans; uploaded data is untouched |

SSE events: `strip`, `delegation {channel, state, text, seconds}`, `memo`, `status`, `tool {name, input}`, `cmo_delta {text}` (the CMO's answer; narration before a tool call is dropped), `done`, `error`.

## The model

- **Estimated SQLs.** Google, LinkedIn and billboards measure MQLs but not SQLs. Their SQLs are MQLs × the `MQL_TO_SQL_OVERRIDE` assumption (default 0.15), flagged `sqls_estimated`. Set that key to NULL to learn the rate from channels that measure both stages (today only outbound, which gives 0.895). Outbound keeps its measured SQLs.
- **Run rates.** Each channel is annualized from its own data window (`CHANNEL_REGISTRY.window_start` / `window_end`, set by the approved mapping). A `flight` channel such as billboards is a one-off test, so its actual spend is the run rate, not scaled up.
- **Reallocation.** Each budget channel's response is `SQLs = S·(y/X)^b`, with `X` and `S` the annual spend and SQLs. `PROPOSE_REALLOCATION` allocates greedily over a max-heap: O((B/step)·log C), optimal because b < 1 makes every curve concave. Moves under `AUTONOMY_LIMIT_PCT` auto-apply. Bigger moves wait for approval.
- **Annual plan.** `UNIT_ECON(budget, rule)` uses the same curves on annualized run rates, with floors from `MIN_SHARE:<channel>`. No channel is allocated more than `SCALE_CAP_X` (default 3) times its run rate, because the curves are only trusted near observed spend. Budget that does not fit is reported as `unallocated_usd`, not forced in. Last-customer CAC = marginal $/SQL ÷ win rate + sales cost. The ceiling is the largest budget that fits under the caps and whose last customer still pays back: one year of gross profit (`12mo`) or three (`3yr`). `ceiling_limited_by` says which stopped it (`cac` or `scale_cap`).
- **Not budget-bought.** Outbound, SEO and GEO have no spend. They are reported on their own native outcomes and are never allocated budget.
- **Assumptions.** ACV, margin, win rate and sales cost in `ASSUMPTIONS` are placeholders. Swap them via `PUT /assumptions/{key}` before showing anyone outside the team.

## Use it from Claude

`sql/50_mcp.sql` exposes the CMO agent and the funnel through the Snowflake-managed MCP server:

```
https://<account-host>/api/v2/databases/CMO_DB/schemas/CORE/mcp-servers/CMO_MCP
```

Add it to Claude Desktop or Claude.ai as a custom connector. For OAuth, use a security integration with a PUBLIC client type; see the Snowflake-managed MCP server docs.

## Tests

```bash
uv run pytest tests -q     # measured values checked against the real exports in ../test-data, against the live CMO_DB
tests/smoke.sh 3           # full flow 3 times in a row against a running API (resets decisions)
```

## Layout

```
sql/              00_setup  10_core  20_unit_econ  30_decisions  40_cmo_agent  50_mcp
templates/        channel.sql.j2 (one channel's full stack)  cmo_agent.sql.j2
backend/app/      main.py  orchestrator.py  queries.py  snowflake.py  setup.py
backend/app/channels/  ingest.py  mapping.py  provision.py
seed/             load_real.py  mappings/ (hand-written channel mappings)
frontend/         Next.js app, connects through CMO_API_URL
tests/            test_numbers.py  smoke.sh
docs/DESIGN.md    design doc
```

## License

MIT
