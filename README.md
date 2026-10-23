# Agentic CMO

A CMO agent that lives in Snowflake. One orchestrator manages one isolated agent per marketing channel: Google Ads, LinkedIn Ads, billboards, outbound email, email reply threads, conferences, SEO and GEO. Each channel agent reads its own raw platform export and reports what it actually measures. Where channels share a funnel (MQL, SQL, cost per SQL, CAC) the CMO compares them on it, writes decision memos, and plans next year in the CFO's language. A channel that does not measure a stage reports NULL, never zero.

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

```
 you ---> Next.js (3000) ---> FastAPI (8000) ---PAT---> Snowflake CMO_DB
                                                         |- CMO_AGENT (Cortex Agent, Claude)
 Claude Desktop ---OAuth---> managed MCP server ---------|- CH_<X>.AGENT per channel
                                                         '- Cortex Analyst semantic views

 steps:  1 Snowflake prerequisites -> 2 connections.toml -> 3 install + setup
         -> 4 add a channel (needs data) -> 5 API + frontend -> 6 Ask the CMO
```

The repo ships no data. Setup builds an empty CMO, and the numbers appear after you add at least one channel in step 4.

You need Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 20+, and a Snowflake account with Cortex Agents and the Claude models available. You do not need Cortex Code (the `coco` CLI); it was only used to build this repo.

### 1. Snowflake prerequisites

Run once as `ACCOUNTADMIN`. Use your own user name and a role name you like:

```sql
USE ROLE ACCOUNTADMIN;
CREATE ROLE IF NOT EXISTS CMO_ROLE;
GRANT CREATE DATABASE  ON ACCOUNT TO ROLE CMO_ROLE;
GRANT CREATE WAREHOUSE ON ACCOUNT TO ROLE CMO_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER       TO ROLE CMO_ROLE;   -- AI_COMPLETE, Analyst
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_AGENT_USER TO ROLE CMO_ROLE;   -- create and run agents
GRANT ROLE CMO_ROLE TO USER <YOU>;

-- Claude runs through cross-region inference unless your region hosts it.
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';       -- or a narrower scope, e.g. 'AWS_US'
```

If your account restricts models, `claude-opus-5-5` (or whatever you set in the env table below) must be allowed. Check `SHOW PARAMETERS LIKE 'CORTEX_MODELS_ALLOWLIST' IN ACCOUNT`.

Create a programmatic access token (PAT) for the API calls and the connector. The secret is shown once:

```sql
ALTER USER <YOU> ADD PROGRAMMATIC ACCESS TOKEN CMO_PAT
  ROLE_RESTRICTION = 'CMO_ROLE' DAYS_TO_EXPIRY = 30;
```

PATs need a network policy. For a person user, the token is created without one but only authenticates once the user is under a network policy. Attach one that allows your IP, or follow the bypass options in the [PAT docs](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens):

```sql
CREATE NETWORK RULE <DB>.<SCHEMA>.CMO_IPS TYPE = IPV4 MODE = INGRESS VALUE_LIST = ('<YOUR_IP>/32');
CREATE NETWORK POLICY CMO_POLICY ALLOWED_NETWORK_RULE_LIST = ('<DB>.<SCHEMA>.CMO_IPS');
ALTER USER <YOU> SET NETWORK_POLICY = CMO_POLICY;
```

Setup itself creates `CMO_DB` and an XSMALL `CMO_WH` (auto-suspend 60s).

### 2. Connection profile

`~/.snowflake/connections.toml` (keep it out of git; `connections.toml` is ignored here):

```toml
[cmo]
account = "ORG-ACCOUNT"      # org-account form. For other URLs add: host = "<full host>"
user = "<YOU>"               # the LOGIN_NAME
authenticator = "PROGRAMMATIC_ACCESS_TOKEN"
token = "<pat secret>"
role = "CMO_ROLE"
```

The backend reads the profile named by `CMO_CONNECTION` (default `hackathon`), so either name yours `hackathon` or `export CMO_CONNECTION=cmo`. The same `token` calls the Agent Run REST API at `https://<account host>/api/v2`, so key-pair or browser auth will not work for the agents. `warehouse` in the profile is optional; the backend switches to `CMO_WH` once it exists.

