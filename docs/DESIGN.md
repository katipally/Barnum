
# Agentic CMO: Build Design Doc

## 1. What we build
A CMO orchestrator agent that runs in Snowflake. It manages one isolated agent per marketing channel (Google Ads, LinkedIn Ads, billboards, outbound email, SEO, GEO). Every channel agent turns its own raw export into the shared funnel (MQL, then SQL, then won) for the stages it actually measures. NULL means not measured, never zero. Where spend exists the CMO decides on cost per SQL, CAC and payback; channels without spend are judged on their native outcomes. You manage it like an executive: it proposes memos, and you approve or reject them.

```
          CEO / Head of Marketing
                   |  Approve / Reject / Ask
          +--------v---------+
          |  CMO ORCHESTRATOR |  judges on $/SQL, CAC, payback
          +--+----+----+----+-+
             |    |    |    |     delegates, never reads raw data
          [GOOG][LNKD][OOH][MAIL][SEO][GEO] [+ any channel you upload]
             |    |    |    |
          own raw data, own schema, own tools
```

## 2. Hackathon toolkit used (from the Technical Resources Guide)
| Guide dimension | Feature | Our use |
|---|---|---|
| Surface | Cortex Agents | 1 CMO agent + N channel agents, all on Claude |
| Surface | CoWork | CMO agent shows up in CoWork for business users (free extra demo surface) |
| Context | Stage + COPY / INFER_SCHEMA | normalized CSV upload per channel |
| Context | Semantic views | one per channel (raw) + one FUNNEL view (CMO) |
| Toolkit | Cortex Analyst | text-to-SQL inside each agent |
| Toolkit | Cortex Search | text columns (ad copy, event notes, survey verbatims) |
| Toolkit | Custom tools (procs) | REPORT, RECONCILE, UNIT_ECON, PROPOSE/APPLY memo |
| Toolkit | Code execution tool | charts and scratch math in the CMO agent |
| Intelligence | AI_COMPLETE + structured outputs | Claude writes each channel's raw-to-funnel mapping |
| Intelligence | AI Gateway (Anthropic Messages API) | backend calls Claude directly when needed, same PAT |
| Intelligence | Cross-region inference | already ANY_REGION, so the newest Claude models are reachable |
| Action | Agent Run API + threads | backend runs agents, streams to the UI |
| Action | Managed MCP server | expose the CMO agent to Claude Desktop (we already have CLAUDE_MCP_OAUTH) |
| Cross-cut | Agent monitoring | traces of every delegation for the demo |
| Cross-cut | Agent evaluations | golden questions ("cost per SQL for conferences?") |
| Cross-cut | PAT auth, RBAC, Guardrails | one credential, role-scoped, prompt-injection protection |

Account check (done): ATTENDEE_ROLE has CORTEX_USER, CREATE DATABASE, ROLE, WAREHOUSE and INTEGRATION. The AI Gateway is live.

## 3. Architecture
```
 FRONTEND (your mock)  --REST + SSE-->  FASTAPI BACKEND  --PAT-->  SNOWFLAKE
                                         |
   deterministic routes  ----SQL-------->|  /now/strip /now/channels /plan/scenarios
   agent routes   --Agent Run API (parallel)--> channel agents --> CMO agent
   onboarding     --stage/AI_COMPLETE/DDL-----> CH_<X> schema
 ------------------------------------------------------------------------
 CMO_DB
  CORE       CHANNEL_REGISTRY  FUNNEL_FACT(view)  MQL_TO_SQL_RATE  ASSUMPTIONS
             ALLOCATION  DECISION_LOG  MAPPING_HISTORY  FUNNEL_SV  CMO_AGENT
  CH_GOOGLE  UPLOADS(stage) RAW_* MAP(view) SV REPORT RECONCILE AGENT
  CH_LINKEDIN ...same shape...
  CH_<ANY>   ...created by the API...
```
**Hybrid orchestration:** the backend reads the registry and calls every active channel agent in parallel, so latency is the slowest agent, not the sum. It streams each report onto the canvas, then the CMO agent synthesizes. The CMO also keeps wrapper-proc tools to ask a channel a follow-up question in chat. That path needs SQL AGENT_RUN to work, and step 0 checks it.

