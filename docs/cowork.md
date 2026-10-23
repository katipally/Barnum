# The CMO in Snowflake CoWork, and the Monday brief on the dashboard

Snowflake CoWork (formerly Snowflake Intelligence) is the plain-English chat app where business users work with Cortex Agents. This page puts `CMO_DB.CORE.CMO_AGENT` there. It also adds a weekly brief that the CMO agent writes every Monday; the dashboard home page shows the brief.

## The Monday brief

```
dashboard "This week" ─> /api/companies/{id}/monday-brief ─> backend GET /brief ─> latest row of CORE.WEEKLY_BRIEFS
   latest older than last Monday 07:00 PT? ─> backend writes a new one in the background: CALL CORE.WEEKLY_BRIEF()
                                              ─> CMO_AGENT (DATA_AGENT_RUN) ─> CORE.WEEKLY_BRIEFS; panel polls every 15 s
"Write a fresh one" button ─> backend POST /brief/refresh ─> CALL CORE.WEEKLY_BRIEF() now (20 to 40 s)
```

So the first dashboard visit after Monday 07:00 PT gets that week's brief, and no scheduler or extra privilege is needed. Only one write runs at a time.

**The brief has three parts:**
1. Cost per SQL, overall and for each paid channel, saying which numbers are estimated.
2. Memos waiting for approval, read from `DECISION_LOG` with SQL, because the agent has no tool for the log.
3. One recommendation for the week.

**Safety and fallback:**
- The prompt keeps the agent read-only: it calls `status` once and never calls `propose_reallocation`. In both test runs, `DECISION_LOG` and `ALLOCATION` were unchanged.
- If the agent run fails, `AI_COMPLETE` writes the brief from `STATUS()`. That row then has `source = ai_complete`, and the panel says "fallback model".

**Pieces:**
- `sql/90_cowork.sql` creates the `WEEKLY_BRIEFS` table, the `WEEKLY_BRIEF()` procedure and the `WEEKLY_BRIEF_TASK` task. The task is created suspended.
- `backend/app/brief.py` adds `GET /brief` and `POST /brief/refresh`. They return `{data, sql}`, like the other deterministic routes.
- On the frontend:
  - `src/server/mondayBrief.ts`
  - `src/app/api/companies/[id]/monday-brief/route.ts`
  - `src/components/memo/MondayBrief.tsx`, shown on the home page under the objectives row
- The panel only shows for the live company (`CMO_PROVIDER=cmo-api`). It stays hidden when no brief exists yet, or when the backend is older than `/brief`.

### Optional: write it on Monday even when nobody opens the dashboard (needs ACCOUNTADMIN)

`CORE.WEEKLY_BRIEF_TASK` would have Snowflake write the brief at 07:00 PT, before anyone looks. It is suspended because the owner role lacks the account privilege for tasks (`091089: EXECUTE TASK privilege must be granted to owner role`).

The project's token is restricted to `ATTENDEE_ROLE`, which cannot grant this privilege even with MANAGE GRANTS. Run it in a Snowsight worksheet as ACCOUNTADMIN:

```sql
USE ROLE ACCOUNTADMIN;
GRANT EXECUTE TASK ON ACCOUNT TO ROLE ATTENDEE_ROLE;
USE ROLE ATTENDEE_ROLE;
EXECUTE TASK CMO_DB.CORE.WEEKLY_BRIEF_TASK;      -- one run now; check: SELECT * FROM CMO_DB.CORE.WEEKLY_BRIEFS ORDER BY created_at DESC LIMIT 1;
ALTER TASK CMO_DB.CORE.WEEKLY_BRIEF_TASK RESUME;
```

With the task running, the dashboard finds a fresh brief and writes nothing itself.

## CoWork

### What `sql/90_cowork.sql` sets up

The `CMO_COWORK_USER` role is a read-only role for business users:
- **Can use:** the agent, `CMO_WH`, `STATUS()`, `LIST_CHANNELS()`, `ASK_CHANNEL`, `UNIT_ECON`, and SELECT on `FUNNEL_SV` and the CORE views. A future-views grant keeps the views covered after `REBUILD_FUNNEL` replaces `FUNNEL_FACT`.
- **Cannot run:** `PROPOSE_REALLOCATION` or `DECIDE_MEMO`. Business users can ask anything, but only the CMO owners write and approve memos. If one of them asks for a reallocation, the agent reports that tool as unavailable.

`CREATE OR REPLACE AGENT` drops grants on the agent. Setup runs this file last, so the grants come back after every redeploy.

### Open the CMO in CoWork

1. Go to https://ai.snowflake.com and sign in to the account (org `SFSEHOL`, account `ANTHROPIC_SNOWFLAKE_HACKATHON_EKYTMN`). To get there from Snowsight instead: **AI & ML** » **Agents** » **Agentic CMO** » **Preview in Snowflake CoWork**.
2. In the role and warehouse picker, choose `ATTENDEE_ROLE` (or `CMO_COWORK_USER` for a business user) and warehouse `CMO_WH`.
3. Pick **Agentic CMO** in the agent picker and ask one of its sample questions, such as "Where does every channel stand?".

The account has no `SNOWFLAKE INTELLIGENCE` object (`SHOW SNOWFLAKE INTELLIGENCES` is empty), so CoWork lists every agent the user's role can use. Do **not** create that object just for the CMO: once it exists, CoWork shows only the agents added to it, and other agents (for example `STOWEAWAY_GROWTH_ANALYST`) would disappear. If someone creates it later, add the CMO with:

```sql
ALTER SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT ADD AGENT CMO_DB.CORE.CMO_AGENT;
```

CoWork automations ("send me this every Monday") deliver by email only, to the user's own verified address. The dashboard brief above covers the same need without email.

### Give a business user access

```sql
GRANT ROLE CMO_COWORK_USER TO USER <login>;
ALTER USER <login> SET DEFAULT_ROLE = CMO_COWORK_USER DEFAULT_WAREHOUSE = CMO_WH;
ALTER USER <login> SET ALLOWED_INTERFACES = (SNOWFLAKE_INTELLIGENCE);  -- optional: CoWork only
```

CoWork starts each user in their default role and warehouse, so set both before sending the link.

## Sources

- CoWork deploy and visibility: https://docs.snowflake.com/user-guide/snowflake-cortex/snowflake-intelligence/deploy-agents
- Automations: https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-cowork/automations
- `DATA_AGENT_RUN`: https://docs.snowflake.com/en/sql-reference/functions/data_agent_run-snowflake-cortex
