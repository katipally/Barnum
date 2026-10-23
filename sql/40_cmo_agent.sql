-- The CMO orchestrator. Reads only CORE (FUNNEL_FACT and decisions); reaches channels through ASK_CHANNEL.

CREATE OR REPLACE VIEW CMO_DB.CORE.FUNNEL_METRICS_LONG AS
SELECT f.date, f.channel, f.campaign, m.key AS metric, m.value::FLOAT AS value
FROM CMO_DB.CORE.FUNNEL_FACT f, LATERAL FLATTEN(input => f.metrics) m;

CREATE OR REPLACE SEMANTIC VIEW CMO_DB.CORE.FUNNEL_SV
  TABLES (
    funnel AS CMO_DB.CORE.FUNNEL_FACT COMMENT = 'Shared funnel across channels. NULL = not measured by that channel. sqls_estimated marks SQLs from the cross-channel MQL-to-SQL rate',
    native AS CMO_DB.CORE.FUNNEL_METRICS_LONG COMMENT = 'Every channel native metric (clicks, opens, replies, qr_scans, ai_mentions...) in long form'
  )
  FACTS (
    funnel.spend_fact AS spend_usd, funnel.mql_fact AS mqls, funnel.sql_fact AS sqls,
    funnel.opp_fact AS opps, funnel.pipeline_fact AS pipeline_usd, funnel.won_fact AS won, native.value_fact AS value
  )
  DIMENSIONS (
    funnel.activity_date AS "DATE" WITH SYNONYMS = ('date', 'day', 'month', 'time'),
    funnel.channel AS channel WITH SYNONYMS = ('source', 'platform', 'channel agent'),
    funnel.campaign AS campaign WITH SYNONYMS = ('creative', 'keyword', 'board', 'sequence', 'query', 'page'),
    funnel.sqls_estimated AS sqls_estimated,
    native.metric_activity_date AS "DATE" WITH SYNONYMS = ('date', 'day', 'month', 'time'),
    native.metric_channel AS channel,
    native.metric_campaign AS campaign,
    native.metric AS metric WITH SYNONYMS = ('native metric', 'kpi', 'reply outcomes')
  )
  METRICS (
    funnel.spend AS SUM(spend_usd) COMMENT = 'Spend in USD, only channels that measure spend',
    funnel.mql_count AS SUM(mqls) WITH SYNONYMS = ('MQLs'),
    funnel.sql_count AS SUM(sqls) WITH SYNONYMS = ('SQLs', 'SQL', 'sales qualified lead', 'sales qualified leads'),
    funnel.pipeline AS SUM(pipeline_usd),
    funnel.cost_per_mql AS SUM(spend_usd) / NULLIF(SUM(IFF(spend_usd IS NOT NULL, mqls, NULL)), 0) WITH SYNONYMS = ('cost per lead'),
    funnel.cost_per_sql AS SUM(spend_usd) / NULLIF(SUM(IFF(spend_usd IS NOT NULL, sqls, NULL)), 0) WITH SYNONYMS = ('cheapest lead', 'cost per qualified lead'),
    funnel.mql_to_sql_rate AS SUM(sqls) / NULLIF(SUM(mqls), 0),
    native.metric_total AS SUM(value) COMMENT = 'Sum of a native metric; always filter or group by metric and channel'
  )
  COMMENT = 'Channels report what they measure. Compare budget channels on cost per SQL; compare others on their own native outcomes.';

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
    texts = [c.get("text", "") for c in res.get("content", []) if c.get("type") == "text"]
    return {"channel": channel_id, "answer": texts[-1] if texts else ""}  # earlier text blocks are pre-tool narration
$$;

CREATE OR REPLACE FUNCTION CMO_DB.CORE.LIST_CHANNELS()
RETURNS ARRAY
AS
$$
SELECT ARRAY_AGG(OBJECT_CONSTRUCT('channel_id', channel_id, 'display_name', display_name, 'description', description,
                                 'mql_rule', mql_rule, 'sql_rule', sql_rule, 'grain', grain, 'window_start', window_start, 'window_end', window_end))
FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active'
$$;

CREATE OR REPLACE FUNCTION CMO_DB.CORE.STATUS()
RETURNS OBJECT
AS
$$
SELECT OBJECT_CONSTRUCT(
  'strip', (SELECT OBJECT_CONSTRUCT(*) FROM CMO_DB.CORE.EXEC_STRIP),
  'channels', (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM CMO_DB.CORE.CHANNEL_SUMMARY),
  'plan', (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM CMO_DB.CORE.PLAN_PROJECTION),
  'assumptions', (SELECT OBJECT_AGG(key, COALESCE(TO_VARIANT(num), TO_VARIANT(txt), TO_VARIANT('unset'))) FROM CMO_DB.CORE.ASSUMPTIONS))
$$;