## 4. The channel plugin (the part you'll use the most)
```
 1 CREATE  POST /channels {name, description, mql_rule?, sql_rule?, window?}
           -> schema CH_<X>, stage, registry row  status=draft
 2 UPLOAD  POST /channels/x/files  (CSV, repeatable, many files)
           -> normalize (encoding, delimiter, preambles, "1,129.58", "6.65%", dates)
           -> PUT @CH_X.UPLOADS -> INFER_SCHEMA -> RAW_<file> (create or append)
 3 PROFILE columns, types, non-null counts, example values
 4 PROPOSE AI_COMPLETE(claude, schema+samples+contract+rules, structured JSON)
           -> {select_sql, raw_spend_sql, measures, grain, window, metric_notes, assumptions}
           or a hand-written mapping (seed/mappings/<channel>.sql)
 5 VALIDATE runs | no null dates/campaigns | metrics numeric | unmeasured is NULL, not 0
           | mqls >= sqls | spend(raw)==spend(map) to $1 | rows inside window
           fail -> error fed back to Claude, retry up to 3x
 6 APPROVE human clicks once (UI shows SQL + diffs)
           -> CREATE VIEW MAP, semantic view, procs, CREATE AGENT (template)
           -> registry status=active, window set from the mapping, CALL CORE.REBUILD_FUNNEL()
 7 LIVE    CMO fan-out now includes it. Zero code change.
 re-upload, same columns -> append, MAP still valid
 re-upload, new columns  -> status=needs_mapping, back to step 4
```
**FUNNEL contract** (the only output every mapping must produce): `date, channel, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd, creative_text, audience, metrics`. Every funnel field is nullable. `metrics` is an object of additive native counts (clicks, opens, replies, ai_mentions...) kept per row. Rates are always derived from summed numerators and denominators.

**Estimated SQLs.** A channel with MQLs but no SQLs gets `sqls = mqls x MQL_TO_SQL_OVERRIDE` (default 0.15) and `sqls_estimated = true`. With the key set to NULL the rate is learned from channels that measure both stages.

**Shared MQL definition** (stored in ASSUMPTIONS and editable): F2000 healthcare or finance, Director or above, one real action. A channel can override it with its own `mql_rule` text, which goes into the mapping prompt.

**One agent template** (`templates/channel.sql.j2`): an instruction block with the channel description and what it does and does not measure, and tools for Analyst on its own semantic view (funnel, native metrics, raw tables), REPORT and RECONCILE.

## 5. The CMO brain
- **Deterministic numbers:** FUNNEL_FACT plus the `UNIT_ECON(budget, rule)` Python proc. Each budget-bought channel gets a diminishing-returns curve (`SQLs = S·(y/X)^b`) anchored on its annualized run rate; a `flight` channel is not annualized because it is a one-off test. Budget is allocated greedily with a max-heap in $10k steps, which is O((B/step)·log C) and optimal because the curves are concave. No channel gets more than `SCALE_CAP_X` (default 3) times its run rate; what does not fit is returned as `unallocated_usd`. The proc returns the PRD scenario table: SQL, customers, ARR, average and last-customer CAC, payback, year-1 and 3-year net. ACV, margin, win rate and sales cost come from ASSUMPTIONS, which you'll swap for real Datasaur values.
- **Autonomy:** moves under the limit (default 10%) are auto-applied and logged. Bigger moves become memos with `status=pending`.
- **Memo schema:** id, title, finding, evidence_sql, recommendation, delta_by_channel, impact (SQL before and after), status.
- **CMO agent tools:** funnel Analyst, status, list_channels, UNIT_ECON, PROPOSE_REALLOCATION (only on an explicit reallocation or memo request), ASK_CHANNEL(name, question), charts.

