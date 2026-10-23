# Snowflake integration

The app talks to data and the agent through one interface, `CmoProvider` (`src/server/provider.ts`):

```ts
listCases(): Promise<CaseSummary[]>                        // provider-owned sample companies (read-only)
getCaseData(caseId): Promise<CaseData | undefined>          // raw data of a sample, shape in src/lib/types.ts
getConnectedData?(company): Promise<CaseData | null>        // live data for a user-created company, null = not connected
ask(caseId, question, data): AsyncIterable<string>          // streamed answer text
```

Everything derived (status, verdicts, scores, forecasts, pacing) is computed in `src/server/heuristics.ts`
from raw `CaseData`, so Snowflake only has to return raw rows. Decisions and steering are applied to an
in-memory working copy per company (`src/server/store.ts`, on `globalThis`) on top of the source data.

## Company registry (`src/server/companies.ts`)

Companies are workspaces with a slug id. Two kinds:

| Kind | Source | `sample` | `dataStatus` | Delete |
|---|---|---|---|---|
| Sample (`fieldnote`, `tessellate`, `brightwell`) | provider (`src/data/seeds`) | `true` | `sample` | 403 |
| User-created (onboarding) | `.data/companies.json` | `false` | `awaiting_data` → `connected` | yes |

- `POST /api/companies` validates the `CompanyInput` (400 lists every problem), builds the workspace with
  `buildCompany()` (`src/server/templates.ts`) and returns its `CaseSummary` (201). The id is a slug of the
  name, unique against samples and existing companies (`acme`, `acme-2`, …).
- `GET /api/companies`: user companies newest first, then samples. `DELETE /api/companies/[id]`: 403 for
  samples, 404 for unknown ids. Every per-company route is under `/api/companies/[id]/…` and returns 404
  for unknown ids.
- A new company has one CEO goal (the onboarding top goal), stage guardrails, a stage-template revenue tree
  whose root is the goal and whose drivers have `target/actual/forecast = 0` (not set yet), three template
  objectives with placeholder north-star metric ids, and empty metrics, actions, contributions, decisions,
  changes and log. Tree nodes with target 0 get no `status`; a goal with target 0 is `at_risk`.

### Persistence

- File: `<repo>/.data/companies.json` (override the directory with `CMO_DATA_DIR`), git-ignored.
  Shape `{ version: 1, companies: [{ input, createdAt, data }] }`: the onboarding input, creation time and
  the company's `CaseData`.
- Read once per server process (cached on `globalThis`), created on first write. Writes are serialised and
  atomic (temp file + rename). An unreadable file is moved aside to `companies.json.corrupt-<ts>`, never
  overwritten.
- While a company is `awaiting_data`, CEO steering (goal targets, guardrails, objective priorities) is
  written back to the file, so it survives restarts. `POST /api/companies/[id]/reset` rebuilds the
  template from the stored input. Sample changes stay in memory only; reset restores the seed.

### Connecting real data

A connected Snowflake account flips a company from `awaiting_data` to `connected`:

1. Implement `getConnectedData(company)` in `src/server/providers/cortex.ts`: if Snowflake has data for
   `company.id` (a row in `CASES`), load the tables below filtered by `CASE_ID = company.id` and map them to
   `CaseData`; otherwise return `null`.
2. `companySource()` then uses that data instead of the stored template, keeping the registry id and name
   and setting `sample: false, dataStatus: "connected"`. Connected data is not copied into
   `.data/companies.json`; the file keeps only the company's identity and onboarding input.
3. The working copy is built on first read per process; after connecting, call reset (or restart) to load it.
   Steering and decisions on connected companies should be written to the audit tables below.

## Switching provider

