-- Unit economics for the annual plan. Deterministic: same FUNNEL_FACT + ASSUMPTIONS -> same answer.
--
-- Model per channel c with measured spend and SQLs (measured or estimated), annualized from its own data window:
--   SQLs_c(y) = S_c * (y / X_c) ^ b_c    X_c, S_c = annual spend and SQLs, b_c = ASSUMPTIONS RESPONSE_EXPONENT:<c> or the default
-- Channels without spend (outbound, SEO, GEO...) cannot be bought with budget and are reported, not allocated.
-- b < 1 makes every curve concave, so greedy marginal allocation is optimal; a cap keeps it concave and only removes channels as they fill.
-- Allocation: O((B/step) log C) with a max-heap. Ceiling search: one allocation per grid point.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('PLAN_BUDGETS', NULL, '250000,500000,1000000,2000000,3000000', 'scenario rows for the plan table; floors via MIN_SHARE:<channel>'),
    ('SCALE_CAP_X', 3, NULL, 'a channel is never allocated more than this multiple of its annual run rate; the rest is reported as unallocated')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.UNIT_ECON(BUDGET FLOAT, RULE STRING)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
import heapq


def run(session, budget, rule):
    rule = (rule or "12mo").lower()
    if rule not in ("12mo", "3yr"):
        raise ValueError("rule must be 12mo or 3yr")
    a = {r["KEY"]: (r["NUM"], r["TXT"]) for r in session.sql("SELECT key, num, txt FROM CMO_DB.CORE.ASSUMPTIONS").collect()}
    num = lambda k: float(a[k][0])
    acv, gm, win, sales = num("ACV_USD"), num("GROSS_MARGIN"), num("SQL_TO_WON"), num("SALES_COST_PER_WON")
    step, cap_x = num("PLANNING_STEP_USD"), num("SCALE_CAP_X")
    exp = lambda c: float(a.get(f"RESPONSE_EXPONENT:{c}", a["RESPONSE_EXPONENT"])[0])
    floors = {k.split(":", 1)[1]: float(v[0]) for k, v in a.items() if k.startswith("MIN_SHARE:")}
    rows = session.sql("""SELECT channel_id, annual_spend_usd, annual_sqls, sqls_estimated, window_start, window_end
                          FROM CMO_DB.CORE.CHANNEL_SUMMARY""").collect()
    curves = {r["CHANNEL_ID"]: (float(r["ANNUAL_SPEND_USD"]), float(r["ANNUAL_SQLS"]))
              for r in rows if r["ANNUAL_SPEND_USD"] and r["ANNUAL_SQLS"]}
    if not curves:
        return {"error": "no active channel measures both spend and SQLs (measured or estimated)"}
    unbought = sorted(r["CHANNEL_ID"] for r in rows if r["CHANNEL_ID"] not in curves)
    estimated = sorted(r["CHANNEL_ID"] for r in rows if r["CHANNEL_ID"] in curves and r["SQLS_ESTIMATED"])
    floors = {c: v for c, v in floors.items() if c in curves}
    caps = {c: cap_x * X for c, (X, _) in curves.items()}
    gp_year = acv * gm                          # first-year gross profit per customer
    limit = gp_year * (3 if rule == "3yr" else 1)  # max CAC a customer may cost and still pay back

    def sqls(c, y):
        X, S = curves[c]
        return S * (y / X) ** exp(c) if y > 0 else 0.0

    def allocate(B):
        alloc = {c: min(floors.get(c, 0.0) * B, caps[c]) for c in curves}
        left = B - sum(alloc.values())

        def gain(c):  # SQLs per dollar of the next increment, which shrinks to the room left under the cap
            inc = min(step, caps[c] - alloc[c])
            return -(sqls(c, alloc[c] + inc) - sqls(c, alloc[c])) / inc

        heap = [(gain(c), c) for c in curves if alloc[c] < caps[c]]
        heapq.heapify(heap)
        last_inc = last_gain = 0.0
        while left > 0 and heap:
            _, c = heapq.heappop(heap)
            inc = min(step, caps[c] - alloc[c], left)
            last_inc, last_gain = inc, sqls(c, alloc[c] + inc) - sqls(c, alloc[c])
            alloc[c] += inc
            left -= inc
            if alloc[c] < caps[c]:
                heapq.heappush(heap, (gain(c), c))
        spent = B - left
        total_sql = sum(sqls(c, y) for c, y in alloc.items())
        cust = total_sql * win
        sales_cost = cust * sales
        marginal_cps = last_inc / last_gain if last_gain else None
        last_cac = marginal_cps / win + sales if marginal_cps else None
        avg_cac = (spent + sales_cost) / cust if cust else None
        return {
            "budget_usd": round(B), "unallocated_usd": round(left),
            "split": [{"channel": c, "usd": round(y), "share": round(y / B, 3), "sqls": round(sqls(c, y), 1)}
                      for c, y in sorted(alloc.items(), key=lambda kv: -kv[1])],
            "sqls": round(total_sql), "customers": round(cust, 1), "new_arr_usd": round(cust * acv),
            "avg_cac_usd": round(avg_cac) if avg_cac else None, "last_customer_cac_usd": round(last_cac) if last_cac else None,
            "payback_months": round(avg_cac / (gp_year / 12), 1) if avg_cac else None,
            "year1_net_usd": round(cust * gp_year - spent - sales_cost),
            "net_3yr_usd": round(3 * cust * gp_year - spent - sales_cost),
            "last_customer_pays_back": bool(last_cac and last_cac <= limit),
        }

    # largest grid budget that is fully allocatable under the scale caps and whose last customer still pays back
    cap, ceiling, limited_by, B = 10_000_000.0, None, None, 100_000.0
    while B <= cap:
        r = allocate(B)
        if r["unallocated_usd"] or not r["last_customer_pays_back"]:
            limited_by = "scale_cap" if r["unallocated_usd"] else "cac"
            break
        ceiling, B = B, B + max(step, 50_000)
    plan = allocate(float(budget))
    grid = [float(x) for x in a["PLAN_BUDGETS"][1].split(",")]
    return {
        "rule": rule, "payback_limit_cac_usd": round(limit), "ceiling_usd": ceiling, "ceiling_limited_by": limited_by, "cac_bound": limited_by == "cac",
        "plan": plan,
        "scenarios": [{k: v for k, v in allocate(x).items() if k != "split"} for x in grid],
        "channels_not_allocated": unbought, "sqls_estimated_for": estimated,
        "basis": {"windows": {r["CHANNEL_ID"]: [str(r["WINDOW_START"]), str(r["WINDOW_END"])] for r in rows},
                  "response_exponents": {c: exp(c) for c in curves},
                  "acv_usd": acv, "gross_margin": gm, "sql_to_won": win, "sales_cost_per_won_usd": sales,
                  "floors": floors, "scale_cap_x": cap_x, "curves": {c: {"annual_spend_usd": round(X), "annual_sqls": round(S, 1)} for c, (X, S) in curves.items()}},
    }
$$;
