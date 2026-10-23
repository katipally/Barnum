-- Core objects. Idempotent: safe to re-run.
CREATE DATABASE IF NOT EXISTS CMO_DB;
CREATE SCHEMA IF NOT EXISTS CMO_DB.CORE;
CREATE WAREHOUSE IF NOT EXISTS CMO_WH WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;

CREATE STAGE IF NOT EXISTS CMO_DB.CORE.CRM_UPLOADS;
CREATE FILE FORMAT IF NOT EXISTS CMO_DB.CORE.CSV_FMT
  TYPE = CSV PARSE_HEADER = TRUE FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE EMPTY_FIELD_AS_NULL = TRUE;

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.CHANNEL_REGISTRY (
  channel_id     STRING PRIMARY KEY,   -- slug, e.g. linkedin
  display_name   STRING,
  description    STRING,
  mql_rule       STRING,               -- overrides ASSUMPTIONS.MQL_RULE when set
  schema_name    STRING,
  outcome_mode   STRING,               -- SELF | CRM
  status         STRING DEFAULT 'draft', -- draft | needs_mapping | active | paused
  map_version    INT DEFAULT 0,
  created_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS CMO_DB.CORE.MAPPING_HISTORY (
  channel_id   STRING,
  version      INT,
  select_sql   STRING,
  notes        STRING,
  fingerprint  STRING,                 -- hash of raw column sets the mapping was written for
  validation   VARIANT,
  status       STRING,                 -- proposed | approved | rejected
  created_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Every number the CMO uses that is not measured. Swap demo values for real ones here.
CREATE TABLE IF NOT EXISTS CMO_DB.CORE.ASSUMPTIONS (key STRING PRIMARY KEY, num FLOAT, txt STRING, note STRING);
MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('ACV_USD',            120000, NULL, 'demo seed'),
    ('GROSS_MARGIN',       0.70,   NULL, 'demo seed'),
    ('SQL_TO_WON',         0.15,   NULL, 'demo seed'),
    ('SALES_COST_PER_WON', 40000,  NULL, 'demo seed'),
    ('Q4_BUDGET_USD',      125000, NULL, 'demo seed'),
    ('AUTONOMY_LIMIT_PCT', 0.10,   NULL, 'moves below this share of remaining budget auto-apply'),
    ('PERIOD',             NULL,   'Q4_2026', 'current tactical period'),
    ('PERIOD_START',       NULL,   '2026-10-01', NULL),
    ('PERIOD_END',         NULL,   '2026-12-31', NULL),
    ('MQL_RULE', NULL, 'Lead from a Fortune 2000 healthcare or finance company, title Director or above, with one real action (form fill, meeting, or reply).', NULL),
    ('SQL_RULE', NULL, 'Sales accepted the lead and held a first meeting.', NULL)
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
  status         STRING,     -- pending | approved | rejected | auto_applied
  decided_at     TIMESTAMP_LTZ
);

-- Contract every channel MAP view must produce. Rebuilt by REBUILD_FUNNEL from active channels.
CREATE VIEW IF NOT EXISTS CMO_DB.CORE.FUNNEL_FACT AS
SELECT NULL::DATE date, NULL::STRING channel, NULL::STRING campaign, NULL::FLOAT spend_usd,
       NULL::INT mqls, NULL::INT sqls, NULL::INT opps, NULL::FLOAT pipeline_usd,
       NULL::INT won, NULL::FLOAT won_acv_usd, NULL::STRING creative_text, NULL::STRING audience
WHERE FALSE;

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.REBUILD_FUNNEL()
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
  body STRING;
BEGIN
  SELECT LISTAGG('SELECT date, channel, campaign, spend_usd, mqls, sqls, opps, pipeline_usd, won, won_acv_usd, creative_text, audience FROM CMO_DB.' || schema_name || '.MAP', ' UNION ALL ')
    INTO :body FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active';
  IF (COALESCE(body, '') = '') THEN
    body := 'SELECT NULL::DATE date, NULL::STRING channel, NULL::STRING campaign, NULL::FLOAT spend_usd, NULL::INT mqls, NULL::INT sqls, NULL::INT opps, NULL::FLOAT pipeline_usd, NULL::INT won, NULL::FLOAT won_acv_usd, NULL::STRING creative_text, NULL::STRING audience WHERE FALSE';
  END IF;
  EXECUTE IMMEDIATE 'CREATE OR REPLACE VIEW CMO_DB.CORE.FUNNEL_FACT AS ' || body;
  RETURN 'FUNNEL_FACT rebuilt';
END;
$$;
