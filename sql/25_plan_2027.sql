-- 2027 plan. Deterministic: same CHANNEL_SUMMARY + ASSUMPTIONS + inputs -> same answer.
--
-- Channel kinds:
--   brand        native awareness metrics (PLAN_AWARENESS_METRICS) and no SQL cost curve, or a one-off flight (billboards):
--                paid from the brand pool, BRAND_PCT * BUDGET
--   performance  annual spend and SQLs (measured or estimated): has a cost curve, shares what is left through marginal-SQL greedy
--   unpriced     outcomes but no spend data (outbound, conferences, email threads): max(PLAN_TEST_BUDGET_USD, PLAN_TEST_PCT * BUDGET) each to learn a cost
-- Brand pool split: pro rata to current annual spend; a brand channel without spend counts as the average spend-bearing one (even split if none has spend).
-- Curve per channel with spend and SQLs, as in UNIT_ECON: SQLs(y) = S * (y / X) ^ b. Spend beyond SCALE_CAP_X * X is extrapolated, not capped, and reported as beyond_proven_range_usd.
-- Unpriced channels keep their run-rate SQLs.
-- Every dollar is placed. Once the next performance dollar returns less than a dollar of ARR (SQLs per dollar < 1 / (ACV * SQL_TO_WON)) and unpriced channels exist,
-- the rest is exploratory overflow shared evenly by the unpriced channels.
-- Allocation: O((B/step) log C) max-heap. Budget needed for the targets: doubling then bisection on the step grid, O(log(B/step)) allocations.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('PLAN_TEST_BUDGET_USD', 20000, NULL, '2027 plan: minimum test budget per channel that has outcomes but no spend data'),
    ('PLAN_TEST_PCT', 0.03, NULL, '2027 plan: share of the budget each such channel gets as a test budget when that beats the minimum'),
    ('PLAN_AWARENESS_METRICS', NULL, 'impressions,ai_mentions,ai_answers', '2027 plan: native metrics that mark a channel as brand/awareness')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.PLAN_2027(BUDGET FLOAT, REVENUE_TARGET FLOAT, SQLS_PER_QUARTER FLOAT, BRAND_PCT FLOAT)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
import heapq
import json
import math


def run(session, budget, revenue_target, sqls_per_quarter, brand_pct):
    a = {r["KEY"]: (r["NUM"], r["TXT"]) for r in session.sql("SELECT key, num, txt FROM CMO_DB.CORE.ASSUMPTIONS").collect()}
    rows = [{k.lower(): v for k, v in r.as_dict().items()} for r in session.sql(
        """SELECT channel_id, display_name, grain, annual_spend_usd, annual_sqls, sqls_estimated, metrics
           FROM CMO_DB.CORE.CHANNEL_SUMMARY ORDER BY channel_id""").collect()]
    rate = session.sql("SELECT rate, source FROM CMO_DB.CORE.MQL_TO_SQL_RATE").collect()[0]
    return plan(budget, revenue_target, sqls_per_quarter, brand_pct, a, rows, rate["RATE"], rate["SOURCE"])