### 3. Install and set up

```bash
git clone https://github.com/katipally/Barnum.git && cd Barnum
uv sync
export CMO_CONNECTION=cmo
uv run python -m backend.app.setup     # runs sql/*.sql, deploys CMO_AGENT and the MCP server. Idempotent.
```

### 4. Add your first channel

Use any CSV export. Messy files are fine (see below). The `description` is the main hint Claude gets, so say what one row is and which columns are leads, qualified leads and cost.

```bash
uv run uvicorn backend.app.main:app --port 8000      # leave running; use a second shell for the rest
B=http://127.0.0.1:8000
curl -X POST $B/channels -H 'content-type: application/json' -d '{"channel_id":"webinars","display_name":"Webinars","plan_usd":8000,"window_start":"2026-01-01","window_end":"2026-06-30","description":"One row per session with cost; qualified_leads are MQLs, sales_accepted are SQLs."}'
curl -X POST "$B/channels/webinars/files" -F files=@my_webinars.csv
curl -X POST $B/channels/webinars/mapping/propose
curl -X POST $B/channels/webinars/mapping/approve
```

Expected CSV shape: one header row, one table per file, any encoding, comma or tab. Spend, leads and qualified leads columns are optional; a channel that lacks one reports NULL for it. More detail in "Add a channel with your own data" below.

`uv run python -m seed.load_real <dir>` is not a sample loader. It replays the author's eight private exports by file name (Google Ads, LinkedIn Ads, billboards, outbound email, SEO, GEO, conferences, reply threads). Copy a `CHANNELS` entry in `seed/load_real.py` if you want a scripted version for your own files.

### 5. Start the frontend

```bash
cd frontend
cp .env.example .env.local     # set CMO_API_COMPANY_ID / NAME to anything you like, e.g. acme / "Acme Inc"
npm install
npm run dev                    # http://localhost:3000/?company=<CMO_API_COMPANY_ID>
```

Without `CMO_PROVIDER=cmo-api` the app shows only mock sample companies.

### 6. Ask the CMO

Open `/?company=<id>`, press Ask the CMO and try "Which channel has the lowest cost per SQL?". Or call the API: `curl -N -X POST $B/ask -H 'content-type: application/json' -d '{"question":"Where does the quarter stand?"}'`.

### Backend environment (all optional)

| Variable | Default | Effect |
|---|---|---|
| `CMO_CONNECTION` | `hackathon` | profile in `connections.toml` |
| `SNOWFLAKE_HOME` | `~/.snowflake` | folder holding `connections.toml` |
| `CMO_WAREHOUSE` | `CMO_WH` | warehouse the backend and agent tools use |
| `CMO_MODEL` | `claude-opus-5-5` | CMO agent, read by `python -m backend.app.setup` |
| `CMO_CHANNEL_MODEL` | `claude-opus-5-5` | channel agents, read at approve time |
| `CMO_MAPPER_MODEL` | `claude-opus-5-5` | `AI_COMPLETE` mapping proposals |
| `CMO_MAPPER_FALLBACK` | `claude-opus-4-5` | tried if the mapper model fails; empty disables |
| `CMO_CACHE_TTL_S` | `300` | seconds the API caches read queries |

The frontend variables are in `frontend/.env.example` and `frontend/README.md`.

### Claude Desktop (optional)

`sql/50_mcp.sql` creates the managed MCP server `CMO_DB.CORE.CMO_MCP` (the CMO agent plus the funnel semantic view). To connect Claude Desktop or Claude.ai, create an OAuth integration for a role that can use the agent (the role that ran setup owns everything), as in the [Snowflake MCP docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp):

```sql
CREATE SECURITY INTEGRATION CMO_MCP_OAUTH TYPE = OAUTH OAUTH_CLIENT = CUSTOM ENABLED = TRUE
  OAUTH_CLIENT_TYPE = 'PUBLIC' OAUTH_REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback'
  OAUTH_USE_SECONDARY_ROLES = NONE ALLOWED_ROLES_LIST = ('CMO_ROLE');   -- needs CREATE INTEGRATION
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('CMO_MCP_OAUTH');                 -- client id
```

