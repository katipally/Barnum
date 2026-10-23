-- Least-privilege roles and PII masking for CMO_DB. See docs/security.md.
-- Run as the owner role (ATTENDEE_ROLE). Additive and idempotent: nothing is revoked from the owner.
-- Re-run after adding a channel or a RAW_* table: new raw tables stay closed to the new roles until then.

CREATE ROLE IF NOT EXISTS CMO_READER    COMMENT = 'Agentic CMO: read CORE and channel views, semantic views, agents, MCP';
CREATE ROLE IF NOT EXISTS CMO_DECIDER   COMMENT = 'Agentic CMO: approve or reject memos through DECIDE_MEMO only';
CREATE ROLE IF NOT EXISTS CMO_PII_ADMIN COMMENT = 'Agentic CMO: sees personal columns unmasked';
GRANT ROLE CMO_READER  TO ROLE ATTENDEE_ROLE;
GRANT ROLE CMO_DECIDER TO ROLE ATTENDEE_ROLE;
-- PII admin goes to people, never to ATTENDEE_ROLE: owner's-rights procedures (ASK_CHANNEL) evaluate masking as their
-- owner, so an owner holding CMO_PII_ADMIN would unmask data for every caller, CMO_READER included.
GRANT ROLE CMO_PII_ADMIN TO USER "USER";

-- ---- CMO_READER ----------------------------------------------------------
GRANT USAGE ON WAREHOUSE CMO_WH TO ROLE CMO_READER;
GRANT USAGE ON DATABASE CMO_DB TO ROLE CMO_READER;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE CMO_READER;
GRANT USAGE ON SCHEMA CMO_DB.CORE TO ROLE CMO_READER;
GRANT SELECT ON ALL VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;  -- REBUILD_FUNNEL replaces FUNNEL_RAW
GRANT SELECT ON ALL SEMANTIC VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;
GRANT SELECT ON FUTURE SEMANTIC VIEWS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;
-- Decision tables the API lists; no future tables, so a CRM table landing in CORE is not exposed by default.
GRANT SELECT ON TABLE CMO_DB.CORE.ASSUMPTIONS      TO ROLE CMO_READER;
GRANT SELECT ON TABLE CMO_DB.CORE.CHANNEL_REGISTRY TO ROLE CMO_READER;
GRANT SELECT ON TABLE CMO_DB.CORE.ALLOCATION       TO ROLE CMO_READER;
GRANT SELECT ON TABLE CMO_DB.CORE.DECISION_LOG     TO ROLE CMO_READER;
GRANT SELECT ON TABLE CMO_DB.CORE.MAPPING_HISTORY  TO ROLE CMO_READER;
GRANT USAGE ON ALL FUNCTIONS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;  -- A, CHANNEL_STATS, LIST_CHANNELS, STATUS: read-only
GRANT USAGE ON FUTURE FUNCTIONS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;
-- CMO_AGENT tools. PROPOSE_REALLOCATION writes a memo through owner's rights and auto-applies only under AUTONOMY_LIMIT_PCT.
GRANT USAGE ON PROCEDURE CMO_DB.CORE.ASK_CHANNEL(VARCHAR, VARCHAR)     TO ROLE CMO_READER;
GRANT USAGE ON PROCEDURE CMO_DB.CORE.UNIT_ECON(FLOAT, VARCHAR)         TO ROLE CMO_READER;
GRANT USAGE ON PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(FLOAT)       TO ROLE CMO_READER;
GRANT USAGE ON AGENT CMO_DB.CORE.CMO_AGENT TO ROLE CMO_READER;
GRANT USAGE ON FUTURE AGENTS IN SCHEMA CMO_DB.CORE TO ROLE CMO_READER;  -- setup re-creates CMO_AGENT
GRANT USAGE ON MCP SERVER CMO_DB.CORE.CMO_MCP TO ROLE CMO_READER;

-- ---- CMO_DECIDER ---------------------------------------------------------
-- DECIDE_MEMO checks the memo is pending, then calls APPLY_MEMO with owner's rights. APPLY_MEMO itself is not granted:
-- it skips that check and would let a caller re-apply a rejected or superseded memo.
GRANT USAGE ON WAREHOUSE CMO_WH TO ROLE CMO_DECIDER;
GRANT USAGE ON DATABASE CMO_DB TO ROLE CMO_DECIDER;
GRANT USAGE ON SCHEMA CMO_DB.CORE TO ROLE CMO_DECIDER;
GRANT USAGE ON PROCEDURE CMO_DB.CORE.DECIDE_MEMO(VARCHAR, VARCHAR) TO ROLE CMO_DECIDER;

