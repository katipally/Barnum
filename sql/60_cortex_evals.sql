-- Cortex Agent evaluations for CMO_DB.CORE.CMO_AGENT: golden set, config stage, scorecard.
-- Additive only: everything lives in CMO_DB.EVALS. Run evals/cortex_eval.py to start a run and collect scores.
-- Expected answers come from the live data (CORE.CHANNEL_SUMMARY, EXEC_STRIP, UNIT_ECON) as of 2026-10-23,
-- not from the seed numbers in tests/test_numbers.py. Re-derive them if the channel data is reloaded.

CREATE SCHEMA IF NOT EXISTS CMO_DB.EVALS;

-- One row per question. ground_truth follows the Cortex Agent evaluation format:
-- ground_truth_output = rubric for answer_correctness, ground_truth_invocations = expected tools.
-- trap = what a wrong answer looks like; the custom metric no_invented_numbers checks it.
-- Expected tools follow the agent's own routing: a question about named channels goes to ask_channel,
-- cross-channel numbers to status, plans to unit_econ.
CREATE TABLE IF NOT EXISTS CMO_DB.EVALS.AGENT_GOLDEN (
  qid STRING,
  category STRING,
  input_query STRING,
  ground_truth VARIANT,
  trap STRING
);

-- Golden set v1: rebuilt on every run of this script so the dataset matches the file.
DELETE FROM CMO_DB.EVALS.AGENT_GOLDEN;

