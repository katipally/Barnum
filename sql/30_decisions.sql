-- Q4 decisions: projection of the remaining budget, the reallocation memo, approve / reject.
-- Remaining-spend response per channel uses the same curve as UNIT_ECON, scaled to the observed window:
--   SQLs_c(y) = S_c * (y / X_c) ^ b_c    X_c, S_c = spend and SQLs so far this period

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('Q4_MIN_USD:billboard', 5000, NULL, 'keep one board as a brand test with a geo holdout'),
    ('Q4_STEP_USD', 1000, NULL, 'granularity for the Q4 reallocation')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE VIEW CMO_DB.CORE.Q4_PROJECTION AS
SELECT s.channel_id, s.display_name, s.spend_usd, s.plan_usd, s.mqls, s.sqls, s.cost_per_mql, s.cost_per_sql,
       s.mql_to_sql, s.marginal_cost_per_sql,
       GREATEST(s.plan_usd - s.spend_usd, 0) AS remaining_usd,
       s.sqls * POWER(GREATEST(s.plan_usd - s.spend_usd, 0) / NULLIF(s.spend_usd, 0),
                      COALESCE(e.num, CMO_DB.CORE.A('RESPONSE_EXPONENT'))) AS projected_sqls_remaining
FROM CMO_DB.CORE.CHANNEL_SUMMARY s
LEFT JOIN CMO_DB.CORE.ASSUMPTIONS e ON e.key = 'RESPONSE_EXPONENT:' || s.channel_id;

-- The five numbers on the executive strip.
CREATE OR REPLACE VIEW CMO_DB.CORE.EXEC_STRIP AS
SELECT CMO_DB.CORE.A('Q4_BUDGET_USD')                         AS budget_usd,
       SUM(spend_usd)                                         AS spent_usd,
       CMO_DB.CORE.A('Q4_BUDGET_USD') - SUM(spend_usd)         AS budget_left_usd,
       SUM(mqls) AS mqls, SUM(sqls) AS sqls,
       SUM(spend_usd) / NULLIF(SUM(mqls), 0)                   AS cost_per_mql,
       SUM(spend_usd) / NULLIF(SUM(sqls), 0)                   AS cost_per_sql,
       SUM(spend_usd) / NULLIF(SUM(sqls) * CMO_DB.CORE.A('SQL_TO_WON'), 0) AS cac_media_usd,
       (SUM(spend_usd) + SUM(sqls) * CMO_DB.CORE.A('SQL_TO_WON') * CMO_DB.CORE.A('SALES_COST_PER_WON'))
         / NULLIF(SUM(sqls) * CMO_DB.CORE.A('SQL_TO_WON'), 0)  AS cac_full_usd,
       cac_full_usd / (CMO_DB.CORE.A('ACV_USD') * CMO_DB.CORE.A('GROSS_MARGIN') / 12) AS payback_months,
       SUM(projected_sqls_remaining)                           AS projected_sqls_remaining
FROM CMO_DB.CORE.Q4_PROJECTION;

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION()
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

EVIDENCE_SQL = """SELECT channel_id, spend_usd, mqls, sqls, ROUND(cost_per_mql) cost_per_mql, ROUND(cost_per_sql) cost_per_sql,
       ROUND(mql_to_sql, 3) mql_to_sql, remaining_usd, ROUND(projected_sqls_remaining, 1) projected_sqls
FROM CMO_DB.CORE.Q4_PROJECTION ORDER BY cost_per_sql"""


