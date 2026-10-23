-- Unit economics for the annual plan. Deterministic: same FUNNEL_FACT + ASSUMPTIONS -> same answer.
--
-- Model per channel c with measured spend and SQLs (measured or estimated), annualized from its own data window:
--   SQLs_c(y) = S_c * (y / X_c) ^ b_c    X_c, S_c = annual spend and SQLs, b_c = ASSUMPTIONS RESPONSE_EXPONENT:<c> or the default
-- Channels without spend (outbound, SEO, GEO...) cannot be bought with budget and are reported, not allocated.
-- b < 1 makes every curve concave, so greedy marginal allocation is optimal.
-- Allocation: O((B/step) log C) with a max-heap. Ceiling search: one allocation per grid point.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('PLAN_BUDGETS', NULL, '250000,500000,1000000,2000000,3000000', 'scenario rows for the plan table; floors via MIN_SHARE:<channel>')
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
    step = num("PLANNING_STEP_USD")
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
    gp_year = acv * gm                          # first-year gross profit per customer
    limit = gp_year * (3 if rule == "3yr" else 1)  # max CAC a customer may cost and still pay back

    def sqls(c, y):
        X, S = curves[c]
        return S * (y / X) ** exp(c) if y > 0 else 0.0

    def allocate(B):
        alloc = {c: floors.get(c, 0.0) * B for c in curves}
        left = B - sum(alloc.values())
        heap = [(-(sqls(c, alloc[c] + step) - sqls(c, alloc[c])), c) for c in curves]
        heapq.heapify(heap)
        last_gain = 0.0
        while left >= step and heap:
            g, c = heapq.heappop(heap)
            alloc[c] += step
            left -= step
            last_gain = -g
            heapq.heappush(heap, (-(sqls(c, alloc[c] + step) - sqls(c, alloc[c])), c))
        alloc[max(curves, key=lambda c: sqls(c, alloc[c] + 1) - sqls(c, alloc[c]))] += left  # remainder under one step
        total_sql = sum(sqls(c, y) for c, y in alloc.items())
        cust = total_sql * win
        sales_cost = cust * sales
        marginal_cps = step / last_gain if last_gain else None
        last_cac = marginal_cps / win + sales if marginal_cps else None
        avg_cac = (B + sales_cost) / cust if cust else None
        return {
            "budget_usd": round(B),
            "split": [{"channel": c, "usd": round(y), "share": round(y / B, 3), "sqls": round(sqls(c, y), 1)}
                      for c, y in sorted(alloc.items(), key=lambda kv: -kv[1])],
            "sqls": round(total_sql), "customers": round(cust, 1), "new_arr_usd": round(cust * acv),
            "avg_cac_usd": round(avg_cac) if avg_cac else None, "last_customer_cac_usd": round(last_cac) if last_cac else None,
            "payback_months": round(avg_cac / (gp_year / 12), 1) if avg_cac else None,
            "year1_net_usd": round(cust * gp_year - B - sales_cost),
            "net_3yr_usd": round(3 * cust * gp_year - B - sales_cost),
            "last_customer_pays_back": bool(last_cac and last_cac <= limit),
        }

    # largest grid budget whose last customer still pays back; None when CAC never binds below the cap
    cap, ceiling, B = 10_000_000.0, None, 100_000.0
    while B <= cap and allocate(B)["last_customer_pays_back"]:
        ceiling, B = B, B + max(step, 50_000)
    cac_bound = B <= cap
    ceiling = ceiling if cac_bound else None
    plan = allocate(float(budget))
    grid = [float(x) for x in a["PLAN_BUDGETS"][1].split(",")]
    return {
        "rule": rule, "payback_limit_cac_usd": round(limit), "ceiling_usd": ceiling, "cac_bound": cac_bound,
        "plan": plan,
        "scenarios": [{k: v for k, v in allocate(x).items() if k != "split"} for x in grid],
        "channels_not_allocated": unbought, "sqls_estimated_for": estimated,
        "basis": {"windows": {r["CHANNEL_ID"]: [str(r["WINDOW_START"]), str(r["WINDOW_END"])] for r in rows},
                  "response_exponents": {c: exp(c) for c in curves},
                  "acv_usd": acv, "gross_margin": gm, "sql_to_won": win, "sales_cost_per_won_usd": sales,
                  "floors": floors, "curves": {c: {"annual_spend_usd": round(X), "annual_sqls": round(S, 1)} for c, (X, S) in curves.items()}},
    }
$$;
