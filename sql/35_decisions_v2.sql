-- V2 decisions, side by side with the live PROPOSE_REALLOCATION / APPLY_MEMO (unchanged). Run after 30_decisions.sql.
--
-- What changes against v1:
--   1. Cumulative autonomy cap: auto-applied moves are capped per rolling 7 days (AUTONOMY_WEEKLY_PCT of the budget),
--      not per memo, so many small memos can't drain a channel. The rest goes into one pending memo.
--   2. Lag-aware patience: a channel is judged only after LAG_WEEKS:<channel> + JUDGE_MIN_WEEKS of matured results,
--      unless a stop-loss trips (marginal $/SQL STOP_LOSS_X times the best judged channel's).
--   3. Noise dead-band: money moves from A to B only when A's marginal $/SQL beats B's by more than NOISE_Z standard
--      errors, in each of the last NOISE_PERSIST_WEEKS weekly evaluations; a channel's direction can't reverse
--      within FLIP_COOLDOWN_WEEKS of its last move.
-- The decision core between the "v2 core" markers is pure Python; evals/policy_v2.py runs that exact block in the
-- backtest, so the simulated policy and this procedure can't drift apart.

MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (
  SELECT * FROM VALUES
    ('AUTONOMY_WEEKLY_PCT', 0.10, NULL, 'V2: auto-applied moves per rolling 7 days, as a share of the budget; the rest needs approval'),
    ('LAG_WEEKS:billboard', 8, NULL, 'V2: weeks from spend to SQLs (first spend to first SQL in FUNNEL_FACT)'),
    ('LAG_WEEKS:conferences', 4, NULL, 'V2: weeks from spend to SQLs (event follow-up cycle)'),
    ('LAG_WEEKS:linkedin', 1, NULL, 'V2: weeks from spend to SQLs'),
    ('LAG_WEEKS:outbound', 1, NULL, 'V2: weeks from spend to SQLs'),
    ('LAG_WEEKS:google', 0, NULL, 'V2: weeks from spend to SQLs (search converts the same week)'),
    ('JUDGE_MIN_WEEKS', 6, NULL, 'V2: weeks of matured results (after the lag) before a channel may be cut'),
    ('STOP_LOSS_X', 3, NULL, 'V2: cut before the judge-after window only if marginal $/SQL is this multiple of the best channel'),
    ('NOISE_Z', 1, NULL, 'V2: a marginal $/SQL gap must beat this many standard errors before money moves'),
    ('NOISE_PERSIST_WEEKS', 2, NULL, 'V2: ... and must have done so in each of this many weekly evaluations'),
    ('FLIP_COOLDOWN_WEEKS', 4, NULL, 'V2: weeks before a channel''s direction (up/down) may reverse')
  AS v(key, num, txt, note)
) s ON t.key = s.key
WHEN NOT MATCHED THEN INSERT VALUES (s.key, s.num, s.txt, s.note);

CREATE OR REPLACE PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION_V2(BUDGET FLOAT DEFAULT NULL, DRY_RUN BOOLEAN DEFAULT FALSE)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.12'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'run'
AS
$$
# >>> v2 core
import heapq
import math

DEFAULTS = {
    "AUTONOMY_WEEKLY_PCT": 0.10,
    "JUDGE_MIN_WEEKS": 6,
    "STOP_LOSS_X": 3.0,
    "STOP_LOSS_GRACE_WEEKS": 2,   # stop-loss only once results should have started arriving (lag + this)
    "NOISE_Z": 1.0,
    "NOISE_CV": 0.73,             # weekly CV of SQLs when a channel has no weekly series (real FUNNEL_FACT residuals)
    "NOISE_PERSIST_WEEKS": 2,
    "FLIP_COOLDOWN_WEEKS": 4,
    "EVIDENCE_WINDOW_WEEKS": 8,
    "MIN_MOVE_PCT": 0.005,        # smaller total moves are not worth a memo
    "STEP_PCT": 0.01,
}
FLIP_THRESHOLD_PCT = 0.002        # a channel change below this share of the budget is not a move


def params(assumptions):
    return {k: float(assumptions[k]) if assumptions.get(k) is not None else v for k, v in DEFAULTS.items()}


def evidence(pairs, cv_default, n_weeks=None, cv=None):
    """(x, s, rse): mean spend and SQLs per period over lag-matched (spend, sqls) pairs, and the relative standard
    error of SQLs per dollar. One aggregate pair counts as n_weeks weekly observations."""
    pairs = [(x, s) for x, s in pairs if x > 0]
    if not pairs:
        return None
    x = sum(p[0] for p in pairs) / len(pairs)
    s = sum(p[1] for p in pairs) / len(pairs)
    if s <= 0:
        return (x, 0.0, 0.0)
    if cv is None:
        r = [si / xi for xi, si in pairs]
        m = sum(r) / len(r)
        cv = math.sqrt(sum((v - m) ** 2 for v in r) / (len(r) - 1)) / m if len(r) >= 4 and m > 0 else cv_default
    return (x, s, cv / math.sqrt(max(n_weeks or len(pairs), 1)))


def greedy(budget, curves, floors, step):
    rec = {c: min(floors.get(c, 0.0), budget) for c in curves}
    left = budget - sum(rec.values())
    heap = [(-(f(rec[c] + step) - f(rec[c])), c) for c, f in curves.items()]
    heapq.heapify(heap)
    while left >= step and heap:  # concave curves make greedy optimal
        _, c = heapq.heappop(heap)
        rec[c] += step
        left -= step
        heapq.heappush(heap, (-(curves[c](rec[c] + step) - curves[c](rec[c])), c))
    if left > 0 and rec:
        rec[max(rec, key=lambda c: curves[c](rec[c] + 1) - curves[c](rec[c]))] += left
    return rec


def toward(current, target, max_move):
    """Move from current to target, shifting at most max_move dollars."""
    need = sum(max(target[c] - current.get(c, 0), 0) for c in target)
    k = 1.0 if need <= max_move else max_move / need
    return {c: current.get(c, 0) + k * (target[c] - current.get(c, 0)) for c in target}


def decide(ch, current, budget, p, used_auto=0.0, last_move=None):
    """One V2 decision.

    ch: {channel: {"b": exponent, "lag": weeks, "age": weeks since first spend, "floor": usd,
                   "ev": [(x, s, rse) as of now, as of 1 week ago, ...]}}
    current: {channel: usd}, summing to budget. used_auto: usd auto-applied in the last 7 days.
    last_move: {channel: (+1 | -1, weeks ago)} for the latest applied move per channel.
    Returns target (full recommendation), auto (the part within the weekly cap) and per-channel diagnostics.
    """
    last_move = last_move or {}
    step = budget * p["STEP_PCT"]
    persist = int(p["NOISE_PERSIST_WEEKS"])

    def curve(e, b):
        x, s, _ = e
        return lambda y: s * (y / x) ** b if y > 0 else 0.0

    def log_mc(c, i):  # log marginal $ per SQL at the current spend, from the evidence i weeks back
        x, s, _ = ch[c]["ev"][i]
        b = ch[c]["b"]
        return math.inf if s <= 0 else (1 - b) * math.log(max(current.get(c, 0), step)) + b * math.log(x) - math.log(b * s)

    diag, judged = {}, set()
    for c, k in ch.items():
        d = diag[c] = {"lag_weeks": k["lag"], "age_weeks": round(k["age"], 1), "judge_after_weeks": k["lag"] + p["JUDGE_MIN_WEEKS"]}
        if not k.get("ev"):
            d["status"] = "no_evidence"
            continue
        d["marginal_cost_per_sql"] = round(math.exp(log_mc(c, 0))) if ch[c]["ev"][0][1] > 0 else None
        d["noise_rse"] = round(k["ev"][0][2], 3)
        d["status"] = "judged" if k["age"] >= d["judge_after_weeks"] else "patience"
        if d["status"] == "judged":
            judged.add(c)
    best = min((log_mc(c, 0) for c in judged), default=None)
    for c in ch:
        if diag[c]["status"] == "patience" and best is not None and ch[c]["age"] >= ch[c]["lag"] + p["STOP_LOSS_GRACE_WEEKS"] \
                and log_mc(c, 0) > best + math.log(p["STOP_LOSS_X"]):
            diag[c]["status"] = "stop_loss"
            judged.add(c)

    fixed = {c: v for c, v in current.items() if c not in judged}
    curves = {c: curve(ch[c]["ev"][0], ch[c]["b"]) for c in judged}
    optimum = greedy(budget - sum(fixed.values()), curves, {c: ch[c].get("floor", 0.0) for c in judged}, step)

    def gap(dn, rc, i):  # how many standard errors dn's marginal $/SQL exceeds rc's, i weeks back
        if len(ch[dn]["ev"]) <= i or len(ch[rc]["ev"]) <= i:
            return None
        g = log_mc(dn, i) - log_mc(rc, i)
        se = math.hypot(ch[dn]["ev"][i][2], ch[rc]["ev"][i][2])
        return math.inf if g == math.inf else (g / se if se > 0 else (math.inf if g > 0 else 0.0))

    pairs = []
    for dn in judged:
        for rc in judged:
            if dn != rc:
                zs = [gap(dn, rc, i) for i in range(persist)]
                if all(z is not None and z > p["NOISE_Z"] for z in zs):
                    pairs.append((dn, rc, round(min(zs), 2)))
    donors, recipients = {dn for dn, _, _ in pairs}, {rc for _, rc, _ in pairs}

    delta = {}
    for c in judged:
        dl = optimum[c] - current.get(c, 0)
        why = None
        if (dl < 0 and c not in donors) or (dl > 0 and c not in recipients):
            why = "gap within the noise band or not yet persistent"
        elif c in last_move and dl * last_move[c][0] < 0 and last_move[c][1] < p["FLIP_COOLDOWN_WEEKS"]:
            why = f"would reverse its last move {last_move[c][1]:g} weeks ago (cooldown {p['FLIP_COOLDOWN_WEEKS']:g})"
        if why and abs(dl) > FLIP_THRESHOLD_PCT * budget:
            diag[c]["blocked"] = why
        delta[c] = 0.0 if why else dl
    up = sum(v for v in delta.values() if v > 0)
    down = -sum(v for v in delta.values() if v < 0)
    k_up, k_down = (min(1.0, down / up) if up else 0.0), (min(1.0, up / down) if down else 0.0)
    target = dict(current)
    for c, v in delta.items():
        target[c] = current.get(c, 0) + v * (k_up if v > 0 else k_down)

    moved = sum(max(target[c] - current.get(c, 0), 0) for c in target)
    if moved < p["MIN_MOVE_PCT"] * budget:
        target, moved = dict(current), 0.0
    cap = p["AUTONOMY_WEEKLY_PCT"] * budget
    room = max(cap - used_auto, 0.0)
    auto_moved = min(moved, room)
    if auto_moved < p["MIN_MOVE_PCT"] * budget:
        auto_moved = 0.0
    auto = toward(current, target, auto_moved)
    value = lambda a: sum(f(a.get(c, 0)) for c, f in curves.items())
    for c in diag:
        diag[c]["role"] = "donor" if c in donors else "recipient" if c in recipients else "hold"
    return {"target": target, "auto": auto, "moved": moved, "auto_moved": auto_moved, "cap": cap, "cap_used": used_auto,
            "cap_room": room, "sqls_now": value(current), "sqls_target": value(target), "sqls_auto": value(auto),
            "significant_pairs": pairs, "channels": diag}
# <<< v2 core

import json
import uuid
from datetime import timedelta

EVIDENCE_SQL = """SELECT channel_id, spend_usd, sqls, sqls_estimated, ROUND(annual_spend_usd) annual_spend_usd,
       ROUND(marginal_cost_per_sql) marginal_cost_per_sql, window_start, window_end, grain
FROM CMO_DB.CORE.CHANNEL_SUMMARY ORDER BY marginal_cost_per_sql NULLS LAST"""


def _as_of(daily, c, end, start, grain):
    """Annualised (spend, sqls) from dated FUNNEL_FACT rows up to `end`, as CHANNEL_SUMMARY computes them."""
    rows = [(d, sp, sq) for d, sp, sq in daily.get(c, []) if d <= end]
    if not rows:
        return None
    days = (end - start).days + 1
    f = 1.0 if grain == "flight" else 365.0 / max(days, 1)
    return sum(sp for _, sp, _ in rows) * f, sum(sq for _, _, sq in rows) * f


def run(session, budget=None, dry_run=False):
    a = {r["KEY"]: r["NUM"] for r in session.sql("SELECT key, num FROM CMO_DB.CORE.ASSUMPTIONS").collect()}
    p = params(a)
    rows = [r.as_dict() for r in session.sql("SELECT * FROM CMO_DB.CORE.CHANNEL_SUMMARY").collect()]
    sm = {r["CHANNEL_ID"]: r for r in rows if r["ANNUAL_SPEND_USD"] and r["SQLS"]}
    if len(sm) < 2:
        return {"error": "need at least two channels with measured spend and SQLs to reallocate"}
    today = session.sql("SELECT CURRENT_DATE() d").collect()[0]["D"]
    daily = {}
    for r in session.sql("""SELECT channel, date, SUM(COALESCE(spend_usd, 0)) sp, SUM(COALESCE(sqls, 0)) sq
                            FROM CMO_DB.CORE.FUNNEL_FACT GROUP BY 1, 2 ORDER BY 1, 2""").collect():
        daily.setdefault(r["CHANNEL"], []).append((r["DATE"], float(r["SP"]), float(r["SQ"])))
    persist = int(p["NOISE_PERSIST_WEEKS"])

    ch = {}
    for c, r in sm.items():
        lag = float(a.get(f"LAG_WEEKS:{c}") or 0)
        start, end = r["WINDOW_START"], r["WINDOW_END"]
        weekly = {}
        for d, _, sq in daily.get(c, []):
            wk = d - timedelta(days=d.weekday())
            weekly[wk] = weekly.get(wk, 0.0) + sq
        nonzero = [v for v in weekly.values() if v > 0]
        cv = None
        if r["GRAIN"] != "lifetime" and len(nonzero) >= 4:
            m = sum(nonzero) / len(nonzero)
            cv = math.sqrt(sum((v - m) ** 2 for v in nonzero) / (len(nonzero) - 1)) / m
        weeks = max(r["WINDOW_DAYS"] / 7 - lag, 1)
        ev = []
        for i in range(persist):
            if r["GRAIN"] == "lifetime":  # a dated-today snapshot: no history to step back through, the aggregate stands
                x, s = r["ANNUAL_SPEND_USD"], r["ANNUAL_SQLS"]
            else:
                got = _as_of(daily, c, end - timedelta(days=7 * i), start, r["GRAIN"])
                if not got:
                    break
                x, s = got
            ev.append(evidence([(float(x), float(s))], p["NOISE_CV"], weeks - i, cv))
        ch[c] = {"b": float(r["RESPONSE_EXPONENT"]), "lag": lag, "age": (today - start).days / 7,
                 "ev": [e for e in ev if e], "floor": 0.0, "name": r["DISPLAY_NAME"], "estimated": bool(r["SQLS_ESTIMATED"])}

    plan = {r["CHANNEL_ID"]: float(r["PLANNED_USD"]) for r in session.sql("SELECT channel_id, planned_usd FROM CMO_DB.CORE.CURRENT_PLAN").collect()}
    current = {c: plan.get(c, float(r["ANNUAL_SPEND_USD"])) for c, r in sm.items()}
    run_rate = sum(current.values())
    budget = float(budget) if budget else run_rate
    current = {c: v * budget / run_rate for c, v in current.items()}  # today's plan at this budget
    for c in ch:
        ch[c]["floor"] = float(a.get(f"MIN_SHARE:{c}") or 0) * budget

    used = session.sql("""SELECT COALESCE(SUM(COALESCE(impact:auto_moved_usd, impact:moved_usd)::FLOAT), 0) u
                          FROM CMO_DB.CORE.DECISION_LOG WHERE kind = 'reallocation' AND status = 'auto_applied'
                          AND created_at > DATEADD('day', -7, CURRENT_TIMESTAMP())""").collect()[0]["U"]
    last_move = {}
    for r in session.sql("""SELECT d.key c, d.value:delta_usd::FLOAT dl,
                                   DATEDIFF('hour', COALESCE(m.decided_at, m.created_at), CURRENT_TIMESTAMP()) / 168 ago
                            FROM CMO_DB.CORE.DECISION_LOG m, LATERAL FLATTEN(input => m.deltas) d
                            WHERE m.kind = 'reallocation' AND m.status IN ('auto_applied', 'approved')
                            ORDER BY COALESCE(m.decided_at, m.created_at) DESC""").collect():
        if r["C"] not in last_move and abs(r["DL"] or 0) > FLIP_THRESHOLD_PCT * budget:
            last_move[r["C"]] = (1 if r["DL"] > 0 else -1, float(r["AGO"]))

    dec = decide(ch, current, budget, p, float(used), last_move)
    win = float(a["SQL_TO_WON"])
    f = {c: (lambda y, c=c: ch[c]["ev"][0][1] * (y / ch[c]["ev"][0][0]) ** ch[c]["b"] if y > 0 and ch[c]["ev"] else 0.0) for c in ch}
    names = {c: ch[c]["name"] for c in ch}
    patience = [names[c] for c, d in dec["channels"].items() if d["status"] == "patience"]
    banded = [names[c] for c, d in dec["channels"].items() if d.get("blocked")]

    def memo(base, rec, status, moved, kind_title):
        gainer = max(rec, key=lambda c: rec[c] - base[c])
        before, after = sum(f[c](base[c]) for c in base), sum(f[c](rec[c]) for c in rec)
        finding = []
        if dec["significant_pairs"]:
            dn, rc, z = max(dec["significant_pairs"], key=lambda t: t[2])
            finding.append(f"{names[dn]} costs more per extra SQL than {names[rc]} (${dec['channels'][dn]['marginal_cost_per_sql'] or 0:,.0f} "
                           f"vs ${dec['channels'][rc]['marginal_cost_per_sql']:,.0f}), a gap of {z:.1f} standard errors held for {persist}+ weeks.")
        if patience:
            finding.append(f"Held until their results can arrive: {', '.join(patience)}.")
        if banded:
            finding.append(f"Not moved (noise band or reversal cooldown): {', '.join(banded)}.")
        finding.append(f"Autonomy: ${dec['cap_used']:,.0f} of ${dec['cap']:,.0f} auto-applied in the last 7 days.")
        return {
            "memo_id": "M-" + uuid.uuid4().hex[:8],
            "kind": "reallocation",
            "title": f"{kind_title}: move ${moved / 1000:,.0f}k of ${budget / 1000:,.0f}k a year into {names[gainer]}",
            "finding": " ".join(finding),
            "evidence_sql": EVIDENCE_SQL,
            "recommendation": "; ".join(f"{names[c]} ${base[c]:,.0f} -> ${rec[c]:,.0f}" for c in sorted(rec, key=lambda c: rec[c] - base[c], reverse=True)),
            "deltas": {c: {"current_usd": round(base[c]), "recommended_usd": round(rec[c]), "delta_usd": round(rec[c] - base[c]),
                           "sqls_before": round(f[c](base[c]), 1), "sqls_after": round(f[c](rec[c]), 1),
                           "sqls_estimated": ch[c]["estimated"]} for c in rec},
            "impact": {"budget_usd": round(budget), "run_rate_usd": round(run_rate), "moved_usd": round(moved),
                       "auto_moved_usd": round(moved) if status == "auto_applied" else 0,
                       "sqls_before": round(before, 1), "sqls_after": round(after, 1), "sql_gain": round(after - before, 1),
                       "expected_wins_before": round(before * win, 2), "expected_wins_after": round(after * win, 2),
                       "autonomy_limit_usd": round(dec["cap"]), "autonomy_used_usd": round(dec["cap_used"]),
                       "estimated_channels": [names[c] for c in ch if ch[c]["estimated"]],
                       "not_allocated": sorted(r["CHANNEL_ID"] for r in rows if r["CHANNEL_ID"] not in sm),
                       "policy": "v2", "channels": dec["channels"]},
            "status": status,
        }

    out = []
    if dec["auto_moved"] > 0:
        out.append(memo(current, dec["auto"], "auto_applied", dec["auto_moved"], "Auto-applied"))
    rest = sum(max(dec["target"][c] - dec["auto"][c], 0) for c in current)
    if rest >= p["MIN_MOVE_PCT"] * budget:
        out.append(memo(dec["auto"], dec["target"], "pending", rest, "Needs approval"))
    if not dry_run:
        if any(m["status"] == "pending" for m in out):
            session.sql("UPDATE CMO_DB.CORE.DECISION_LOG SET status = 'superseded', decided_at = CURRENT_TIMESTAMP() "
                        "WHERE kind = 'reallocation' AND status = 'pending'").collect()
        for m in out:
            session.sql("""INSERT INTO CMO_DB.CORE.DECISION_LOG (memo_id, kind, title, finding, evidence_sql, recommendation, deltas, impact, status)
                           SELECT ?, ?, ?, ?, ?, ?, PARSE_JSON(?), PARSE_JSON(?), ?""",
                        params=[m["memo_id"], m["kind"], m["title"], m["finding"], m["evidence_sql"], m["recommendation"],
                                json.dumps(m["deltas"]), json.dumps(m["impact"]), m["status"]]).collect()
            if m["status"] == "auto_applied":
                m["apply"] = session.call("CMO_DB.CORE.APPLY_MEMO_V2", m["memo_id"], True)
                if m["apply"] != "applied":
                    m["status"] = "pending"
    summary = {"policy": "v2", "dry_run": bool(dry_run), "budget_usd": round(budget), "moved_usd": round(dec["moved"]),
               "auto_moved_usd": round(dec["auto_moved"]), "autonomy_limit_usd": round(dec["cap"]),
               "autonomy_used_usd": round(dec["cap_used"]), "significant_pairs": dec["significant_pairs"],
               "channels": dec["channels"], "memos": [{"memo_id": m["memo_id"], "status": m["status"]} for m in out]}
    if not out:
        return {"memo_id": None, "kind": "reallocation", "status": "hold", "title": "Hold: no move beats the noise band",
                "finding": "No channel's marginal cost per SQL is significantly and persistently worse than another's.",
                "deltas": {}, "impact": {"budget_usd": round(budget), "moved_usd": 0}, "v2": summary}
    primary = next((m for m in out if m["status"] == "pending"), out[0])
    return {**primary, "v2": summary}
$$;

-- Sets each channel's plan to the memo's recommended spend. AUTO = TRUE (auto-apply) re-checks the rolling weekly
-- autonomy cap first and leaves the memo pending instead of applying over it. Human approvals don't count.
CREATE OR REPLACE PROCEDURE CMO_DB.CORE.APPLY_MEMO_V2(MEMO_ID STRING, AUTO BOOLEAN DEFAULT FALSE)
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
  this_move FLOAT;
  budget FLOAT;
  used FLOAT;
BEGIN
  IF (AUTO) THEN
    SELECT COALESCE(impact:auto_moved_usd, impact:moved_usd)::FLOAT, impact:budget_usd::FLOAT INTO :this_move, :budget
      FROM CMO_DB.CORE.DECISION_LOG WHERE memo_id = :MEMO_ID;
    SELECT COALESCE(SUM(COALESCE(impact:auto_moved_usd, impact:moved_usd)::FLOAT), 0) INTO :used
      FROM CMO_DB.CORE.DECISION_LOG
      WHERE kind = 'reallocation' AND status = 'auto_applied' AND memo_id <> :MEMO_ID
        AND created_at > DATEADD('day', -7, CURRENT_TIMESTAMP());
    IF (used + this_move > COALESCE(CMO_DB.CORE.A('AUTONOMY_WEEKLY_PCT'), 0.10) * budget + 1) THEN
      UPDATE CMO_DB.CORE.DECISION_LOG SET status = 'pending' WHERE memo_id = :MEMO_ID;
      RETURN 'over weekly autonomy cap: left pending';
    END IF;
  END IF;
  INSERT INTO CMO_DB.CORE.ALLOCATION (channel_id, period, planned_usd, memo_id)
  SELECT d.key, (SELECT txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD'), d.value:recommended_usd::FLOAT, :MEMO_ID
  FROM CMO_DB.CORE.DECISION_LOG m, LATERAL FLATTEN(input => m.deltas) d
  WHERE m.memo_id = :MEMO_ID;
  RETURN 'applied';
END;
$$;

-- ---- Swap V2 in for live (NOT run; the user decides) ----
-- DECIDE_MEMO stays as it is: it calls APPLY_MEMO for human approvals, which the weekly cap doesn't limit, and V2
-- memos have the same deltas shape. Only the proposer moves. V1 is kept under a new name for rollback.
--
--   ALTER PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(FLOAT) RENAME TO CMO_DB.CORE.PROPOSE_REALLOCATION_V1;
--   CREATE OR REPLACE PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(BUDGET FLOAT DEFAULT NULL)
--   RETURNS VARIANT LANGUAGE SQL AS
--   $$
--   DECLARE r VARIANT;
--   BEGIN
--     CALL CMO_DB.CORE.PROPOSE_REALLOCATION_V2(:BUDGET, FALSE) INTO :r;
--     RETURN r;
--   END;
--   $$;
--
-- Rollback:
--   DROP PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(FLOAT);
--   ALTER PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION_V1(FLOAT) RENAME TO CMO_DB.CORE.PROPOSE_REALLOCATION;
