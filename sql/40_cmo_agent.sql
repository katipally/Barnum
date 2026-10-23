-- The CMO orchestrator. Reads only CORE (FUNNEL_FACT and decisions); reaches channels through ASK_CHANNEL.

CREATE OR REPLACE SEMANTIC VIEW CMO_DB.CORE.FUNNEL_SV
  TABLES (funnel AS CMO_DB.CORE.FUNNEL_FACT COMMENT = 'Common funnel: one row per channel, day and campaign')
  FACTS (
    funnel.spend_fact AS spend_usd, funnel.mql_fact AS mqls, funnel.sql_fact AS sqls,
    funnel.opp_fact AS opps, funnel.pipeline_fact AS pipeline_usd, funnel.won_fact AS won
  )
  DIMENSIONS (
    funnel.day AS date WITH SYNONYMS = ('date', 'day', 'week', 'month'),
    funnel.channel AS channel WITH SYNONYMS = ('source', 'platform', 'channel agent'),
    funnel.campaign AS campaign WITH SYNONYMS = ('creative', 'keyword', 'event', 'board', 'audience')
  )
  METRICS (
    funnel.spend AS SUM(spend_usd) COMMENT = 'Spend in USD',
    funnel.mql_count AS SUM(mqls) WITH SYNONYMS = ('MQLs'),
    funnel.sql_count AS SUM(sqls) WITH SYNONYMS = ('SQLs'),
    funnel.pipeline AS SUM(pipeline_usd),
    funnel.cost_per_mql AS SUM(spend_usd) / NULLIF(SUM(mqls), 0),
    funnel.cost_per_sql AS SUM(spend_usd) / NULLIF(SUM(sqls), 0) WITH SYNONYMS = ('$ per SQL', 'CPS'),
    funnel.mql_to_sql_rate AS SUM(sqls) / NULLIF(SUM(mqls), 0)
  )
  COMMENT = 'Every channel agent writes here in the same units. Compare channels on cost per SQL, never on clicks or scans.';

-- Delegate a question to one channel agent. Agent name must be a literal, so it is resolved from the registry.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.ASK_CHANNEL(CHANNEL_ID STRING, QUESTION STRING)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
import json


def run(session, channel_id, question):
    rows = session.sql("SELECT schema_name FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE channel_id = ? AND status = 'active'",
                       params=[channel_id]).collect()
    if not rows:
        active = [r[0] for r in session.sql("SELECT channel_id FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active'").collect()]
        return {"error": f"no active channel {channel_id!r}", "active_channels": active}
    body = json.dumps({"messages": [{"role": "user", "content": [{"type": "text", "text": question}]}]})
    agent = f"CMO_DB.{rows[0][0]}.AGENT"  # schema_name is CH_<ident>, validated at creation
    res = json.loads(session.sql(f"SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN('{agent}', ?)", params=[body]).collect()[0][0])
    text = "".join(c.get("text", "") for c in res.get("content", []) if c.get("type") == "text")
    return {"channel": channel_id, "answer": text}
$$;

CREATE OR REPLACE FUNCTION CMO_DB.CORE.LIST_CHANNELS()
RETURNS ARRAY
AS
$$
SELECT ARRAY_AGG(OBJECT_CONSTRUCT('channel_id', channel_id, 'display_name', display_name, 'description', description))
FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active'
$$;

CREATE OR REPLACE FUNCTION CMO_DB.CORE.Q4_STATUS()
RETURNS OBJECT
AS
$$
SELECT OBJECT_CONSTRUCT(
  'strip', (SELECT OBJECT_CONSTRUCT(*) FROM CMO_DB.CORE.EXEC_STRIP),
  'channels', (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM CMO_DB.CORE.Q4_PROJECTION),
  'assumptions', (SELECT OBJECT_AGG(key, COALESCE(TO_VARIANT(num), TO_VARIANT(txt))) FROM CMO_DB.CORE.ASSUMPTIONS))
$$;