def run(session):
    a = {r["KEY"]: r["NUM"] for r in session.sql("SELECT key, num FROM CMO_DB.CORE.ASSUMPTIONS").collect()}
    rows = [r.as_dict() for r in session.sql("SELECT * FROM CMO_DB.CORE.Q4_PROJECTION").collect()]
    ch = {r["CHANNEL_ID"]: r for r in rows if r["SPEND_USD"] and r["SQLS"]}
    exp = lambda c: float(a.get(f"RESPONSE_EXPONENT:{c}", a["RESPONSE_EXPONENT"]))
    f = lambda c, y: ch[c]["SQLS"] * (y / ch[c]["SPEND_USD"]) ** exp(c) if y > 0 else 0.0
    step = float(a["Q4_STEP_USD"])
    win = float(a["SQL_TO_WON"])

    current = {c: float(r["REMAINING_USD"]) for c, r in ch.items()}
    budget = sum(current.values())
    rec = {c: min(float(a.get(f"Q4_MIN_USD:{c}", 0)), budget) for c in ch}
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
    # The trap the common funnel exists to catch: the channel whose MQL rank most overstates its SQL rank.
    mql_rank = {c: i for i, c in enumerate(sorted(ch, key=lambda c: ch[c]["COST_PER_MQL"]))}
    sql_rank = {c: i for i, c in enumerate(sorted(ch, key=lambda c: ch[c]["COST_PER_SQL"]))}
    trap = max(ch, key=lambda c: (sql_rank[c] - mql_rank[c], -ch[c]["MQL_TO_SQL"]))
    best = min(ch, key=lambda c: ch[c]["COST_PER_SQL"])
    gainer = max(ch, key=lambda c: rec[c] - current[c])
    t, n = ch[trap], len(ch)
    finding = (f"{t['DISPLAY_NAME']} ranks #{mql_rank[trap] + 1} of {n} on cost per MQL (${t['COST_PER_MQL']:,.0f}) "
               f"but #{sql_rank[trap] + 1} of {n} on cost per SQL (${t['COST_PER_SQL']:,.0f}); only {t['MQL_TO_SQL']:.0%} of its MQLs "
               f"become SQLs. Judged on MQLs it earns more money, judged on SQLs it loses ${current[trap] - rec[trap]:,.0f}. "
               f"{ch[best]['DISPLAY_NAME']} has the lowest cost per SQL (${ch[best]['COST_PER_SQL']:,.0f}).")
    memo = {
        "memo_id": "M-" + uuid.uuid4().hex[:8],
        "kind": "reallocation",
        "title": f"Move ${moved / 1000:,.0f}k of the last ${budget / 1000:,.0f}k into {ch[gainer]['DISPLAY_NAME']}",
        "finding": finding,
        "evidence_sql": EVIDENCE_SQL,
        "recommendation": "; ".join(f"{ch[c]['DISPLAY_NAME']} ${current[c]:,.0f} -> ${rec[c]:,.0f}" for c in sorted(ch, key=lambda c: rec[c] - current[c], reverse=True)),
        "deltas": {c: {"current_usd": round(current[c]), "recommended_usd": round(rec[c]), "delta_usd": round(rec[c] - current[c]),
                       "sqls_before": round(f(c, current[c]), 2), "sqls_after": round(f(c, rec[c]), 2)} for c in ch},
        "impact": {"remaining_budget_usd": round(budget), "moved_usd": round(moved), "sqls_before": round(before, 1),
                   "sqls_after": round(after, 1), "sql_gain": round(after - before, 1),
                   "expected_wins_before": round(before * win, 2), "expected_wins_after": round(after * win, 2),
                   "autonomy_limit_usd": round(float(a["AUTONOMY_LIMIT_PCT"]) * budget)},
        "status": "auto_applied" if auto else "pending",
    }
    session.sql("""INSERT INTO CMO_DB.CORE.DECISION_LOG (memo_id, kind, title, finding, evidence_sql, recommendation, deltas, impact, status)
                   SELECT ?, ?, ?, ?, ?, ?, PARSE_JSON(?), PARSE_JSON(?), ?""",
                params=[memo["memo_id"], memo["kind"], memo["title"], memo["finding"], memo["evidence_sql"],
                        memo["recommendation"], json.dumps(memo["deltas"]), json.dumps(memo["impact"]), memo["status"]]).collect()
    if auto:
        session.call("CMO_DB.CORE.APPLY_MEMO", memo["memo_id"])
    return memo
$$;

-- Sets each channel's plan to spent-so-far + recommended remaining. Used for approve and auto-apply.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.APPLY_MEMO(MEMO_ID STRING)
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  INSERT INTO CMO_DB.CORE.ALLOCATION (channel_id, period, planned_usd, memo_id)
  SELECT d.key, (SELECT txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD'), s.spend_usd + d.value:recommended_usd::FLOAT, :MEMO_ID
  FROM CMO_DB.CORE.DECISION_LOG m, LATERAL FLATTEN(input => m.deltas) d
  JOIN CMO_DB.CORE.CHANNEL_SUMMARY s ON s.channel_id = d.key
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

-- Clears decisions so the demo starts from the seeded plan again.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.RESET_DEMO()
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
