-- Decisions: the executive strip, the plan projection, the reallocation memo, approve / reject.
-- Budget-bought channels have measured spend and SQLs (measured or estimated). Their response curve, annualized
-- from each channel's own data window: SQLs_c(y) = S_c * (y / X_c) ^ b_c.

-- Planned annual spend per budget-bought channel: approved plan, else the current annual run rate.
CREATE OR REPLACE VIEW CMO_DB.CORE.PLAN_PROJECTION AS
SELECT channel_id, display_name, annual_spend_usd, annual_sqls, sqls_estimated, response_exponent,
       COALESCE(plan_usd, annual_spend_usd) AS planned_usd,
       annual_sqls * POWER(COALESCE(plan_usd, annual_spend_usd) / annual_spend_usd, response_exponent) AS projected_sqls
FROM CMO_DB.CORE.CHANNEL_SUMMARY
WHERE annual_spend_usd > 0 AND annual_sqls > 0;

-- Five headline numbers. Cost metrics cover only channels whose spend is measured.
-- Reads CHANNEL_SUMMARY once: each extra reference re-expands the whole funnel view stack and costs seconds of compile time.
CREATE OR REPLACE VIEW CMO_DB.CORE.EXEC_STRIP AS
WITH s AS (SELECT * FROM CMO_DB.CORE.CHANNEL_SUMMARY),
t AS (
  SELECT SUM(spend_usd)                                                  AS measured_spend_usd,
         SUM(annual_spend_usd)                                           AS annual_run_rate_usd,
         SUM(mqls)                                                       AS mqls,
         SUM(sqls)                                                       AS sqls,
         SUM(IFF(spend_usd IS NOT NULL, mqls, NULL))                     AS paid_mqls,
         SUM(IFF(spend_usd IS NOT NULL, sqls, NULL))                     AS paid_sqls,
         BOOLOR_AGG(IFF(spend_usd IS NOT NULL, sqls_estimated, NULL))    AS sqls_estimated,
         ARRAY_AGG(IFF(spend_usd IS NULL, channel_id, NULL))             AS channels_without_spend,
         SUM(IFF(annual_spend_usd > 0 AND annual_sqls > 0,
                 annual_sqls * POWER(COALESCE(plan_usd, annual_spend_usd) / annual_spend_usd, response_exponent), NULL)) AS plan_projected_sqls,
         SUM(IFF(annual_spend_usd > 0 AND annual_sqls > 0, COALESCE(plan_usd, annual_spend_usd), NULL)) AS plan_budget_usd
  FROM s
)
SELECT measured_spend_usd, annual_run_rate_usd, mqls, sqls,
       measured_spend_usd / NULLIF(paid_mqls, 0)                           AS cost_per_mql,
       measured_spend_usd / NULLIF(paid_sqls, 0)                           AS cost_per_sql,
       cost_per_sql / CMO_DB.CORE.A('SQL_TO_WON')                          AS cac_media_usd,
       cac_media_usd + CMO_DB.CORE.A('SALES_COST_PER_WON')                 AS cac_full_usd,
       cac_full_usd / (CMO_DB.CORE.A('ACV_USD') * CMO_DB.CORE.A('GROSS_MARGIN') / 12) AS payback_months,
       sqls_estimated,
       r.rate                                                              AS mql_to_sql_rate,
       r.source                                                            AS mql_to_sql_source,
       channels_without_spend, plan_projected_sqls, plan_budget_usd
FROM t CROSS JOIN CMO_DB.CORE.MQL_TO_SQL_RATE r;

-- Optimize a budget across budget-bought channels on SQLs. BUDGET NULL = current annual run rate (pure mix change).
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(BUDGET FLOAT)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
import heapq
import json
import uuid

EVIDENCE_SQL = """SELECT channel_id, spend_usd, mqls, sqls, sqls_estimated, ROUND(cost_per_mql) cost_per_mql,
       ROUND(cost_per_sql) cost_per_sql, ROUND(annual_spend_usd) annual_spend_usd, window_start, window_end
FROM CMO_DB.CORE.CHANNEL_SUMMARY ORDER BY cost_per_sql NULLS LAST"""