Then Settings, Connectors, Add custom connector, with the URL `https://<account-host>/api/v2/databases/CMO_DB/schemas/CORE/mcp-servers/CMO_MCP` and the client id. Use hyphens, not underscores, in the host. The user also needs a default role and default warehouse.

### Troubleshooting

| Symptom | Fix |
|---|---|
| model not available, or `AI_COMPLETE` / agent deploy fails on the model | Set `CORTEX_ENABLED_CROSS_REGION`, check the allowlist, or point `CMO_MODEL`, `CMO_CHANNEL_MODEL`, `CMO_MAPPER_MODEL` at a Claude model your account lists |
| `PAT_INVALID` or network policy errors | The user needs a network policy that includes your IP (or a bypass), and `token` must be the PAT secret, not its name |
| connection profile 'hackathon' not found | Profile name mismatch: set `CMO_CONNECTION` |
| 401 from Agent Run but SQL works | Profile is not PAT auth, or `account` does not give the right host: add `host` |
| first answer takes 20 to 60 seconds | Cold `CMO_WH`, agent warm-up and the fan-out to channel agents. Later reads hit the cache |
| UI shows no live company | `CMO_PROVIDER=cmo-api`, `CMO_API_URL` reachable, and `?company=` equals `CMO_API_COMPANY_ID` |

## Add a channel with your own data

Quickstart step 4 has the four calls. Real exports are messy, so every upload passes through a normalizer: any encoding or BOM, comma or tab, report preambles, `1,129.58`, `6.65%`, mixed date formats. Column headers become SQL-safe names. `POST /channels/{id}/files?replace=true` swaps a file.

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
| `POST /plan/2027` | **SSE**: 2027 plan. Body `{budget_usd, revenue_target_usd, sqls_per_quarter, brand_pct}`. Numbers first (`plan`), then the CMO's verdict and actions per channel (`channel_plan`), `targets`, `cmo_delta`, `done {plan_id}` |
| `GET /plan/2027/latest` | the last saved 2027 plan, or `null` |
| `POST /campaigns/draft`, `GET /campaigns?channel_id=` | campaign draft stub built from a saved plan; nothing is sent to an ad platform |
| `POST /ask` | **SSE**: free-form question to the CMO, which delegates via `ask_channel` |
| `GET /assumptions`, `PUT /assumptions/{key}` | every non-measured number (ACV, margin, win rate, curve exponents, scale cap...) |
| `POST /decisions/reset` | clears decisions and approved plans; uploaded data is untouched |

