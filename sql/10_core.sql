-- CMO-level logic shared by all channels. Run after 00_setup.sql.
-- Channels report what they measure: NULL spend / MQL / SQL means not measured and is excluded, never counted as 0.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('RESPONSE_EXPONENT', 0.52, NULL, 'default b in SQLs = k * spend^b; b<1 means diminishing returns. Marginal $/SQL = $/SQL / b'),
    ('PLANNING_STEP_USD', 10000, NULL, 'allocation granularity for UNIT_ECON and reallocation')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE FUNCTION CMO_DB.CORE.A(k STRING)
RETURNS FLOAT
AS 'SELECT num FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = k';

-- Latest planned spend per channel for the planning period (set by approved memos).
CREATE OR REPLACE VIEW CMO_DB.CORE.CURRENT_PLAN AS
SELECT channel_id, planned_usd, memo_id, updated_at
FROM CMO_DB.CORE.ALLOCATION
WHERE period = (SELECT txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD')
QUALIFY ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY updated_at DESC) = 1;

-- Native metrics summed per channel; rates are derived from these sums, never averaged.
CREATE OR REPLACE VIEW CMO_DB.CORE.CHANNEL_METRICS AS
SELECT f.channel, m.key AS metric, SUM(m.value::FLOAT) AS total
FROM CMO_DB.CORE.FUNNEL_FACT f, LATERAL FLATTEN(input => f.metrics) m
GROUP BY 1, 2;

CREATE OR REPLACE VIEW CMO_DB.CORE.CHANNEL_SUMMARY AS
WITH agg AS (
  SELECT channel,
         SUM(spend_usd) spend_usd, SUM(mqls) mqls, SUM(sqls) sqls, BOOLOR_AGG(sqls_estimated) sqls_estimated,
         SUM(opps) opps, SUM(pipeline_usd) pipeline_usd, SUM(won) won, MIN(date) first_date, MAX(date) last_date
  FROM CMO_DB.CORE.FUNNEL_FACT GROUP BY channel
), met AS (
  SELECT channel, OBJECT_AGG(metric, total::VARIANT) metrics FROM CMO_DB.CORE.CHANNEL_METRICS GROUP BY channel
)
SELECT r.channel_id, r.display_name, r.grain, r.mql_rule, r.sql_rule,
       COALESCE(r.window_start, a.first_date) AS window_start, COALESCE(r.window_end, a.last_date) AS window_end,
       DATEDIFF('day', COALESCE(r.window_start, a.first_date), COALESCE(r.window_end, a.last_date)) + 1 AS window_days,
       365.0 / NULLIF(window_days, 0) AS annual_factor,
       a.spend_usd, a.mqls, a.sqls, COALESCE(a.sqls_estimated, FALSE) AS sqls_estimated, a.opps, a.pipeline_usd, a.won,
       a.spend_usd / NULLIF(a.mqls, 0) AS cost_per_mql,
       a.spend_usd / NULLIF(a.sqls, 0) AS cost_per_sql,
       a.sqls / NULLIF(a.mqls, 0) AS mql_to_sql,
       a.spend_usd * annual_factor AS annual_spend_usd,
       a.sqls * annual_factor AS annual_sqls,
       COALESCE(e.num, CMO_DB.CORE.A('RESPONSE_EXPONENT')) AS response_exponent,
       cost_per_sql / response_exponent AS marginal_cost_per_sql,
       a.sqls * CMO_DB.CORE.A('SQL_TO_WON') AS expected_wins,
       p.planned_usd AS plan_usd,
       COALESCE(met.metrics, OBJECT_CONSTRUCT()) AS metrics
FROM CMO_DB.CORE.CHANNEL_REGISTRY r
LEFT JOIN agg a ON a.channel = r.channel_id
LEFT JOIN met ON met.channel = r.channel_id
LEFT JOIN CMO_DB.CORE.CURRENT_PLAN p ON p.channel_id = r.channel_id
LEFT JOIN CMO_DB.CORE.ASSUMPTIONS e ON e.key = 'RESPONSE_EXPONENT:' || r.channel_id
WHERE r.status = 'active';

CREATE OR REPLACE FUNCTION CMO_DB.CORE.CHANNEL_STATS(cid STRING)
RETURNS OBJECT
AS
$$
SELECT OBJECT_CONSTRUCT(
  'channel', channel_id, 'grain', grain, 'window_start', window_start, 'window_end', window_end, 'window_days', window_days,
  'mql_rule', mql_rule, 'sql_rule', sql_rule,
  'spend_usd', ROUND(spend_usd), 'annual_spend_usd', ROUND(annual_spend_usd), 'plan_usd', plan_usd,
  'mqls', ROUND(mqls, 1), 'sqls', ROUND(sqls, 1), 'sqls_estimated', sqls_estimated,
  'cost_per_mql', ROUND(cost_per_mql), 'cost_per_sql', ROUND(cost_per_sql), 'mql_to_sql', ROUND(mql_to_sql, 3),
  'marginal_cost_per_sql', ROUND(marginal_cost_per_sql),
  'sqls_per_next_10k', ROUND(10000 / NULLIF(marginal_cost_per_sql, 0), 1),
  'native_metrics', metrics)
FROM CMO_DB.CORE.CHANNEL_SUMMARY WHERE channel_id = cid
$$;