def run(session, budget):
    a = {r["KEY"]: r["NUM"] for r in session.sql("SELECT key, num FROM CMO_DB.CORE.ASSUMPTIONS").collect()}
    rows = [r.as_dict() for r in session.sql("SELECT * FROM CMO_DB.CORE.CHANNEL_SUMMARY").collect()]
    ch = {r["CHANNEL_ID"]: r for r in rows if r["ANNUAL_SPEND_USD"] and r["SQLS"]}
    if len(ch) < 2:
        return {"error": "need at least two channels with measured spend and SQLs to reallocate"}
    f = lambda c, y: ch[c]["ANNUAL_SQLS"] * (y / ch[c]["ANNUAL_SPEND_USD"]) ** ch[c]["RESPONSE_EXPONENT"] if y > 0 else 0.0
    step = float(a["PLANNING_STEP_USD"])
    run_rate = sum(r["ANNUAL_SPEND_USD"] for r in ch.values())
    budget = float(budget) if budget else run_rate
    current = {c: r["ANNUAL_SPEND_USD"] * budget / run_rate for c, r in ch.items()}  # today's mix at this budget
    rec = {c: min(float(a.get(f"MIN_SHARE:{c}") or 0) * budget, budget) for c in ch}
    left = budget - sum(rec.values())
    heap = [(-(f(c, rec[c] + step) - f(c, rec[c])), c) for c in ch]
    heapq.heapify(heap)
    while left >= step:  # O((B/step) log C); concave curves make greedy optimal
        _, c = heapq.heappop(heap)
        rec[c] += step
        left -= step
        heapq.heappush(heap, (-(f(c, rec[c] + step) - f(c, rec[c])), c))
    rec[max(ch, key=lambda c: f(c, rec[c] + 1) - f(c, rec[c]))] += left

    before = sum(f(c, y) for c, y in current.items())
    after = sum(f(c, y) for c, y in rec.items())
    moved = sum(max(rec[c] - current[c], 0) for c in ch)
    auto = moved <= float(a["AUTONOMY_LIMIT_PCT"]) * budget
    win = float(a["SQL_TO_WON"])
    # The trap the shared funnel exists to catch: the channel whose cheap-MQL rank most overstates its SQL rank.
    mq = {c: i for i, c in enumerate(sorted(ch, key=lambda c: ch[c]["COST_PER_MQL"] or float("inf")))}
    sq = {c: i for i, c in enumerate(sorted(ch, key=lambda c: ch[c]["COST_PER_SQL"] or float("inf")))}
    trap = max(ch, key=lambda c: (sq[c] - mq[c], -(ch[c]["MQL_TO_SQL"] or 0)))
    best = min(ch, key=lambda c: ch[c]["COST_PER_SQL"])
    gainer = max(ch, key=lambda c: rec[c] - current[c])
    loser = min(ch, key=lambda c: rec[c] - current[c])
    estimated = [ch[c]["DISPLAY_NAME"] for c in ch if ch[c]["SQLS_ESTIMATED"]]
    n, t = len(ch), ch[trap]
    finding = (f"{ch[best]['DISPLAY_NAME']} has the lowest cost per SQL (${ch[best]['COST_PER_SQL']:,.0f}); "
               f"{ch[loser]['DISPLAY_NAME']} gives back the most when budget moves (${current[loser] - rec[loser]:,.0f}/yr). ")
    if sq[trap] > mq[trap]:
        finding += (f"{t['DISPLAY_NAME']} ranks #{mq[trap] + 1} of {n} on cost per MQL but #{sq[trap] + 1} on cost per SQL. ")
    if estimated:
        finding += f"SQLs for {', '.join(estimated)} are estimated from the cross-channel MQL-to-SQL rate."
    memo = {
        "memo_id": "M-" + uuid.uuid4().hex[:8],
        "kind": "reallocation",
        "title": f"Move ${moved / 1000:,.0f}k of ${budget / 1000:,.0f}k a year into {ch[gainer]['DISPLAY_NAME']}",
        "finding": finding.strip(),
        "evidence_sql": EVIDENCE_SQL,
        "recommendation": "; ".join(f"{ch[c]['DISPLAY_NAME']} ${current[c]:,.0f} -> ${rec[c]:,.0f}"
                                    for c in sorted(ch, key=lambda c: rec[c] - current[c], reverse=True)),
        "deltas": {c: {"current_usd": round(current[c]), "recommended_usd": round(rec[c]), "delta_usd": round(rec[c] - current[c]),
                       "sqls_before": round(f(c, current[c]), 1), "sqls_after": round(f(c, rec[c]), 1),
                       "sqls_estimated": bool(ch[c]["SQLS_ESTIMATED"])} for c in ch},
        "impact": {"budget_usd": round(budget), "run_rate_usd": round(run_rate), "moved_usd": round(moved),
                   "sqls_before": round(before, 1), "sqls_after": round(after, 1), "sql_gain": round(after - before, 1),
                   "expected_wins_before": round(before * win, 2), "expected_wins_after": round(after * win, 2),
                   "autonomy_limit_usd": round(float(a["AUTONOMY_LIMIT_PCT"]) * budget), "estimated_channels": estimated,
                   "not_allocated": sorted(r["CHANNEL_ID"] for r in rows if r["CHANNEL_ID"] not in ch)},
        "status": "auto_applied" if auto else "pending",
    }
    session.sql("UPDATE CMO_DB.CORE.DECISION_LOG SET status = 'superseded', decided_at = CURRENT_TIMESTAMP() "
                "WHERE kind = 'reallocation' AND status = 'pending'").collect()
    session.sql("""INSERT INTO CMO_DB.CORE.DECISION_LOG (memo_id, kind, title, finding, evidence_sql, recommendation, deltas, impact, status)
                   SELECT ?, ?, ?, ?, ?, ?, PARSE_JSON(?), PARSE_JSON(?), ?""",
                params=[memo["memo_id"], memo["kind"], memo["title"], memo["finding"], memo["evidence_sql"],
                        memo["recommendation"], json.dumps(memo["deltas"]), json.dumps(memo["impact"]), memo["status"]]).collect()
    if auto:
        session.call("CMO_DB.CORE.APPLY_MEMO", memo["memo_id"])
    return memo