-- ---- Channel schemas: CMO_READER reads them, CMO_CHANNEL_<X> reads only its own -----------
EXECUTE IMMEDIATE $$
DECLARE
  c CURSOR FOR SELECT schema_name, 'CMO_CHANNEL_' || SUBSTR(schema_name, 4) AS role_name
               FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE STARTSWITH(schema_name, 'CH_');
  done ARRAY DEFAULT ARRAY_CONSTRUCT();
BEGIN
  FOR r IN c DO
    LET s STRING := 'CMO_DB.' || r.schema_name;
    LET role_name STRING := r.role_name;
    EXECUTE IMMEDIATE 'CREATE ROLE IF NOT EXISTS ' || role_name || ' COMMENT = ''Agentic CMO: ' || s || ' only''';
    EXECUTE IMMEDIATE 'GRANT ROLE ' || role_name || ' TO ROLE ATTENDEE_ROLE';
    EXECUTE IMMEDIATE 'GRANT USAGE ON WAREHOUSE CMO_WH TO ROLE ' || role_name;
    EXECUTE IMMEDIATE 'GRANT USAGE ON DATABASE CMO_DB TO ROLE ' || role_name;
    EXECUTE IMMEDIATE 'GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE ' || role_name;
    LET grantees ARRAY := ARRAY_CONSTRUCT('CMO_READER', role_name);
    FOR i IN 0 TO 1 DO
      LET who STRING := grantees[i];
      EXECUTE IMMEDIATE 'GRANT USAGE ON SCHEMA ' || s || ' TO ROLE ' || who;
      -- Cortex Analyst queries the RAW_* tables behind each channel SV. Existing tables only (masked below), so a
      -- new upload is not readable until this script has tagged and masked it.
      EXECUTE IMMEDIATE 'GRANT SELECT ON ALL TABLES IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT SELECT ON ALL VIEWS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT SELECT ON FUTURE VIEWS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT SELECT ON ALL SEMANTIC VIEWS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT SELECT ON FUTURE SEMANTIC VIEWS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT USAGE ON ALL FUNCTIONS IN SCHEMA ' || s || ' TO ROLE ' || who;     -- REPORT
      EXECUTE IMMEDIATE 'GRANT USAGE ON FUTURE FUNCTIONS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT USAGE ON ALL PROCEDURES IN SCHEMA ' || s || ' TO ROLE ' || who;    -- RECONCILE
      EXECUTE IMMEDIATE 'GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT USAGE ON ALL AGENTS IN SCHEMA ' || s || ' TO ROLE ' || who;
      EXECUTE IMMEDIATE 'GRANT USAGE ON FUTURE AGENTS IN SCHEMA ' || s || ' TO ROLE ' || who;
    END FOR;
    done := ARRAY_APPEND(done, role_name);
  END FOR;
  RETURN done;
END;
$$;

-- ---- Horizon tags and masking policies -----------------------------------
CREATE SCHEMA IF NOT EXISTS CMO_DB.GOVERNANCE COMMENT = 'Tags and masking policies';
CREATE TAG IF NOT EXISTS CMO_DB.GOVERNANCE.PII ALLOWED_VALUES 'email', 'name', 'phone', 'free_text'
  COMMENT = 'Personal data category';
CREATE TAG IF NOT EXISTS CMO_DB.GOVERNANCE.MASKING_EXEMPT
  COMMENT = 'Why a PII column is left unmasked: the funnel or a channel mapping depends on its raw value';

-- Bodies are fixed once attached; change them with ALTER MASKING POLICY ... SET BODY.
CREATE MASKING POLICY IF NOT EXISTS CMO_DB.GOVERNANCE.MASK_EMAIL AS (v STRING) RETURNS STRING ->
  CASE WHEN v IS NULL OR IS_ROLE_IN_SESSION('CMO_PII_ADMIN') THEN v
       ELSE REGEXP_REPLACE(v, '[^@\\s,;<>"]+@', '***@') END  -- keeps the company domain, also inside CC lists
  COMMENT = 'Local part of every address -> ***';
CREATE MASKING POLICY IF NOT EXISTS CMO_DB.GOVERNANCE.MASK_NAME AS (v STRING) RETURNS STRING ->
  CASE WHEN v IS NULL OR IS_ROLE_IN_SESSION('CMO_PII_ADMIN') THEN v ELSE '***' END;
CREATE MASKING POLICY IF NOT EXISTS CMO_DB.GOVERNANCE.MASK_TEXT AS (v STRING) RETURNS STRING ->
  CASE WHEN v IS NULL OR IS_ROLE_IN_SESSION('CMO_PII_ADMIN') THEN v ELSE '[masked ' || LENGTH(v) || ' chars]' END
  COMMENT = 'Email bodies and replies: names, signatures and phone numbers';