| Env var | Purpose |
|---|---|
| `CMO_PROVIDER` | `mock` (default, seed data + scripted answers) or `cortex` |
| `SNOWFLAKE_ACCOUNT_URL` | e.g. `https://<org>-<account>.snowflakecomputing.com` |
| `SNOWFLAKE_PAT` | programmatic access token (sent as `Bearer`) |
| `SNOWFLAKE_DATABASE` / `SNOWFLAKE_SCHEMA` | where the agent and tables live, e.g. `CMO` / `DEMO` |
| `SNOWFLAKE_AGENT` | Cortex Agent name, e.g. `CMO_AGENT` |

With `CMO_PROVIDER=cortex` but any `SNOWFLAKE_*` var missing, `ask` logs a warning and falls back to the
mock answer. `getCaseData` still returns seeds and `getConnectedData` returns `null` (`TODO(colleague)` in
`src/server/providers/cortex.ts`).

## `ask` → Cortex Agent (untested)

`src/server/providers/cortex.ts` calls

```
POST {SNOWFLAKE_ACCOUNT_URL}/api/v2/databases/{DB}/schemas/{SCHEMA}/agents/{AGENT}:run
Authorization: Bearer {SNOWFLAKE_PAT}
X-Snowflake-Authorization-Token-Type: PROGRAMMATIC_ACCESS_TOKEN
{ "messages": [{ "role": "user", "content": [{ "type": "text", "text": "Case context (JSON): …\n\nCEO question: …" }] }] }
```

and streams the `text` field of every `response.text.delta` SSE event to the browser. The JSON context
(`caseContext()`) carries goals, objectives with forecasts, scored actions and pending decisions, so the agent
sees the same numbers as the UI. Suggested agent setup:

- **Tools**: Cortex Analyst over a semantic view on the tables below (`METRICS_WEEKLY`, `ACTIONS`,
  `CONTRIBUTIONS`); optionally Cortex Search over campaign briefs.
- **Instructions**: answer as the CMO in ≤120 words, plain text, cite each number with its `SOURCE`, label
  anything not from data as an assumption, never approve decisions itself.

## Suggested tables

All tables carry `CASE_ID`: the company slug (`fieldnote` | `tessellate` | `brightwell` for samples, or a user company id). Column names map 1:1 to `src/lib/types.ts`.

| Table | Columns | Maps to |
|---|---|---|
| `CASES` | CASE_ID, NAME, TAGLINE, STAGE, STAGE_LABEL, INDUSTRY, WEEK, WEEKS_IN_PERIOD, PERIOD_LABEL, PRIMARY_OBJECTIVE, HEADLINE | `CompanyCase`, `headline` |
| `GUARDRAILS` | CASE_ID, BUDGET_TOTAL, BUDGET_SPENT, AUTONOMY_PCT, BRAND_FLOOR_PCT, MAX_SHIFT_PER_WEEK_PCT, MIN_TEST_WEEKS | `Guardrails` |
| `GOALS` | CASE_ID, GOAL_ID, LABEL, KIND, TARGET, CURRENT, UNIT, DIRECTION, DEADLINE, SET_BY | `BusinessGoal[]` |
| `REVENUE_TREE` | CASE_ID, NODE_ID, PARENT_ID (null = root), LABEL, OP, UNIT, TARGET, ACTUAL, FORECAST, OWNER, METRIC_ID, SORT | `TreeNode` (rebuild via PARENT_ID) |
| `OBJECTIVES` | CASE_ID, OBJECTIVE_ID, LABEL, DRIVER_NODE_ID, NORTH_STAR_METRIC_ID, SUPPORTING_METRIC_IDS (ARRAY), PRIORITY, RATIONALE | `MarketingObjective[]` |
| `METRICS` | CASE_ID, METRIC_ID, LABEL, UNIT, TARGET, DIRECTION, LAGGING, SOURCE, OBJECTIVE_ID | `Metric` (without series) |
| `METRICS_WEEKLY` | CASE_ID, METRIC_ID, WEEK, VALUE | `Metric.series` |
| `ACTIONS` | CASE_ID, ACTION_ID, LABEL, CHANNEL, FUNNEL_STAGE, BUDGET, SPENT, RESULT_LABEL, RESULTS, COST_PER_RESULT, MARGINAL_COST_PER_RESULT, WEEKS_RUNNING, HYPOTHESIS, STATUS | `Action[]` (leave verdict/score to the server) |
| `CONTRIBUTIONS` | CASE_ID, ACTION_ID, OBJECTIVE_ID, WEIGHT, METHOD, CONFIDENCE | `Contribution[]` (weights per action sum to 1) |
| `CHANGES` | CASE_ID, CHANGE_ID, WEEK, TITLE, DETAIL, IMPACT, METRIC_ID, SOURCE | `Change[]` |
| `DECISIONS` | CASE_ID, DECISION_ID, TITLE, RATIONALE, IMPACT, RISK, REASON, AMOUNT, FROM_ACTION_ID, TO_ACTION_ID, EVIDENCE (VARIANT array of {label,value,source}), STATUS | `Decision[]` |
| `AGENT_LOG` | CASE_ID, LOG_ID, WEEK, KIND, TEXT, AMOUNT | `AgentLogEntry[]` |

