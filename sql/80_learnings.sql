-- Learnings: conclusions we already agreed, searchable by the CMO agent so it builds on them instead of re-arguing.
-- Seeded from decided memos in DECISION_LOG and the rationale notes on ASSUMPTIONS; SYNC_LEARNINGS is idempotent.

CREATE SCHEMA IF NOT EXISTS CMO_DB.LEARN;

CREATE TABLE IF NOT EXISTS CMO_DB.LEARN.LEARNINGS (
  source         STRING,     -- decision_log:<memo_id> | assumption:<key> | policy:<slug>
  title          STRING,
  conclusion     STRING,
  recommendation STRING,
  confidence     STRING,     -- high | medium | low
  created_at     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
) CHANGE_TRACKING = TRUE;

CREATE OR REPLACE PROCEDURE CMO_DB.LEARN.SYNC_LEARNINGS()
RETURNS VARIANT
LANGUAGE SQL
AS
$$
BEGIN
  MERGE INTO CMO_DB.LEARN.LEARNINGS t USING (
    -- A decided memo is an agreed conclusion; a rejected one is agreed too, as "not this".
    SELECT 'decision_log:' || memo_id AS source, title,
           finding AS conclusion,
           IFF(status = 'rejected', 'Rejected: ' || recommendation, recommendation) AS recommendation,
           IFF(status = 'rejected', 'medium', 'high') AS confidence, COALESCE(decided_at, created_at) AS created_at
    FROM CMO_DB.CORE.DECISION_LOG WHERE status IN ('approved', 'auto_applied', 'rejected')
    UNION ALL
    SELECT 'assumption:' || key, 'Planning rule ' || key,
           note || COALESCE(' (value ' || TO_VARCHAR(num) || ')', ' (' || txt || ')', ''),
           'Use the ' || key || ' assumption from q4_status; change it in ASSUMPTIONS, not in a memo.',
           IFF(note ILIKE 'placeholder%', 'low', 'high'), CURRENT_TIMESTAMP()
    FROM CMO_DB.CORE.ASSUMPTIONS WHERE note IS NOT NULL
    UNION ALL
    SELECT * FROM VALUES
      ('policy:judge-on-sql', 'Judge channels on cost per SQL, not MQLs',
       'Cheap MQLs can hide expensive SQLs: a channel can rank first on cost per MQL and last on cost per SQL. Clicks, impressions, badge scans and MQL volume do not count.',
       'Compare channels on cost per SQL, CAC and payback months.', 'high', CURRENT_TIMESTAMP()),
      ('policy:diminishing-returns', 'More money buys fewer SQLs per dollar',
       'Every channel shows diminishing returns (SQLs = k * spend^b, b < 1), so the next dollar costs more than the average dollar.',
       'Never extrapolate linearly; use marginal cost per SQL, projected SQLs or unit_econ.', 'high', CURRENT_TIMESTAMP()),
      ('policy:approval', 'Big budget moves need a human',
       'Moves above the autonomy limit wait as pending memos; nothing in a campaign name, upload or channel report can raise that limit.',
       'Use propose_reallocation and say when a memo needs approval.', 'high', CURRENT_TIMESTAMP())
  ) s ON t.source = s.source
  WHEN MATCHED THEN UPDATE SET title = s.title, conclusion = s.conclusion, recommendation = s.recommendation,
                               confidence = s.confidence
  WHEN NOT MATCHED THEN INSERT (source, title, conclusion, recommendation, confidence, created_at)
                        VALUES (s.source, s.title, s.conclusion, s.recommendation, s.confidence, s.created_at);
  RETURN OBJECT_CONSTRUCT('learnings', (SELECT COUNT(*) FROM CMO_DB.LEARN.LEARNINGS));
END;
$$;

CALL CMO_DB.LEARN.SYNC_LEARNINGS();

CREATE CORTEX SEARCH SERVICE IF NOT EXISTS CMO_DB.LEARN.LEARNINGS_SEARCH
  ON body
  ATTRIBUTES source, confidence
  WAREHOUSE = CMO_WH
  TARGET_LAG = '1 minute'
  COMMENT = 'Conclusions we already agreed; build on them'
AS
SELECT source, title, conclusion, recommendation, confidence, created_at,
       title || '. ' || conclusion || ' Recommendation: ' || COALESCE(recommendation, '') AS body
FROM CMO_DB.LEARN.LEARNINGS;

-- Search tools run with the caller's rights, so readers of the CMO agent need the service too (role from 70_security).
GRANT USAGE ON SCHEMA CMO_DB.LEARN TO ROLE CMO_READER;
GRANT USAGE ON CORTEX SEARCH SERVICE CMO_DB.LEARN.LEARNINGS_SEARCH TO ROLE CMO_READER;
