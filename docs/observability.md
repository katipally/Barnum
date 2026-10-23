# Evals and observability in Snowflake

Where to see the CMO agent's work in Snowsight, and the SQL behind each view. Checked live on 2026-10-23 with role
`ATTENDEE_ROLE` (owner of every agent). Snowsight click paths follow the Snowflake docs; they were not clicked through
in the UI for this write-up.

## What you can screenshot today

| View | Status | Where |
|---|---|---|
| Thread list, trace waterfall, tool calls, feedback for `CMO_AGENT` | works | Agents > CMO_AGENT > Observability |
| The same per channel agent (`CH_<X>.AGENT`) | works | Agents > (channel) AGENT > Observability |
| CMO-to-channel delegation in one table | works (SQL) | query 3 below |
| Golden-set scorecard (12 questions, 9-10 pass per run) | works (SQL judge) | `CMO_DB.EVALS.AGENT_SCORECARD_SUMMARY` |
| Eval verdicts on the agent's own threads (thumbs up/down) | works | Agents > CMO_AGENT > Observability, threads from `golden_eval` |
| Cortex Agent evaluations (Evaluations tab) | **blocked: missing privilege** | see "Evaluations" |
| Tool inputs/outputs and question text in traces | **redacted for this role** | see "Gotchas" |

## The runs to look for

**Re-creating an agent wipes its Observability history.** `CMO_AGENT` was re-created by another session at
15:53:17 PDT, and every earlier trace and feedback event disappeared from it (the channel agents, created at 15:09,
kept theirs). The ids below are from after that reset. **Freeze agent deploys before taking screenshots**, and if the
agent is re-created again, re-run one `/ask` and `uv run python -m evals.cortex_eval` to repopulate it.

**`/ask`** at 15:54:50 PDT (22:54:50 UTC), 53.7 s, question: *"Ask the LinkedIn and Google channel agents for their
cost per lead and best campaign, then tell me which deserves the next $10k. Analysis only, no memo."*

- CMO trace `01c7ee7efd74fa7c32b8556e388ce5a1`, request id `aa27b165-78ce-4b1d-b2fc-7122c2da5502`
- Planning 2.9 s, then **two `ask_channel` calls started at the same millisecond** (31.1 s and 33.3 s), then a
  FunnelData check and the answer
- Delegated runs: LinkedIn agent trace `01c7ee7efcaffd2714e46b6c31e8b0f8` (26.9 s),
  Google agent trace `01c7ee7e19647e14a80b3c1708138bdd` (25.0 s)

This is the screenshot of CMO-to-channel delegation: the CMO's trace shows the parallel `ToolCall-ask_channel`
spans, and each channel agent has its own trace in its own Observability pane at the same time.

**Golden-set run `golden-v5`** at 15:55-15:57 PDT: 12 threads with origin `golden_eval`, one per question, each with
a feedback event (thumbs up = pass) whose categories are `golden_eval` and the question id.

**`/q4/review`** at 15:17:33 PDT (22:17:33 UTC). The review fans out from the backend straight to all 8 channel agents
over REST (not through `ask_channel`), so it shows up as 8 parallel traces, one per channel agent, all starting at
22:17:35 UTC (13.6–23.6 s each): billboard `01c7ee59bb7a9d089044728fa9fe2be5`, conferences
`01c7ee5932356ae1486076107ffe7cc2`, geo `01c7ee5928c042886191e7fea0d8b8dc`, google `01c7ee591077fc1d0a619ccb41046eff`,
linkedin `01c7ee59bc8265f2d0c6491ae9168dcc`, outbound `01c7ee59c140567f6aee5288d45c61e1`, seo
`01c7ee59f9ef33a9f23675f69b76479a`, plus email_threads. These survived the reset because the channel agents weren't
re-created. The review then **failed** at the reallocation step
(`Invalid argument types for function 'PROPOSE_REALLOCATION': ()`: `backend/app/queries.py` calls it with no argument,
the live procedure takes `(FLOAT)`), so there is no CMO memo trace for it.

## Snowsight click paths

Before you start: user menu (bottom left) > **Switch role** > `ATTENDEE_ROLE`. Observability needs OWNERSHIP or
MONITOR on the agent, which this role has.

