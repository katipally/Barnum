
# Agentic CMO: Build Design Doc

## 1. What we build
A CMO orchestrator agent that runs in Snowflake. It manages one isolated agent per marketing channel. Every channel agent turns its own raw data into one common currency (MQL, then SQL, then won), and the CMO decides on cost per SQL, CAC and payback. You manage it like an executive: it proposes memos, and you approve or reject them.

```
          CEO / Head of Marketing
                   |  Approve / Reject / Ask
          +--------v---------+
          |  CMO ORCHESTRATOR |  judges on $/SQL, CAC, payback
          +--+----+----+----+-+
             |    |    |    |     delegates, never reads raw data
          [GOOG][LNKD][OOH][EVNT] [+ any channel you upload]
             |    |    |    |
          own raw data, own schema, own tools
```

## 2. Hackathon toolkit used (from the Technical Resources Guide)
| Guide dimension | Feature | Our use |
|---|---|---|
| Surface | Cortex Agents | 1 CMO agent + N channel agents, all on Claude |
| Surface | CoWork | CMO agent shows up in CoWork for business users (free extra demo surface) |
| Context | Stage + COPY / INFER_SCHEMA | CSV upload per channel |
| Context | Semantic views | one per channel (raw) + one FUNNEL view (CMO) |
| Toolkit | Cortex Analyst | text-to-SQL inside each agent |
| Toolkit | Cortex Search | text columns (ad copy, event notes, survey verbatims) |
| Toolkit | Custom tools (procs) | RECONCILE, MARGINAL_CPS, UNIT_ECON, PROPOSE/APPROVE memo |
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
   deterministic routes  ----SQL-------->|  /q4/strip /q4/channels /plan/scenarios
   agent routes   --Agent Run API (parallel)--> channel agents --> CMO agent
   onboarding     --stage/AI_COMPLETE/DDL-----> CH_<X> schema
 ------------------------------------------------------------------------
 CMO_DB
  CORE       CHANNEL_REGISTRY  FUNNEL_FACT(view)  CRM_LEADS  ASSUMPTIONS
             ALLOCATION  DECISION_LOG  MAPPING_HISTORY  FUNNEL_SV  CMO_AGENT
  CH_GOOGLE  UPLOADS(stage) RAW_* MAP(view) SV RECONCILE MARGINAL_CPS AGENT
  CH_LINKEDIN ...same shape...
  CH_<ANY>   ...created by the API...
```
**Hybrid orchestration:** the backend reads the registry and calls every active channel agent in parallel, so latency is the slowest agent, not the sum. It streams each report onto the canvas, then the CMO agent synthesizes. The CMO also keeps wrapper-proc tools to ask a channel a follow-up question in chat. That path needs SQL AGENT_RUN to work, and step 0 checks it.

## 4. The channel plugin (the part you'll use the most)
```
 1 CREATE  POST /channels {name, description, mql_rule?}
           -> schema CH_<X>, stage, registry row  status=draft
 2 UPLOAD  POST /channels/x/files  (CSV, repeatable, many files)
           -> PUT @CH_X.UPLOADS -> INFER_SCHEMA -> RAW_<file> (create or append)
 3 PROFILE columns, types, null %, 20 sample rows
           outcome mode auto-detect:
             SELF  dataset has sql/won-like columns
             CRM   has join key (email, gclid, utm, account) to CORE.CRM_LEADS
             NONE  -> 409, ask user which column links to CRM
 4 PROPOSE AI_COMPLETE(claude, schema+samples+contract+mql_rule, structured JSON)
           -> {select_sql, column_notes, assumptions}
 5 VALIDATE compile | contract cols+types | spend(raw)==spend(map) to $1
           | mqls >= sqls >= won | CRM mode: matched leads exist
           fail -> error fed back to Claude, retry up to 2x
 6 APPROVE human clicks once (UI shows SQL + diffs)
           -> CREATE VIEW MAP, semantic view, procs, CREATE AGENT (template)
           -> registry status=active, CALL CORE.REBUILD_FUNNEL()
 7 LIVE    CMO fan-out now includes it. Zero code change.
 re-upload, same columns -> append, MAP still valid
 re-upload, new columns  -> status=needs_mapping, back to step 4