INSERT INTO CMO_DB.EVALS.AGENT_GOLDEN
SELECT column1, column2, column3, PARSE_JSON(column4), column5 FROM VALUES
('cps_google', 'cost_per_sql',
 'What is the cost per SQL for Google Ads?',
 '{"ground_truth_output": "Google Ads cost per SQL is about $915 (accept $880-$950). It is estimated: SQLs are 15% of 2,325 platform conversions (about 349 SQLs) on about $319K lifetime spend. Cost per MQL is about $137. The answer must say the SQLs are estimated, not measured.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'presents $915 as a measured number'),
('cps_linkedin', 'cost_per_sql',
 'What is the cost per SQL for LinkedIn Ads?',
 '{"ground_truth_output": "LinkedIn Ads cost per SQL is about $11,650 (accept $11,000-$12,300), estimated from 13 lead-form leads at the assumed 15% MQL-to-SQL rate (about 2 SQLs) on about $22.7K spend. Cost per MQL is about $1,748. The answer must flag that the sample is tiny and the SQLs are estimated.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'reports a cheap LinkedIn SQL or the seed figure $3,000'),
('cps_billboard', 'cost_per_sql',
 'What does an SQL from billboards cost us?',
 '{"ground_truth_output": "Billboards cost about $1,786 per SQL (accept $1,700-$1,870), estimated from 112 QR scans at the assumed 15% rate (about 17 SQLs) on $30,000 of flights between January and May 2026. Cost per MQL (per QR scan) is about $268.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'treats QR scans or impressions as SQLs'),
('cps_conferences', 'trap_unmeasured',
 'What is the cost per SQL for conferences?',
 '{"ground_truth_output": "Cost per SQL for conferences cannot be computed: the conference export records no spend. What is known: 87 contacts captured at 18 events, about 13 SQLs estimated at the 15% rate, and 34 estimated sales calls booked. A correct answer says spend is missing and does not give a dollar cost per SQL.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'invents a dollar figure, e.g. the seed value $1,714, or treats missing spend as $0'),
('cps_outbound', 'trap_unmeasured',
 'How much does an SQL from outbound email cost, and how many did it produce?',
 '{"ground_truth_output": "Outbound email has no recorded spend, so cost per SQL is not measurable. It produced 77 SQLs, which are measured (replied and stage Interested), from 86 MQLs and about 1,676 emails sent between February and October 2026. A correct answer gives 77 SQLs and says cost per SQL is unknown, not zero.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'calls outbound free ($0 per SQL) or invents a cost'),
('trap_linkedin', 'trap_linkedin',
 'Why not put more money into LinkedIn? Analysis only, do not create a memo.',
 '{"ground_truth_output": "Do not move money into LinkedIn. It is the most expensive paid channel per SQL: about $11,650 estimated, versus about $915 for Google and about $1,786 for billboards, and its marginal cost per SQL is about $22,400 because returns diminish. The estimate rests on only 13 leads, so the evidence is thin. A good answer may suggest fixing LinkedIn lead quality or measurement before spending more.", "ground_truth_invocations": [{"tool_name": "ask_channel"}]}',
 'recommends scaling LinkedIn, or judges it on clicks/impressions'),
('trap_linear', 'trap_linear',
 'Google has our cheapest SQLs. If we double Google spend, do we get double the SQLs? Analysis only, do not create a memo.',
 '{"ground_truth_output": "No. Returns diminish (response exponent 0.52), so doubling Google spend yields about 1.4x the SQLs, not 2x. The marginal cost per SQL for Google is about $1,760, roughly twice the average of about $915. The answer must not extrapolate linearly.", "ground_truth_invocations": [{"tool_name": "ask_channel", "tool_input": "{\\"channel_id\\": \\"google\\"}"}]}',
 'says doubling spend doubles SQLs'),
('status_exec', 'status',
 'Where do we stand overall? Give me the executive numbers.',
 '{"ground_truth_output": "Measured paid spend is about $372K across Google, LinkedIn and billboards; about 2,623 MQLs and about 458 SQLs, most of them estimated at the assumed 15% MQL-to-SQL rate; cost per MQL about $152, cost per SQL about $1,012, fully loaded CAC about $46,700, payback about 6.7 months, annual paid run rate about $173K. Conferences, outbound, SEO, GEO and email threads record no spend. The answer should say which numbers are estimated.", "ground_truth_invocations": [{"tool_name": "status"}]}',
 'presents estimated SQLs as measured'),
('plan_1m', 'plan',
 'What do we do with $1M next year if every customer must pay back within 12 months? Analysis only, do not create a memo.',
 '{"ground_truth_output": "Do not spend the full $1M on paid channels. Under the 12-month payback rule the plan allocates about $518K (Google about $399K, billboards $90K, LinkedIn about $28K) and leaves about $482K unallocated because each channel is capped at 3x its run rate. That buys about 289 SQLs and about 43 customers at an average CAC of about $52K and 7.4 months payback, but the last customers cost about $274K each and do not pay back; the payback ceiling is about $450K. The answer must say that part of the budget is unallocated rather than presenting it as spent.", "ground_truth_invocations": [{"tool_name": "unit_econ", "tool_input": "{\\"budget\\": 1000000, \\"rule\\": \\"12mo\\"}"}]}',
 'presents the full $1M as allocated or scales linearly'),
('plan_ceiling', 'plan',
 'How far can we scale paid spend and still pay back in year one?',
 '{"ground_truth_output": "About $450K a year is the ceiling: beyond that the last customer costs more than the $84K CAC that pays back in 12 months (it is CAC bound). At $250K every customer still pays back (avg CAC about $48K, payback about 6.9 months); at $500K the last customer no longer does.", "ground_truth_invocations": [{"tool_name": "unit_econ", "tool_input": "{\\"rule\\": \\"12mo\\"}"}]}',
 'gives no ceiling or a number not backed by unit_econ'),
('delegate_linkedin', 'delegation',
 'Ask the LinkedIn agent which campaign generated the most leads, and what it spent.',
 '{"ground_truth_output": "The LinkedIn campaign with the most leads is li_lead-gen_retargeting-engage_llm-labs: 10 of the 13 lead-form leads on about $3,294 spend (about $329 per lead). The next is li_llm-labs_lead-gen_prospecting_ABM with 3 leads on about $2,630. The answer should come from the LinkedIn channel agent.", "ground_truth_invocations": [{"tool_name": "ask_channel", "tool_input": "{\\"channel_id\\": \\"linkedin\\"}"}]}',
 'answers without delegating, or names a video-views campaign'),
('nonpaid_judging', 'native_metrics',
 'Which channels have no spend data, and how should we judge them instead?',
 '{"ground_truth_output": "Conferences, outbound email, SEO, GEO and email reply threads record no spend. Judge them on their own outcomes: outbound on 77 measured SQLs from about 1,676 emails, conferences on 87 contacts and 34 estimated sales calls booked, SEO on about 12,462 search clicks, GEO on 79 brand mentions in 240 AI answers, email threads on 130 positive meeting replies. Their cost per SQL is unknown, not zero.", "ground_truth_invocations": [{"tool_name": "status"}]}',
 'calls the unmeasured channels free or ranks them on cost per SQL');

-- Config stage for the evaluation YAML (CSV with no delimiter so the YAML is read as-is, per the docs).
CREATE FILE FORMAT IF NOT EXISTS CMO_DB.EVALS.YAML_FMT
  TYPE = 'CSV' FIELD_DELIMITER = NONE RECORD_DELIMITER = '\n' SKIP_HEADER = 0
  FIELD_OPTIONALLY_ENCLOSED_BY = NONE ESCAPE_UNENCLOSED_FIELD = NONE;

CREATE STAGE IF NOT EXISTS CMO_DB.EVALS.EVAL_CONFIG FILE_FORMAT = CMO_DB.EVALS.YAML_FMT;

-- Scorecard: one row per run, question and metric. Filled by evals/cortex_eval.py from
-- SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA (source = 'cortex_eval'), or by its fallback judge
-- (source = 'sql_judge') when Cortex Agent evaluations are not available. For sql_judge rows record_id is the
-- agent request id and thread_id the agent thread, so each row joins to its trace in GET_AI_OBSERVABILITY_EVENTS.
CREATE TABLE IF NOT EXISTS CMO_DB.EVALS.AGENT_SCORECARD (
  run_name STRING,
  source STRING,
  qid STRING,
  category STRING,
  input_query STRING,
  metric_name STRING,
  score FLOAT,
  passed BOOLEAN,
  explanation STRING,
  output STRING,
  duration_ms NUMBER,
  record_id STRING,
  scored_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);
ALTER TABLE CMO_DB.EVALS.AGENT_SCORECARD ADD COLUMN IF NOT EXISTS thread_id NUMBER;
ALTER TABLE CMO_DB.EVALS.AGENT_SCORECARD ADD COLUMN IF NOT EXISTS tools VARIANT;

-- Pass rate per run: a question passes when every scored metric for it passes.
CREATE OR REPLACE VIEW CMO_DB.EVALS.AGENT_SCORECARD_SUMMARY AS
WITH q AS (
  SELECT run_name, source, qid, category, BOOLAND_AGG(passed) AS passed, MIN(scored_at) AS scored_at
  FROM CMO_DB.EVALS.AGENT_SCORECARD WHERE passed IS NOT NULL
  GROUP BY 1, 2, 3, 4
)
SELECT run_name, source, MIN(scored_at) AS scored_at, COUNT(*) AS questions, COUNT_IF(passed) AS passed,
       ROUND(COUNT_IF(passed) / COUNT(*), 2) AS pass_rate,
       ARRAY_AGG(IFF(passed, NULL, qid)) WITHIN GROUP (ORDER BY qid) AS failed
FROM q GROUP BY 1, 2;

-- Start a run by hand in a worksheet (evals/cortex_eval.py does this and uploads the YAML):
--   USE SCHEMA CMO_DB.EVALS;
--   CALL EXECUTE_AI_EVALUATION('START', OBJECT_CONSTRUCT('run_name', 'golden-v1-manual'), '@CMO_DB.EVALS.EVAL_CONFIG/cmo_agent_eval.yaml');
--   CALL EXECUTE_AI_EVALUATION('STATUS', OBJECT_CONSTRUCT('run_name', 'golden-v1-manual'), '@CMO_DB.EVALS.EVAL_CONFIG/cmo_agent_eval.yaml');
--   SELECT * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT', 'golden-v1-manual'));
