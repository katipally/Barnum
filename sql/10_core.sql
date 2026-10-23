-- CMO-level logic shared by all channels. Run after 00_setup.sql.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('RESPONSE_EXPONENT', 0.52, NULL, 'b in SQLs = k * spend^b; b<1 means diminishing returns. Marginal $/SQL = $/SQL / b'),
    ('PLANNING_STEP_USD', 10000, NULL, 'allocation granularity for UNIT_ECON')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE FUNCTION CMO_DB.CORE.A(k STRING)
RETURNS FLOAT
AS 'SELECT num FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = k';

-- Latest planned spend per channel for the current period.
CREATE OR REPLACE VIEW CMO_DB.CORE.CURRENT_PLAN AS
SELECT channel_id, planned_usd, memo_id, updated_at
FROM CMO_DB.CORE.ALLOCATION
WHERE period = (SELECT txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD')
QUALIFY ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY updated_at DESC) = 1;

CREATE OR REPLACE VIEW CMO_DB.CORE.CHANNEL_SUMMARY AS
SELECT r.channel_id, r.display_name,
       COALESCE(SUM(f.spend_usd), 0)  AS spend_usd,
       p.planned_usd                   AS plan_usd,
       COALESCE(SUM(f.mqls), 0)        AS mqls,
       COALESCE(SUM(f.sqls), 0)        AS sqls,
       COALESCE(SUM(f.opps), 0)        AS opps,
       COALESCE(SUM(f.pipeline_usd), 0) AS pipeline_usd,
       COALESCE(SUM(f.won), 0)         AS won,
       SUM(f.spend_usd) / NULLIF(SUM(f.mqls), 0) AS cost_per_mql,
       SUM(f.spend_usd) / NULLIF(SUM(f.sqls), 0) AS cost_per_sql,
       SUM(f.sqls) / NULLIF(SUM(f.mqls), 0)      AS mql_to_sql,
       SUM(f.spend_usd) / NULLIF(SUM(f.sqls), 0) / CMO_DB.CORE.A('RESPONSE_EXPONENT') AS marginal_cost_per_sql,
       SUM(f.sqls) * CMO_DB.CORE.A('SQL_TO_WON') AS expected_wins
FROM CMO_DB.CORE.CHANNEL_REGISTRY r
LEFT JOIN CMO_DB.CORE.FUNNEL_FACT f ON f.channel = r.channel_id
LEFT JOIN CMO_DB.CORE.CURRENT_PLAN p ON p.channel_id = r.channel_id
WHERE r.status = 'active'
GROUP BY r.channel_id, r.display_name, p.planned_usd;

CREATE OR REPLACE FUNCTION CMO_DB.CORE.CHANNEL_STATS(cid STRING)
RETURNS OBJECT
AS
$$
SELECT OBJECT_CONSTRUCT(
  'channel', channel_id, 'spend_usd', ROUND(spend_usd), 'plan_usd', plan_usd,
  'pacing_pct', ROUND(spend_usd / NULLIF(plan_usd, 0), 3),
  'mqls', mqls, 'sqls', sqls, 'cost_per_mql', ROUND(cost_per_mql), 'cost_per_sql', ROUND(cost_per_sql),
  'mql_to_sql', ROUND(mql_to_sql, 3), 'marginal_cost_per_sql', ROUND(marginal_cost_per_sql),
  'sqls_per_next_10k', ROUND(10000 / NULLIF(marginal_cost_per_sql, 0), 1), 'expected_wins', ROUND(expected_wins, 2))
FROM CMO_DB.CORE.CHANNEL_SUMMARY WHERE channel_id = cid
$$;