-- Tags every candidate column that exists. Masks it only when no view, procedure or function in CMO_DB names it
-- together with its table;
-- otherwise tags it MASKING_EXEMPT with the objects that depend on it. Semantic views are checked in docs/security.md.
EXECUTE IMMEDIATE $$
DECLARE
  c CURSOR FOR
    WITH cand (tschema, tname, col, category, policy) AS (SELECT * FROM VALUES
      ('CORE', 'RAW_CRM_LEADS', 'EMAIL', 'email', 'MASK_EMAIL'),
      ('CORE', 'RAW_CRM_LEADS', 'FIRST_NAME', 'name', 'MASK_NAME'),
      ('CORE', 'RAW_CRM_LEADS', 'LAST_NAME', 'name', 'MASK_NAME'),
      ('CORE', 'RAW_CRM_LEADS', 'PHONE', 'phone', 'MASK_NAME'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'TO_EMAIL', 'email', 'MASK_EMAIL'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'FROM_EMAIL', 'email', 'MASK_EMAIL'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'CC', 'email', 'MASK_EMAIL'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'BCC', 'email', 'MASK_EMAIL'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'TO_NAME', 'name', 'MASK_NAME'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'FROM_NAME', 'name', 'MASK_NAME'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'BODY_HTML', 'free_text', 'MASK_TEXT'),
      ('CH_OUTBOUND', 'RAW_DATASAUR_OUTBOUND_EMAILS', 'REPLY_MESSAGE', 'free_text', 'MASK_TEXT'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'TO_EMAIL', 'email', 'MASK_EMAIL'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'FROM_EMAIL', 'email', 'MASK_EMAIL'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'CC', 'email', 'MASK_EMAIL'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'TO_NAME', 'name', 'MASK_NAME'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'FROM_NAME', 'name', 'MASK_NAME'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'BODY_TEXT', 'free_text', 'MASK_TEXT'),
      ('CH_EMAIL_THREADS', 'RAW_DATASAUR_EMAIL_THREADS', 'BODY_HTML', 'free_text', 'MASK_TEXT')),
    present AS (
      SELECT cand.* FROM cand JOIN CMO_DB.INFORMATION_SCHEMA.COLUMNS i
        ON i.table_schema = cand.tschema AND i.table_name = cand.tname AND i.column_name = cand.col),
    defs AS (
      SELECT table_schema || '.' || table_name AS obj, view_definition AS def FROM CMO_DB.INFORMATION_SCHEMA.VIEWS
      WHERE table_schema <> 'INFORMATION_SCHEMA'
      UNION ALL SELECT procedure_schema || '.' || procedure_name, procedure_definition FROM CMO_DB.INFORMATION_SCHEMA.PROCEDURES
      UNION ALL SELECT function_schema || '.' || function_name, function_definition FROM CMO_DB.INFORMATION_SCHEMA.FUNCTIONS)
    SELECT p.tschema, p.tname, p.col, p.category, p.policy, LISTAGG(DISTINCT d.obj, ', ') AS used_by
    FROM present p LEFT JOIN defs d ON CONTAINS(UPPER(d.def), p.tname)
      AND REGEXP_LIKE(d.def, '.*(^|[^A-Za-z0-9_])' || p.col || '([^A-Za-z0-9_]|$).*', 'is')
    GROUP BY 1, 2, 3, 4, 5;
  report ARRAY DEFAULT ARRAY_CONSTRUCT();
BEGIN
  FOR r IN c DO
    LET target STRING := 'ALTER TABLE CMO_DB.' || r.tschema || '.' || r.tname || ' MODIFY COLUMN ' || r.col;
    EXECUTE IMMEDIATE target || ' SET TAG CMO_DB.GOVERNANCE.PII = ''' || r.category || '''';
    IF (COALESCE(r.used_by, '') = '') THEN
      EXECUTE IMMEDIATE target || ' SET MASKING POLICY CMO_DB.GOVERNANCE.' || r.policy || ' FORCE';
      EXECUTE IMMEDIATE target || ' UNSET TAG CMO_DB.GOVERNANCE.MASKING_EXEMPT';
      report := ARRAY_APPEND(report, r.tschema || '.' || r.tname || '.' || r.col || ': masked');
    ELSE
      BEGIN  -- a mapping started using a masked column: its raw value wins, or the funnel numbers would differ by role
        EXECUTE IMMEDIATE target || ' UNSET MASKING POLICY';
      EXCEPTION WHEN OTHER THEN NULL;  -- no policy attached
      END;
      EXECUTE IMMEDIATE target || ' SET TAG CMO_DB.GOVERNANCE.MASKING_EXEMPT = ''used by ' || LEFT(r.used_by, 240) || '''';
      report := ARRAY_APPEND(report, r.tschema || '.' || r.tname || '.' || r.col || ': unmasked, used by ' || r.used_by);
    END IF;
  END FOR;
  RETURN report;
END;
$$;