SSE events: `strip`, `delegation {channel, state, text, seconds}`, `memo`, `status`, `tool {name, input}`, `cmo_delta {text}` (the CMO's answer; narration before a tool call is dropped), `done`, `error`.

## 2027 Plan

Inputs (defaults seeded in `ASSUMPTIONS`, editable with `PUT /assumptions/{key}`): marketing budget (`PLAN_2027_BUDGET_USD`), revenue target (`REVENUE_TARGET_USD`), SQLs per quarter (`SQL_TARGET_PER_QUARTER`) and the brand and awareness share of the budget (`BRAND_PCT`).

Outputs: a budget per channel, projected SQLs, customers and new ARR against the targets, the budget the targets would need, and per channel a verdict (start, scale, optimize, maintain, cut) with campaign actions.

How the CMO delegates. `POST /plan/2027` first calls `CORE.PLAN_2027`, which is deterministic and returns in seconds, so budgets render at once. Then `CMO_AGENT` calls its `plan_2027` tool and `ask_channel` for every channel in parallel, each channel agent judging its own data at its proposed budget. The CMO returns verdicts and actions as JSON; numbers are never taken from the model. If the agent fails or omits a channel, deterministic actions fill in (`source: "fallback"`). Runs are saved in `PLAN_RUNS`.

Allocation (`sql/25_plan_2027.sql`, same response curves as `UNIT_ECON`):
- **brand**: channels with awareness metrics (`PLAN_AWARENESS_METRICS`) and no SQL cost curve, plus one-off flights such as billboards. They share `BRAND_PCT × budget` pro rata to current spend; a brand channel with no spend counts as the average spend-bearing one.
- **unpriced**: outcomes but no spend data (outbound, conferences, email threads). Each gets a test budget of `max(PLAN_TEST_BUDGET_USD, PLAN_TEST_PCT × budget)` (together at most half of what remains after brand) and keeps its run-rate SQLs.
- **performance**: the rest, greedy on marginal SQLs per dollar. Spend beyond `SCALE_CAP_X` times a channel's run rate is extrapolated on its curve and flagged as `beyond_proven_range_usd`, not dropped. Once the next dollar would return less than a dollar of ARR, the remainder is `exploratory_overflow_usd` shared by the unpriced channels.

Every dollar of the budget is placed, so `allocated_usd` equals the budget and more budget always means more spend on a channel.

Campaigns are a stub: `POST /campaigns/draft {plan_id, channel_id}` writes a draft brief (name, objective, budget, KPIs, steps) to `CAMPAIGN_DRAFTS`. Full contract: `docs/PLAN_2027_CONTRACT.md`.

Existing deployment: rerun `uv run python -m backend.app.setup` (idempotent). It creates `PLAN_RUNS` and `CAMPAIGN_DRAFTS`, seeds the inputs, creates `PLAN_2027` and redeploys `CMO_AGENT` with the `plan_2027` tool.

## The model

- **Estimated SQLs.** Google, LinkedIn, billboards and conferences measure MQLs but not SQLs. Their SQLs are MQLs × the `MQL_TO_SQL_OVERRIDE` assumption (default 0.15), flagged `sqls_estimated`. Set that key to NULL to learn the rate from channels that measure both stages (today only outbound, which gives 0.895). Outbound keeps its measured SQLs.
- **Run rates.** Each channel is annualized from its own data window (`CHANNEL_REGISTRY.window_start` / `window_end`, set by the approved mapping). A `flight` channel such as billboards is a one-off test, so its actual spend is the run rate, not scaled up.
- **Reallocation.** Each budget channel's response is `SQLs = S·(y/X)^b`, with `X` and `S` the annual spend and SQLs. `PROPOSE_REALLOCATION` allocates greedily over a max-heap: O((B/step)·log C), optimal because b < 1 makes every curve concave. Moves under `AUTONOMY_LIMIT_PCT` auto-apply. Bigger moves wait for approval.
- **Annual plan.** `UNIT_ECON(budget, rule)` uses the same curves on annualized run rates, with floors from `MIN_SHARE:<channel>`. No channel is allocated more than `SCALE_CAP_X` (default 3) times its run rate, because the curves are only trusted near observed spend. Budget that does not fit is reported as `unallocated_usd`, not forced in. Last-customer CAC = marginal $/SQL ÷ win rate + sales cost. The ceiling is the largest budget that fits under the caps and whose last customer still pays back: one year of gross profit (`12mo`) or three (`3yr`). `ceiling_limited_by` says which stopped it (`cac` or `scale_cap`).
- **Not budget-bought.** Outbound, email reply threads, conferences, SEO and GEO have no spend (conferences have no booth cost in the export). They are reported on their own native outcomes and are never allocated budget.
- **Assumptions.** ACV, margin, win rate and sales cost in `ASSUMPTIONS` are placeholders. Swap them via `PUT /assumptions/{key}` before showing anyone outside the team.

## Tests

```bash
uv run pytest tests -q     # measured values from the author's private exports; skipped unless those 8 channels are active in CMO_DB
tests/smoke.sh 3           # full flow 3 times in a row against a running API (resets decisions)
```

## Layout

```
sql/              00_setup  10_core  20_unit_econ  25_plan_2027  30_decisions  40_cmo_agent  50_mcp
templates/        channel.sql.j2 (one channel's full stack)  cmo_agent.sql.j2
backend/app/      main.py  orchestrator.py  queries.py  plan.py  snowflake.py  setup.py
backend/app/channels/  ingest.py  mapping.py  provision.py
seed/             load_real.py  mappings/ (hand-written channel mappings)
frontend/         Next.js app, connects through CMO_API_URL
tests/            test_numbers.py  smoke.sh
docs/DESIGN.md    design doc
```

## License

MIT