$$;

-- Sets each channel's annual plan to the memo's recommended spend.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.APPLY_MEMO(MEMO_ID STRING)
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  INSERT INTO CMO_DB.CORE.ALLOCATION (channel_id, period, planned_usd, memo_id)
  SELECT d.key, (SELECT txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD'), d.value:recommended_usd::FLOAT, :MEMO_ID
  FROM CMO_DB.CORE.DECISION_LOG m, LATERAL FLATTEN(input => m.deltas) d
  WHERE m.memo_id = :MEMO_ID;
  RETURN 'applied';
END;
$$;

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.DECIDE_MEMO(MEMO_ID STRING, DECISION STRING)
RETURNS VARIANT
LANGUAGE SQL
AS
$$
DECLARE
  current_status STRING;
BEGIN
  current_status := (SELECT status FROM CMO_DB.CORE.DECISION_LOG WHERE memo_id = :MEMO_ID);
  IF (current_status IS NULL) THEN
    RETURN OBJECT_CONSTRUCT('error', 'unknown memo');
  ELSEIF (current_status <> 'pending') THEN
    RETURN OBJECT_CONSTRUCT('error', 'memo already ' || current_status);
  ELSEIF (DECISION NOT IN ('approved', 'rejected')) THEN
    RETURN OBJECT_CONSTRUCT('error', 'decision must be approved or rejected');
  END IF;
  IF (DECISION = 'approved') THEN
    CALL CMO_DB.CORE.APPLY_MEMO(:MEMO_ID);
  END IF;
  UPDATE CMO_DB.CORE.DECISION_LOG SET status = :DECISION, decided_at = CURRENT_TIMESTAMP() WHERE memo_id = :MEMO_ID;
  RETURN OBJECT_CONSTRUCT('memo_id', MEMO_ID, 'status', DECISION);
END;
$$;

-- Clears decisions and approved plans; uploaded data is untouched.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.RESET_DECISIONS()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  DELETE FROM CMO_DB.CORE.ALLOCATION WHERE memo_id IS NOT NULL;
  DELETE FROM CMO_DB.CORE.DECISION_LOG;
  RETURN 'reset';
END;
$$;