## 6. Backend API
| Route | Kind | Returns |
|---|---|---|
| GET /channels, POST /channels, POST /channels/{id}/files | onboarding | registry, profile |
| POST /channels/{id}/mapping/propose, /approve | onboarding | SQL, validation report |
| GET /now/strip, /now/channels | SQL | headline KPIs, per-channel cards, each with `sql` |
| POST /now/reallocate | SQL proc | deterministic reallocation memo |
| GET /plan/current, /plan/scenarios?budget&rule | SQL proc | plan vs run rate, split + unallocated + scenario rows |
| POST /now/review, /ask | SSE | delegation events, cmo text, memo |
| GET /memos, POST /memos/{id}/approve or reject | SQL | updates ALLOCATION, DECISION_LOG |
| GET /assumptions, PUT /assumptions/{key} | SQL | every non-measured number |

**Stack:** Python 3.12, FastAPI, snowflake-connector-python (PAT), httpx (Agent Run SSE), jinja2, pydantic. Credentials come from the existing `~/.snowflake/connections.toml` PAT connection, so no secret lives in the repo.

## 7. Repo layout
```
CMO-Agent/
  docs/DESIGN.md
  sql/        00_setup  10_core  20_unit_econ  30_decisions  40_cmo_agent  50_mcp
  templates/  channel.sql.j2 (MAP, semantic view, REPORT, RECONCILE, AGENT)  cmo_agent.sql.j2
  backend/app/ main.py orchestrator.py queries.py snowflake.py setup.py
               channels/ ingest.py (upload + profile) mapping.py (propose + validate) provision.py
  seed/       load_real.py (loads ../test-data, kept outside the repo)  mappings/ (hand-written)
  frontend/   Next.js app, connects through CMO_API_URL
  tests/  test_numbers.py  smoke.sh
```

## 8. Build order (5 hours, demo freeze at 4:15)
0. **Spike, 20m:** Agent Run REST with a PAT, SQL AGENT_RUN signature, AI_COMPLETE structured JSON.
1. **Core, 40m:** setup SQL, CORE tables, ASSUMPTIONS, REBUILD_FUNNEL.
2. **Plugin engine, 70m:** ingest, profile, mapper, validator, provision, plus routes.
3. **Load via the plugin, 30m:** the 6 real exports uploaded through the API, then reconciled and checked against independent pandas counts.
4. **CMO, 50m:** UNIT_ECON, memos, CMO agent, orchestrator SSE.
5. **P1, 30m:** a channel added live, MCP server for the CMO agent, a few eval questions.
6. **Hardening, 20m:** smoke script passes 3 times in a row, README.

## 9. Verification
- Every channel's RECONCILE shows zero diff.
- Measured values match the real exports (spend, MQLs, SQLs, native metrics), and unmeasured fields are NULL, never 0.
- Estimated SQLs are flagged and use the `MQL_TO_SQL_OVERRIDE` rate.
- UNIT_ECON never allocates a channel past its scale cap and reports the rest as unallocated.
- A channel added through the API alone appears in /now/channels and the CMO fan-out.
- Smoke script passes 3 times in a row.

## 10. Risks
- **SQL AGENT_RUN fails:** the CMO drill-down goes through the backend tool instead. Fan-out is unaffected.
- **Claude writes a bad mapping:** the validator plus retries catch it, and the human approves before anything goes live.
- **No CRM, so SQLs are estimated:** the MQL-to-SQL rate is an assumption. It is flagged everywhere and changed in one place.
- **Placeholder economics:** ACV, margin, win rate and sales cost live in ASSUMPTIONS until real values replace them.

## Critical Files
- `backend/app/channels/mapping.py`: how a new dataset becomes funnel rows, and the validator
- `templates/channel.sql.j2`: every subagent comes from this
- `sql/00_setup.sql`: registry-driven FUNNEL_FACT and the SQL estimate
- `backend/app/orchestrator.py`: parallel fan-out and SSE
- `sql/20_unit_econ.sql`: the annual plan math