```
**FUNNEL contract** (the only output every mapping must produce): `date, channel, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd`, plus optional `creative_text, audience`.

**Shared MQL definition** (stored in ASSUMPTIONS and editable): F2000 healthcare or finance, Director or above, one real action. A channel can override it with its own `mql_rule` text, which goes into the mapping prompt.

**One agent template** (`templates/channel_agent.yaml.j2`): an instruction block with the channel description, and tools for Analyst on its own semantic view, RECONCILE, MARGINAL_CPS, and Search when text columns exist. Each agent returns a fixed report JSON: spend, plan, mqls, sqls, $/sql, marginal $/sql for the next $10k, a flag, and creative copy.

## 5. The CMO brain
- **Deterministic numbers:** FUNNEL_FACT plus the `UNIT_ECON(budget, rule)` Python proc. Each channel gets a diminishing-returns curve fit from its data. Budget is allocated greedily with a max-heap in $10k steps, which is O((B/step)·log C) and optimal because the curves are concave. The proc returns the PRD scenario table: SQL, customers, ARR, average and last-customer CAC, payback, year-1 and 3-year net. ACV, margin, win rate and sales cost come from ASSUMPTIONS, which you'll swap for real Datasaur values.
- **Autonomy:** moves under the limit (default 10%) are auto-applied and logged. Bigger moves become memos with `status=pending`.
- **Memo schema:** id, title, finding, evidence_sql, recommendation, delta_by_channel, impact (SQL before and after), status.
- **CMO agent tools:** funnel Analyst, UNIT_ECON, PROPOSE_REALLOCATION, ASK_CHANNEL(name, question), code execution.

## 6. Backend API
| Route | Kind | Returns |
|---|---|---|
| GET /channels, POST /channels, POST /channels/{id}/files | onboarding | registry, profile, outcome mode |
| POST /channels/{id}/mapping/propose, /approve | onboarding | SQL, validation report |
| GET /q4/strip, /q4/channels | SQL | 5 KPIs, per-channel cards, each with `sql` |
| GET /plan/scenarios?budget&rule | SQL proc | split + scenario rows |
| POST /q4/review, /ask | SSE | delegation events, cmo tokens, memo |
| GET /memos, POST /memos/{id}/approve or reject | SQL | updates ALLOCATION, DECISION_LOG |
| POST /simulate?days=14 | proc | new rows, triggers re-review |

**Stack:** Python 3.12, FastAPI, snowflake-connector-python (PAT), httpx (Agent Run SSE), jinja2, pydantic. Credentials come from the existing `~/.snowflake/connections.toml` PAT connection, so no secret lives in the repo.

## 7. Repo layout
```
CMO-Agent/
  docs/DESIGN.md
  sql/        00_setup  10_core  20_unit_econ  30_decisions  40_cmo_agent  50_mcp
  templates/  channel.sql.j2 (MAP, semantic view, REPORT, RECONCILE, AGENT)  cmo_agent.sql.j2
  backend/app/ main.py orchestrator.py queries.py simulate.py snowflake.py setup.py
               channels/ ingest.py (upload + profile) mapping.py (propose + validate) provision.py
  seed/ csv/ (google, linkedin, ooh, events, badge_scans, crm, webinars) generate.py load.py
  tests/  test_numbers.py  smoke.sh
```

## 8. Build order (5 hours, demo freeze at 4:15)
0. **Spike, 20m:** Agent Run REST with a PAT, SQL AGENT_RUN signature, AI_COMPLETE structured JSON.
1. **Core, 40m:** setup SQL, CORE tables, ASSUMPTIONS, REBUILD_FUNNEL.
2. **Plugin engine, 70m:** ingest, profile, mapper, validator, provision, plus routes.
3. **Seed via the plugin, 30m:** 4 channels plus CRM uploaded through the API, then reconciled and checked against the PRD numbers.
4. **CMO, 50m:** UNIT_ECON, memos, CMO agent, orchestrator SSE.
5. **P1, 30m:** simulate, a webinar channel added live, MCP server for the CMO agent, a few eval questions.
6. **Hardening, 20m:** smoke script passes 3 times in a row, README.

## 9. Verification
- Every channel's RECONCILE shows zero diff.
- FUNNEL totals match the PRD: 140 MQL, 25 SQL, $63k spend, $3,000 per SQL for LinkedIn.
- UNIT_ECON(1M, 12mo) gives about 45 customers and an 8.9-month payback.
- A webinar channel added through the API alone appears in /q4/channels and the CMO fan-out.
- Approving a memo moves SQLs from 25 to 27.
- Smoke script passes 3 times in a row.

## 10. Risks
- **SQL AGENT_RUN fails:** the CMO drill-down goes through the backend tool instead. Fan-out is unaffected.
- **Claude writes a bad mapping:** the validator plus retries catch it, and the human approves before anything goes live.
- **Your dataset has no link to CRM:** the API returns a clear 409 asking which column is the join key.
- **The seed numbers are demo values:** ASSUMPTIONS is the single place to swap in real values.

## Critical Files
- `backend/app/channels/mapper.py` + `validator.py`: how a new dataset becomes funnel rows
- `templates/channel_agent.yaml.j2`: every subagent comes from this
- `sql/core/rebuild_funnel.sql`: registry-driven FUNNEL_FACT
- `backend/app/orchestrator.py`: parallel fan-out and SSE
- `sql/core/unit_econ.sql`: the 2027 plan math