def plan(budget, revenue_target, sqls_per_quarter, brand_pct, a, rows, mql_to_sql_rate, mql_to_sql_source):
    if None in (budget, revenue_target, sqls_per_quarter, brand_pct):
        return {"error": "budget, revenue_target, sqls_per_quarter and brand_pct are all required"}
    if budget <= 0 or revenue_target < 0 or sqls_per_quarter < 0 or not 0 <= brand_pct <= 1:
        return {"error": "budget must be > 0, targets >= 0 and brand_pct between 0 and 1"}
    if not rows:
        return {"error": "no active channels"}
    num = lambda k: float(a[k][0])
    acv, win, step, cap_x, test, test_pct = num("ACV_USD"), num("SQL_TO_WON"), num("PLANNING_STEP_USD"), num("SCALE_CAP_X"), num("PLAN_TEST_BUDGET_USD"), num("PLAN_TEST_PCT")
    exp = lambda c: float(a.get(f"RESPONSE_EXPONENT:{c}", a["RESPONSE_EXPONENT"])[0])
    aware = {m.strip() for m in a["PLAN_AWARENESS_METRICS"][1].split(",") if m.strip()}

    ch = {}
    for r in rows:
        m = r["metrics"]
        m = json.loads(m) if isinstance(m, str) else dict(m or {})
        spend = float(r["annual_spend_usd"]) if r["annual_spend_usd"] else None
        sqls = float(r["annual_sqls"]) if r["annual_sqls"] is not None else None
        curve = bool(spend and sqls)
        kind = "brand" if aware & set(m) and (not curve or r["grain"] == "flight") else "performance" if curve else "unpriced"
        ch[r["channel_id"]] = {"name": r["display_name"], "kind": kind, "spend": spend, "sqls": sqls, "curve": curve,
                               "est": bool(r["sqls_estimated"]), "metrics": {k: float(v) for k, v in m.items() if k in aware}}
    of = lambda kind: [c for c, v in ch.items() if v["kind"] == kind]
    brand, perf, unpriced = of("brand"), of("performance"), of("unpriced")
    proven = {c: cap_x * v["spend"] for c, v in ch.items() if v["curve"]}

    def sqls_at(c, y):
        v = ch[c]
        return v["sqls"] * (y / v["spend"]) ** exp(c) if y > 0 else 0.0

    floor = 1 / (acv * win)  # SQLs per dollar below which a dollar returns less than a dollar of ARR

    def distribute(B):
        alloc = {c: 0.0 for c in ch}
        extra = {c: 0.0 for c in unpriced}
        pool = brand_pct * B if brand else 0.0
        spends = [ch[c]["spend"] for c in brand if ch[c]["spend"]]
        fill = sum(spends) / len(spends) if spends else 1.0
        weight = {c: ch[c]["spend"] or fill for c in brand}
        total_w = sum(weight.values())
        for c in brand:
            alloc[c] = pool * weight[c] / total_w
        avail = B - pool
        tests = min(len(unpriced) * max(test, test_pct * B), avail / 2 if perf else avail)
        for c in unpriced:
            alloc[c] = tests / len(unpriced)
        left = avail - tests

        def gain(c):  # SQLs per dollar of the next increment
            return -(sqls_at(c, alloc[c] + step) - sqls_at(c, alloc[c])) / step

        heap = [(gain(c), c) for c in perf]
        heapq.heapify(heap)
        while left > 0 and heap and (not unpriced or -heap[0][0] >= floor):
            _, c = heapq.heappop(heap)
            inc = min(step, left)
            alloc[c] += inc
            left -= inc
            heapq.heappush(heap, (gain(c), c))
        if left > 0:
            sinks = unpriced or brand
            for c in sinks:
                alloc[c] += left / len(sinks)
                if c in extra:
                    extra[c] = left / len(sinks)
        return alloc, extra

    def annual_sqls(alloc):
        return sum(sqls_at(c, alloc[c]) if v["curve"] else v["sqls"] or 0.0 for c, v in ch.items())

    alloc, extra = distribute(float(budget))
    total_sqls = annual_sqls(alloc)
    floor2 = lambda x: math.floor(x * 100) / 100
    out = []
    for c, v in ch.items():
        y = alloc[c]
        s = sqls_at(c, y) if v["curve"] else v["sqls"]
        native = {k: round(x * y / v["spend"]) for k, x in v["metrics"].items()} if v["kind"] == "brand" and v["spend"] and v["metrics"] else None
        beyond = max(0.0, y - proven[c]) if v["curve"] else None
        if v["kind"] == "performance":
            note = "greedy on marginal SQLs per dollar"
        elif v["kind"] == "brand":
            note = "brand pool share" + (", SQLs projected from its cost curve" if v["curve"] else ", no SQL signal") + \
                   ("" if native else ", no spend history so native KPIs are not projected")
        else:
            note = "test budget, no cost data" + ("; SQLs shown are the current run rate" if s is not None else "; no SQL signal")
        if beyond and beyond >= 0.01:
            note += f"; extrapolated beyond {cap_x:g}x the spend we have data for"
        if extra.get(c):
            note += "; includes exploratory overflow"
        out.append({"channel_id": c, "display_name": v["name"], "kind": v["kind"], "budget_usd": floor2(y),
                    "share": round(y / budget, 4), "current_annual_spend_usd": round(v["spend"]) if v["spend"] else None,
                    "current_cost_per_sql": round(v["spend"] / v["sqls"], 2) if v["curve"] else None,
                    "projected_sqls_per_quarter": round(s / 4, 1) if s is not None else None,
                    "projected_customers": round(s * win, 1) if s is not None else None,
                    "projected_native": native, "estimated": v["est"] and s is not None, "beyond_proven_range_usd": floor2(beyond) if v["curve"] else None,
                    "exploratory_overflow_usd": floor2(extra[c]) if c in extra else 0.0, "basis_note": note})
    out.sort(key=lambda r: -r["budget_usd"])

    allocated = floor2(sum(r["budget_usd"] for r in out))
    customers = total_sqls * win
    arr = customers * acv
    need_customers = revenue_target / acv
    need_sqls_year = max(need_customers / win, 4 * sqls_per_quarter)

    hi, notes, reachable = float(budget), [], True
    while annual_sqls(distribute(hi)[0]) < need_sqls_year and hi < 1e9:
        hi *= 2
    if annual_sqls(distribute(hi)[0]) < need_sqls_year:
        reachable = False
    else:
        lo = 0.0
        while hi - lo > step:
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if annual_sqls(distribute(mid)[0]) < need_sqls_year else (lo, mid)
    needed = math.ceil(hi / step) * step if reachable else None
    rev_met, sql_met = arr >= revenue_target, total_sqls / 4 >= sqls_per_quarter
    if rev_met and sql_met:
        limited_by = None
    elif reachable:
        limited_by = "budget"
        notes.append(f"Both targets need about ${needed:,.0f} of budget with the same inputs.")
    else:
        limited_by = "diminishing_returns" if proven else "no_cost_curve"
        notes.append("No budget reaches the targets: returns diminish on every channel with a cost curve and unpriced channels keep their run-rate SQLs.")
    if not brand and brand_pct:
        notes.append("No brand channel is active, so the brand share went to performance channels.")
    if unpriced:
        notes.append("Unpriced channels are held at their run-rate SQLs; the test budget buys a cost measurement, not more SQLs, and the budget needed excludes their unknown cost.")
    beyond_total = floor2(sum(r["beyond_proven_range_usd"] or 0.0 for r in out))
    overflow_total = floor2(sum(r["exploratory_overflow_usd"] for r in out))
    if beyond_total >= 0.01:
        notes.append(f"${beyond_total:,.0f} is extrapolated beyond {cap_x:g}x the spend we have data for, so those SQLs are less certain.")
    if overflow_total >= 0.01:
        notes.append(f"${overflow_total:,.0f} is exploratory overflow: the next performance dollar would return less than a dollar of ARR, so it funds tests that buy cost data.")
    unmeasured = [c for c, v in ch.items() if v["sqls"] is None]
    if unmeasured:
        notes.append("No SQL signal, so excluded from SQL totals (not counted as zero): " + ", ".join(unmeasured))

    return {
        "inputs": {"budget_usd": budget, "revenue_target_usd": revenue_target, "sqls_per_quarter": sqls_per_quarter, "brand_pct": brand_pct},
        "assumptions_used": {"acv_usd": acv, "sql_to_won": win, "mql_to_sql_rate": mql_to_sql_rate, "mql_to_sql_source": mql_to_sql_source,
                             "scale_cap_x": cap_x, "test_budget_usd": test, "test_pct": test_pct},
        "channels": out,
        "totals": {"budget_usd": budget, "allocated_usd": allocated, "unallocated_usd": floor2(budget - allocated),
                   "projected_sqls_per_quarter": round(total_sqls / 4, 1), "projected_customers": round(customers, 1),
                   "projected_new_arr_usd": round(arr), "beyond_proven_range_usd": beyond_total, "exploratory_overflow_usd": overflow_total},
        "targets": {"revenue": {"target_usd": revenue_target, "projected_usd": round(arr), "gap_usd": round(max(0.0, revenue_target - arr)), "met": rev_met,
                                "needed_customers": round(need_customers, 1), "needed_sqls_per_year": round(need_sqls_year, 1)},
                    "sqls_per_quarter": {"target": sqls_per_quarter, "projected": round(total_sqls / 4, 1),
                                         "gap": round(max(0.0, sqls_per_quarter - total_sqls / 4), 1), "met": sql_met},
                    "budget_needed_for_targets_usd": needed, "limited_by": limited_by, "notes": notes},
    }

$$;