Notes:
- Metric series are weekly values for weeks `1..WEEK`. A lagging usd/count metric whose series never
  decreases is treated as a running total and forecast by run-rate; anything else by 4-week slope.
- `MARGINAL_COST_PER_RESULT` drives scale/cut verdicts; feed it from MMM response curves where possible
  (fall back to `COST_PER_RESULT`).

## Writing decisions back

Today `POST /api/companies/[id]/decisions/[decisionId]` mutates the working copy only (and moves budget between
`fromActionId` → `toActionId` on approval). For persistence, append to an audit table and update the
decision row, in `decide()` in `src/server/store.ts`:

| Table | Columns |
|---|---|
| `DECISION_AUDIT` | AUDIT_ID, CASE_ID, DECISION_ID, STATUS (approved/rejected), NOTE, AMOUNT, FROM_ACTION_ID, TO_ACTION_ID, DECIDED_BY, DECIDED_AT |
| `STEERING_AUDIT` | AUDIT_ID, CASE_ID, PAYLOAD (VARIANT `SteeringUpdate`), CHANGED_BY, CHANGED_AT |

Then `UPDATE DECISIONS SET STATUS = …`, `UPDATE ACTIONS SET BUDGET = …` for both actions, and insert an
`AGENT_LOG` row (`CEO approved: …`). The audit table is append-only; it is what the agent should read to
learn which kinds of recommendation the CEO accepts.

`POST /api/companies/[id]/reset` drops decisions and steering for a company (user companies get a fresh template).

## CMO-Agent FastAPI (`CMO_PROVIDER=cmo-api`)

`src/server/providers/cmoApi.ts` reads `../backend/app/main.py` and maps it onto the UI model:

| FastAPI | UI |
|---|---|
| `GET /assumptions` | period, ACV, SQL→won, autonomy limit; optional `Q4_SQL_TARGET`, `PAYBACK_TARGET_MONTHS`, `CPS_TARGET_USD` set goal targets (0 = not set) |
| `GET /q4/strip` | goals, metrics, revenue tree (expected new ARR = SQLs × SQL→won × ACV; SQLs = MQLs × MQL→SQL) |
| `GET /q4/channels` | actions (one per channel: plan, spend, SQLs, cost and marginal cost per SQL) |
| `GET /memos` | pending/approved/rejected memos → decisions; `auto_applied` → "What I did on my own" |
| `POST /memos/{id}/approve\|reject` | Approve / Not now (calls `DECIDE_MEMO`) |
| `POST /ask` (SSE `token`/`error`/`done`) | Ask the CMO, streamed from `CMO_DB.CORE.CMO_AGENT` (`CMO_AGENT_SCHEMA`/`CMO_AGENT_NAME`) |

The live company is re-read on every request; steering changes made in the UI are kept as an in-memory overlay
until they are written to `ASSUMPTIONS`.