**CMO threads and traces**
1. **AI & ML** > **Agents**.
2. Click **Agentic CMO** (`CMO_DB.CORE.CMO_AGENT`).
3. Open the **Observability** pane (some Snowsight versions label it **Monitoring**).
4. The thread list shows one row per thread: first input, feedback, length, user, last updated. Sort by last updated
   and find the row at 15:54 PDT (the `/ask` above). The 12 rows at 15:55-15:57 are the golden-set questions, each
   with the eval's thumbs up or down in the feedback column.
5. Click it to open the **trace view**: the waterfall shows `ReasoningAgentStepPlanning-0`, two
   `ToolCall-ask_channel` spans side by side (parallel delegation), each with its `SqlExecution` child (the
   `ASK_CHANNEL` procedure call), then `ReasoningAgentStepResponseGeneration-1`. Click a span for its duration,
   status and query id.

**The channel side of the same delegation**
1. **AI & ML** > **Agents** > **LinkedIn Ads agent** (`CMO_DB.CH_LINKEDIN.AGENT`) > **Observability**.
2. Open the request at 15:54:53 PDT. Its trace shows the channel agent's own planning, `SemanticContextTool_ChannelData`
   and `SqlExecution` spans.
3. Repeat for **Google Ads agent** (`CMO_DB.CH_GOOGLE.AGENT`). For a side-by-side screenshot, open the CMO trace and
   the two channel traces in three browser tabs.

**Review fan-out**: open any channel agent's Observability pane and pick the request at 15:17:35 PDT; all 8 agents
have one at the same second.

**Feedback**: the thread list's feedback column, or query 4 below. The demo's approve/reject buttons send feedback with
categories `ceo_decision` + `memo_approved` / `memo_rejected`.

**Evaluations** (after the privilege fix below): **AI & ML** > **Agents** > **Agentic CMO** > **Evaluations** >
**Create evaluation run** > **Run an evaluation manually** > name it > **Next** > choose the existing dataset
`CMO_GOLDEN_191FEDBA` > **Next** > input column `INPUT_QUERY`, enable *Answer correctness*, *Logical consistency* and
*Tool selection accuracy* with ground truth column `GROUND_TRUTH`, optionally the custom metric from
`@CMO_DB.EVALS.EVAL_CONFIG/cmo_agent_eval.yaml` > **Create**. Open the run for per-question scores; **Compare** puts up to
three runs side by side. Or run `uv run python -m evals.cortex_eval`, which starts the same run from SQL and then
shows up in this tab.

## Evaluations

**Cortex Agent evaluations are blocked on this account.** `EXECUTE_AI_EVALUATION('START', ...)` fails with:

```
210007 (P0000): User Error Report: Failed to create evaluation task in schema '"CMO_DB"."EVALS"'.
Ensure your role has CREATE TASK ON SCHEMA and EXECUTE TASK ON ACCOUNT privileges.
Cannot execute task , EXECUTE TASK privilege must be granted to owner role in function EXECUTE_AI_EVALUATION
```

`ATTENDEE_ROLE` lacks `EXECUTE TASK ON ACCOUNT`. Everything else is in place: the golden set table, the dataset
`CMO_DB.EVALS.CMO_GOLDEN_191FEDBA` (created by that first call), and the YAML config on `@CMO_DB.EVALS.EVAL_CONFIG`.
To unblock, as ACCOUNTADMIN:

```sql
GRANT EXECUTE TASK ON ACCOUNT TO ROLE ATTENDEE_ROLE;
```

then `uv run python -m evals.cortex_eval`. It scores four metrics: `answer_correctness` (v3), `logical_consistency` (v3),
`tool_selection_accuracy`, and a custom `no_invented_numbers` judge (claude-sonnet-4-6) that fails any answer that puts
a dollar figure on something not measured. The result-collection step (`GET_AI_EVALUATION_DATA` into the scorecard)
follows the documented columns but has not run yet.

**Fallback (what runs today):** `uv run python -m evals.cortex_eval` tries the native evaluation first and falls back
automatically when the role lacks EXECUTE TASK. The fallback scores the same metrics without a task:

- each golden question runs against the live `CMO_AGENT` in its own thread (origin `golden_eval`) over the Agent Run
  REST API, 4 at a time, keeping the request id, thread id, tool calls and tool results;
- one `AI_COMPLETE` call (claude-sonnet-4-6) scores `answer_correctness` (vs. the expected answer),
  `logical_consistency` (reference-free) and `no_invented_numbers` (vs. the expected answer and the tool results);
- `tool_selection_accuracy` uses the native formula (matched / max(expected, called), on distinct tool names);
- `no_write_tools` fails any run that called `propose_reallocation`;
- a question passes when `answer_correctness`, `no_invented_numbers` and `no_write_tools` all score >= 0.8
  (Snowsight's "high" bucket); logical consistency and tool selection are reported, not gating;
- the verdict goes back to the agent as feedback on that request (`--no-feedback` turns it off), and every row lands
  in `CMO_DB.EVALS.AGENT_SCORECARD` with `record_id` = request id, so it joins to the trace.

Results with the final judge prompt:

| Question | `golden-v4` | `golden-v5` | Read |
|---|---|---|---|
| cps_google | FAIL (0.70 no_invented) | PASS | judge noise: flagged "$319,222" for rounding $319,222.26 |
| cps_linkedin, cps_outbound, cps_conferences, cps_billboard, delegate_linkedin | PASS | PASS | stable |
| trap_linkedin | PASS | PASS | stable |
| plan_1m, plan_ceiling | PASS | PASS | stable |
| status_exec | PASS | FAIL (0.75 no_invented) | borderline: presents derived ARR and SQL targets without flagging them |
| trap_linear | FAIL (0.70 no_invented) | FAIL (0.72 correctness) | **real, flaky**: see below |
| nonpaid_judging | FAIL (0.50 correctness) | PASS (0.88) | **real, flaky**: often names the right metrics but quotes no numbers |
| **pass rate** | **9/12** | **10/12** | |

Findings worth acting on:
- **trap_linear: annual vs lifetime mix-up.** In `golden-v2` the agent said doubling Google spend gives ~20% more
  SQLs: it combined lifetime SQLs (348) with annual spend ($133K). The right figure is 145 → 209 SQLs a year (1.4x).
  Later runs avoid the mix-up but don't state the 1.4x, and one quoted an unsupported "$1,200 or more".
- **nonpaid_judging: no numbers.** The agent answers from `list_channels` alone and describes what each channel
  measures, without the outcomes (77 outbound SQLs, 12,462 SEO clicks, 79 GEO mentions). The prompt nudge "judge the
  others on their own native outcomes" doesn't make it look them up.
- **Planning notes leak into the answer.** Answers start with the agent's own notes, e.g. *"Use FunnelData quickly, or
  ask_channel... guess google_ads?"*: the agent returns a text item before its tool call, and both the backend and this
  harness join all text items. The same appears in channel-agent replies during `/q4/review` ("Full review: call
  report, reconcile, then ChannelData.").
- **Length:** most answers run 150-270 words against the agent's own ~150-word instruction. No metric gates this.
- Run-to-run variance is about one question either way, from both agent and judge. Compare runs, not single scores.

Earlier runs, kept for the record: `golden-v1-judge` (12/12, correctness only, before the other metrics existed),
`golden-v2` (7/12, judge saw tool results cut at 1,500 characters and flagged real numbers as invented), `golden-v3`
(9/12, still cut at 8,000; `status` returns 11,326 characters). `CORE.DECISION_LOG` gained two memos during
`golden-v2` (15:43 PDT, one auto-applied); no golden run called a write tool, so they came from another session.

```sql
SELECT * FROM CMO_DB.EVALS.AGENT_SCORECARD_SUMMARY ORDER BY scored_at DESC;          -- pass rate per run
SELECT qid, category, metric_name, score, passed, explanation, output
FROM CMO_DB.EVALS.AGENT_SCORECARD WHERE run_name = 'golden-v5-judge' ORDER BY qid;   -- per question, with the answer
SELECT qid, input_query, ground_truth:ground_truth_output::STRING AS expected, trap
FROM CMO_DB.EVALS.AGENT_GOLDEN ORDER BY qid;                                          -- the golden set
```

## SQL: traces

All of these read `SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS(db, schema, agent, 'CORTEX AGENT')`, the table behind
the Observability pane. Timestamps are UTC. Each was run against the live account.

**1. Recent CMO turns with the tools each one used**

```sql
SELECT r.start_timestamp                                                         AS started_utc,
       r.trace:trace_id::STRING                                                  AS trace_id,
       r.record_attributes:"snow.ai.observability.agent.request_id"::STRING      AS request_id,
       r.record_attributes:"snow.ai.observability.agent.thread_id"::NUMBER       AS thread_id,
       ROUND(r.record_attributes:"snow.ai.observability.agent.duration" / 1000, 1) AS seconds,
       r.record_attributes:"snow.ai.observability.agent.status"::STRING          AS status,
       ARRAY_AGG(DISTINCT t.record:name::STRING) WITHIN GROUP (ORDER BY t.record:name::STRING) AS tool_spans
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT')) r
LEFT JOIN TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT')) t
  ON t.trace:trace_id = r.trace:trace_id
 AND (t.record:name::STRING LIKE 'ToolCall-%' OR t.record:name::STRING LIKE 'SemanticContextTool_%')
WHERE r.record:name::STRING = 'AgentV2RequestResponseInfo'
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY started_utc DESC
LIMIT 20;
```

**2. Waterfall of one turn** (the `/ask` above; swap in any trace id from query 1, or join `AGENT_SCORECARD.record_id`
to `snow.ai.observability.agent.request_id` to open a golden-set question's trace)

```sql
SELECT record:name::STRING                                AS span,
       start_timestamp                                    AS started_utc,
       DATEDIFF('ms', start_timestamp, timestamp)         AS ms,
       trace:span_id::STRING                              AS span_id,
       record:parent_span_id::STRING                      AS parent_span_id,
       COALESCE(record_attributes:"snow.ai.observability.agent.tool.custom_tool.status",
                record_attributes:"snow.ai.observability.agent.tool.sql_execution.status")::STRING AS status,
       record_attributes:"snow.ai.observability.agent.tool.sql_execution.query_id"::STRING        AS query_id
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT'))
WHERE trace:trace_id::STRING = '01c7ee7efd74fa7c32b8556e388ce5a1'
ORDER BY start_timestamp, span;
```

**3. Delegation map: each CMO turn and the channel-agent runs it caused.** The CMO's `ToolCall-ask_channel` span
and the channel agent's request run in the same Snowflake session (`ASK_CHANNEL` calls `DATA_AGENT_RUN` inside it),
so session id plus time window links them exactly across concurrent turns. Parallel calls within one turn share the
session, so the result is rolled up per CMO turn.

```sql
WITH cmo AS (
  SELECT trace:trace_id::STRING AS cmo_trace, start_timestamp, timestamp AS end_ts,
         resource_attributes:"snow.session.id"::NUMBER AS session_id
  FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT'))
  WHERE record:name::STRING = 'ToolCall-ask_channel'
), channel_events AS (
            SELECT 'billboard'     AS channel, * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_BILLBOARD',     'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'conferences',             * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_CONFERENCES',   'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'email_threads',           * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_EMAIL_THREADS', 'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'geo',                     * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_GEO',           'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'google',                  * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_GOOGLE',        'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'linkedin',                * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_LINKEDIN',      'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'outbound',                * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_OUTBOUND',      'AGENT', 'CORTEX AGENT'))
  UNION ALL SELECT 'seo',                     * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CH_SEO',           'AGENT', 'CORTEX AGENT'))
), channel AS (
  SELECT channel, trace:trace_id::STRING AS channel_trace, start_timestamp,
         DATEDIFF('ms', start_timestamp, timestamp) AS ms,
         resource_attributes:"snow.session.id"::NUMBER AS session_id
  FROM channel_events WHERE record:name::STRING = 'AgentV2RequestResponseInfo'
)
SELECT c.cmo_trace,
       MIN(c.start_timestamp)                                                   AS delegated_at_utc,
       COUNT(DISTINCT ch.channel)                                               AS channels,
       ARRAY_AGG(DISTINCT OBJECT_CONSTRUCT('channel', ch.channel, 'trace', ch.channel_trace, 'seconds', ROUND(ch.ms / 1000, 1))) AS channel_runs
FROM cmo c
JOIN channel ch ON ch.session_id = c.session_id AND ch.start_timestamp BETWEEN c.start_timestamp AND c.end_ts
GROUP BY 1
ORDER BY delegated_at_utc DESC
LIMIT 20;
```

For the `/q4/review` fan-out (no CMO span, the backend calls the agents directly), drop the join and filter
`channel` on `start_timestamp BETWEEN '2026-10-23 22:17:33' AND '2026-10-23 22:18:00'`.

**4. Feedback**

```sql
SELECT timestamp                                                   AS at_utc,
       record_attributes:"snow.ai.observability.user.name"::STRING AS user_name,
       value:categories                                            AS categories,
       value                                                       AS feedback
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT'))
WHERE record:name::STRING = 'CORTEX_AGENT_FEEDBACK'
ORDER BY timestamp DESC;
```

**5. Tool-call latency and errors** (on 2026-10-23: `ask_channel` median 23.8 s, everything else under 4 s)

```sql
SELECT record:name::STRING                                                AS span,
       COUNT(*)                                                           AS calls,
       ROUND(MEDIAN(DATEDIFF('ms', start_timestamp, timestamp)) / 1000, 1) AS median_s,
       ROUND(MAX(DATEDIFF('ms', start_timestamp, timestamp)) / 1000, 1)    AS max_s,
       COUNT_IF(record:status:code::STRING <> 'STATUS_CODE_OK')           AS errors
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT'))
WHERE record_type = 'SPAN' AND (record:name::STRING LIKE 'ToolCall-%' OR record:name::STRING LIKE 'SemanticContextTool_%')
GROUP BY 1
ORDER BY calls DESC;
```

**6. Requests and tokens per hour**

```sql
SELECT DATE_TRUNC('hour', timestamp)                                                AS hour_utc,
       COUNT(*)                                                                     AS requests,
       SUM(record_attributes:"snow.ai.observability.token_count.total"::NUMBER)     AS tokens,
       ROUND(AVG(value:"snow.ai.observability.response_time_ms"::NUMBER) / 1000, 1) AS avg_first_response_s
FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS('CMO_DB', 'CORE', 'CMO_AGENT', 'CORTEX AGENT'))
WHERE record:name::STRING = 'CORTEX_AGENT_REQUEST'
GROUP BY 1 ORDER BY 1 DESC;
```

Span and event names seen in the CMO's events: `CORTEX_AGENT_REQUEST`, `CORTEX_AGENT_FEEDBACK` (events);
`Agent`, `AgentV2RequestResponseInfo` (root, carries request id, thread id, duration, status, suggested follow-ups),
`ReasoningAgentStepPlanning-N`, `ReasoningAgentStepResponseGeneration-N`, `ToolCall-<tool>`, `SqlExecution`,
`SemanticContextTool_FunnelData`, `LLM Suggested Queries` (spans).

## Gotchas

- **Re-creating an agent resets its history** (confirmed 15:53 PDT, see "The runs to look for"). The raw table
  `SNOWFLAKE.LOCAL.AI_OBSERVABILITY_EVENTS` isn't readable by `ATTENDEE_ROLE`, so lost traces can't be recovered.
- **Content is redacted for `ATTENDEE_ROLE`.** Spans show tool names, argument names, durations, status, query ids and
  token counts, but not the question, the answer or tool argument values. To see them (this changes an account
  privilege, so it's the account owner's call), as ACCOUNTADMIN:
  `GRANT READ UNREDACTED AI OBSERVABILITY EVENTS TABLE ON ACCOUNT TO ROLE ATTENDEE_ROLE;`
  (privilege name from the docs; this statement was not run).
  The answers themselves are in `EVALS.AGENT_SCORECARD.output` for the golden set.
- **AI Observability for external apps** (TruLens SDK, `EXTERNAL AGENT`) is not set up. For Cortex Agents, the
  Observability pane and Evaluations tab above are the AI Observability UI, over the same event table.
- `/q4/review` calls the channel agents directly, `/ask` goes through the CMO's `ask_channel` tool. Only `/ask` shows
  delegation inside the CMO's own trace.
