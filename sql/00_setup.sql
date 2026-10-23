-- Core objects. Idempotent: safe to re-run.
CREATE DATABASE IF NOT EXISTS CMO_DB;
CREATE SCHEMA IF NOT EXISTS CMO_DB.CORE;
CREATE WAREHOUSE IF NOT EXISTS CMO_WH WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;

CREATE STAGE IF NOT EXISTS CMO_DB.CORE.UPLOADS;  -- shared CRM uploads; every schema has an UPLOADS stage
CREATE FILE FORMAT IF NOT EXISTS CMO_DB.CORE.CSV_FMT
  TYPE = CSV PARSE_HEADER = TRUE FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE EMPTY_FIELD_AS_NULL = TRUE;

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.CHANNEL_REGISTRY (
  channel_id     STRING PRIMARY KEY,   -- slug, e.g. linkedin
  display_name   STRING,
  description    STRING,
  mql_rule       STRING,               -- what counts as an MQL for this channel's data (proxy rules welcome)
  sql_rule       STRING,               -- what counts as an SQL; NULL when the data cannot show SQLs
  schema_name    STRING,
  grain          STRING,               -- daily | flight | event | lifetime: what one raw row covers
  window_start   DATE,                 -- period the data covers; drives annual run rates
  window_end     DATE,
  status         STRING DEFAULT 'draft', -- draft | needs_mapping | active | paused
  map_version    INT DEFAULT 0,
  created_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.MAPPING_HISTORY (
  channel_id   STRING,
  version      INT,
  mapping      VARIANT,                -- {select_sql, raw_spend_sql, window_*, grain, metric_notes, notes, assumptions}
  notes        STRING,
  fingerprint  STRING,                 -- hash of raw column sets the mapping was written for
  validation   VARIANT,
  status       STRING,                 -- proposed | failed | approved
  created_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Every number the CMO uses that is not measured. Swap demo values for real ones here.
CREATE TABLE IF NOT EXISTS CMO_DB.CORE.ASSUMPTIONS (key STRING PRIMARY KEY, num FLOAT, txt STRING, note STRING);
MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('ACV_USD',            120000, NULL, 'placeholder: replace with real ACV'),
    ('GROSS_MARGIN',       0.70,   NULL, 'placeholder'),
    ('SQL_TO_WON',         0.15,   NULL, 'placeholder: no CRM yet'),
    ('SALES_COST_PER_WON', 40000,  NULL, 'placeholder'),
    ('AUTONOMY_LIMIT_PCT', 0.10,   NULL, 'moves below this share of the budget auto-apply'),
    ('PERIOD',             NULL,   'NEXT_12M', 'period that ALLOCATION plans'),
    ('MQL_TO_SQL_OVERRIDE', 0.15,  NULL, 'assumed MQL->SQL rate for channels without measured SQLs; NULL learns it from channels that measure both'),
    ('MQL_RULE', NULL, 'Lead from a Fortune 2000 healthcare or finance company, title Director or above, with one real action (form fill, meeting, or reply).', 'default when a channel has no rule'),
    ('SQL_RULE', NULL, 'Sales accepted the lead and held a first meeting.', 'default when a channel has no rule')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.ALLOCATION (
  channel_id  STRING,
  period      STRING,
  planned_usd FLOAT,
  updated_at  TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  memo_id     STRING
);

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.DECISION_LOG (
  memo_id        STRING PRIMARY KEY,
  created_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  kind           STRING,     -- reallocation | plan | note
  title          STRING,
  finding        STRING,
  evidence_sql   STRING,
  recommendation STRING,
  deltas         VARIANT,    -- {channel_id: delta_usd}
  impact         VARIANT,    -- {sqls_before, sqls_after, ...}
  status         STRING,     -- pending | approved | rejected | auto_applied | superseded
  decided_at     TIMESTAMP_LTZ
);

-- Contract every channel MAP view produces. NULL means not measured, never zero.
-- metrics: additive native counts the channel has (clicks, opens, qr_scans, ai_mentions...), kept per row.
CREATE VIEW IF NOT EXISTS CMO_DB.CORE.FUNNEL_RAW AS
SELECT NULL::DATE date, NULL::STRING channel, NULL::STRING campaign, NULL::FLOAT spend_usd,
       NULL::FLOAT mqls, NULL::FLOAT sqls, NULL::FLOAT opps, NULL::FLOAT pipeline_usd,
       NULL::FLOAT won, NULL::FLOAT won_acv_usd, NULL::STRING creative_text, NULL::STRING audience, NULL::OBJECT metrics
WHERE FALSE;

-- SQLs a channel cannot measure are estimated from the rate seen in channels that measure both stages.
CREATE OR REPLACE VIEW CMO_DB.CORE.MQL_TO_SQL_RATE AS
SELECT COALESCE((SELECT num FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'MQL_TO_SQL_OVERRIDE'),
                SUM(sqls) / NULLIF(SUM(mqls), 0)) AS rate,
       IFF((SELECT num FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'MQL_TO_SQL_OVERRIDE') IS NOT NULL, 'assumed (ASSUMPTIONS)',
           'learned from ' || COALESCE(LISTAGG(DISTINCT channel, ', '), 'no channel')) AS source
FROM CMO_DB.CORE.FUNNEL_RAW WHERE sqls IS NOT NULL AND mqls IS NOT NULL;

CREATE OR REPLACE VIEW CMO_DB.CORE.FUNNEL_FACT AS
SELECT f.date, f.channel, f.campaign, f.spend_usd, f.mqls,
       COALESCE(f.sqls, f.mqls * r.rate) AS sqls,
       f.sqls IS NULL AND f.mqls IS NOT NULL AND r.rate IS NOT NULL AS sqls_estimated,
       f.opps, f.pipeline_usd, f.won, f.won_acv_usd, f.creative_text, f.audience, f.metrics
FROM CMO_DB.CORE.FUNNEL_RAW f CROSS JOIN CMO_DB.CORE.MQL_TO_SQL_RATE r;

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.REBUILD_FUNNEL()
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
  body STRING;
BEGIN
  SELECT LISTAGG('SELECT date, channel, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd, creative_text, audience, metrics FROM CMO_DB.' || schema_name || '.MAP', ' UNION ALL ')
    INTO :body FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active';
  IF (COALESCE(body, '') = '') THEN
    body := 'SELECT NULL::DATE date, NULL::STRING channel, NULL::STRING campaign, NULL::FLOAT spend_usd, NULL::FLOAT mqls, NULL::FLOAT sqls, NULL::FLOAT opps, NULL::FLOAT pipeline_usd, NULL::FLOAT won, NULL::FLOAT won_acv_usd, NULL::STRING creative_text, NULL::STRING audience, NULL::OBJECT metrics WHERE FALSE';
  END IF;
  EXECUTE IMMEDIATE 'CREATE OR REPLACE VIEW CMO_DB.CORE.FUNNEL_RAW AS ' || body;
  RETURN 'FUNNEL_RAW rebuilt';
END;
$$;
