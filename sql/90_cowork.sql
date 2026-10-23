-- The CMO for business users: a read-only role for Snowflake CoWork, and a Monday brief on the dashboard.
-- Runs last in setup, so grants come back after CREATE OR REPLACE AGENT drops them. UI steps: docs/cowork.md.

-- Read-only CoWork role: can ask the CMO anything, cannot write memos (no PROPOSE_REALLOCATION, no DECIDE_MEMO).
CREATE ROLE IF NOT EXISTS CMO_COWORK_USER COMMENT = 'Business users of the Agentic CMO in Snowflake CoWork (read-only)';
GRANT USAGE ON DATABASE CMO_DB TO ROLE CMO_COWORK_USER;
GRANT USAGE ON SCHEMA CMO_DB.CORE TO ROLE CMO_COWORK_USER;
GRANT USAGE ON WAREHOUSE CMO_WH TO ROLE CMO_COWORK_USER;
GRANT USAGE ON AGENT CMO_DB.CORE.CMO_AGENT TO ROLE CMO_COWORK_USER;
GRANT SELECT, REFERENCES ON SEMANTIC VIEW CMO_DB.CORE.FUNNEL_SV TO ROLE CMO_COWORK_USER;
GRANT SELECT ON ALL VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_COWORK_USER;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_COWORK_USER;  -- FUNNEL_FACT is replaced on every channel approval
GRANT USAGE ON FUNCTION CMO_DB.CORE.STATUS() TO ROLE CMO_COWORK_USER;
GRANT USAGE ON FUNCTION CMO_DB.CORE.LIST_CHANNELS() TO ROLE CMO_COWORK_USER;
GRANT USAGE ON PROCEDURE CMO_DB.CORE.ASK_CHANNEL(STRING, STRING) TO ROLE CMO_COWORK_USER;
GRANT USAGE ON PROCEDURE CMO_DB.CORE.UNIT_ECON(FLOAT, STRING) TO ROLE CMO_COWORK_USER;


-- Monday brief for the dashboard (GET /brief). Every run adds a row; the dashboard shows the latest.
CREATE TABLE IF NOT EXISTS CMO_DB.CORE.WEEKLY_BRIEFS (
  created_at    TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  source        STRING,     -- cmo_agent | ai_complete (fallback when the agent run fails)
  brief         STRING,
  pending_memos VARIANT,
  strip         VARIANT     -- STATUS().strip the brief was written from
);

-- The CMO agent writes the brief from its own tools; pending memos come from SQL because the agent cannot read the log.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.WEEKLY_BRIEF()
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
import json

ASK = """It is Monday morning. Write this week's brief for the leadership dashboard: plain text, no title or subject line, under 180 words, in exactly three parts with these labels:
Cost per SQL: where we stand overall and for each paid channel, saying which SQL counts are estimated.
Waiting for approval: {memos}
Recommendation: one action for this week, with the dollar amount and the reason.
Call the status tool once. Do not call ask_channel, unit_econ, propose_reallocation or data_to_chart: this brief is read-only and must not write or apply a memo."""


def text_of(res):
    return "".join(c.get("text", "") for c in res.get("content", []) if c.get("type") == "text").strip()


def run(session):
    memos = [json.loads(r[0]) for r in session.sql(
        "SELECT OBJECT_CONSTRUCT('memo_id', memo_id, 'title', title, 'recommendation', recommendation, 'deltas', deltas, "
        "'created_at', created_at::STRING) FROM CMO_DB.CORE.DECISION_LOG WHERE status = 'pending' ORDER BY created_at").collect()]
    memo_txt = json.dumps(memos) + " (list each memo_id and what approving it does)" if memos else "none; say so in one line."
    status = json.loads(session.sql("SELECT CMO_DB.CORE.STATUS()::STRING").collect()[0][0])
    prompt = ASK.format(memos=memo_txt)

    source, brief, error = "cmo_agent", "", None
    try:
        body = json.dumps({"messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}]})
        res = json.loads(session.sql("SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN('CMO_DB.CORE.CMO_AGENT', ?)", params=[body]).collect()[0][0])
        brief = text_of(res)
    except Exception as e:  # agent unavailable: same brief from the same numbers in one completion
        error = str(e)[:500]
    if not brief:
        source = "ai_complete"
        facts = json.dumps({"strip": status["strip"], "plan": status.get("plan"),
                            "channels": [{k: c.get(k) for k in ("CHANNEL_ID", "SPEND_USD", "SQLS", "SQLS_ESTIMATED", "COST_PER_SQL", "MARGINAL_COST_PER_SQL")}
                                         for c in status["channels"]]})
        brief = session.sql("SELECT AI_COMPLETE('claude-sonnet-4-5', ?)",
                            params=[f"You are the CMO. Numbers come only from this data: {facts}\n\n{prompt.split('Call the status tool')[0]}"]).collect()[0][0].strip()

    session.sql("INSERT INTO CMO_DB.CORE.WEEKLY_BRIEFS (source, brief, pending_memos, strip) SELECT ?, ?, PARSE_JSON(?), PARSE_JSON(?)",
                params=[source, brief, json.dumps(memos), json.dumps(status["strip"])]).collect()
    return {"source": source, "agent_error": error, "brief": brief}
$$;

-- Created suspended; resuming needs EXECUTE TASK on the owner role (docs/cowork.md).
CREATE TASK IF NOT EXISTS CMO_DB.CORE.WEEKLY_BRIEF_TASK
  WAREHOUSE = CMO_WH
  SCHEDULE = 'USING CRON 0 7 * * MON America/Los_Angeles'
  USER_TASK_TIMEOUT_MS = 900000
  COMMENT = 'Monday 07:00 PT: the CMO writes the week''s brief for the dashboard'
AS CALL CMO_DB.CORE.WEEKLY_BRIEF();
