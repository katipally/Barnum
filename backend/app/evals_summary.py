"""Hill-climbing summary of the agent's own evals (CMO_DB.EVALS), for the dashboard strip. Read-only."""
import json

from . import snowflake as sf

# The decision-logic ladder, in the order it was built (labels written by the evals harness).
LADDER = [
    ("decision-v1", "v1", "Shipped logic"),
    ("decision-v1.1", "v1.1", "Short window"),
    ("decision-v1.2", "v1.2", "Smoothed, patient"),
    ("decision-v2", "v2", "Shipped v2"),
]


def _safe(fn):
    try:
        return fn()
    except Exception:  # a missing EVALS table just leaves that part of the strip out
        return None


def _ladder() -> list[dict]:
    rows = sf.query("""SELECT version, ANY_VALUE(policy) policy, AVG(regret_pct) regret_pct, ANY_VALUE(traps) traps, MAX(run_at) run_at
                       FROM CMO_DB.EVALS.EVAL_RUNS WHERE version LIKE 'decision-%' GROUP BY version""")
    by = {r["version"]: r for r in rows}
    out = []
    for key, label, name in LADDER:
        r = by.get(key)
        if not r:
            continue
        traps = r["traps"] if isinstance(r["traps"], dict) else json.loads(r["traps"] or "{}")
        out.append({"version": label, "name": name, "policy": r["policy"], "regret_pct": float(r["regret_pct"]),
                    "traps_passed": sum(1 for v in traps.values() if v), "traps_total": len(traps), "traps": traps,
                    "run_at": str(r["run_at"])})
    return out


def _prompts() -> list[dict]:
    rows = sf.query("""SELECT prompt, AVG(regret_pct) regret_pct, ANY_VALUE(detail):violations::INT violations,
                              ANY_VALUE(n) calls, MAX(run_at) run_at
                       FROM CMO_DB.EVALS.SWEEP_RUNS
                       WHERE task = 'strategy' AND model = 'claude-sonnet-4-5' AND prompt IS NOT NULL
                         AND run_id = (SELECT run_id FROM CMO_DB.EVALS.SWEEP_RUNS WHERE task = 'strategy' AND model = 'claude-sonnet-4-5'
                                       ORDER BY run_at DESC LIMIT 1)
                       GROUP BY prompt ORDER BY prompt""")
    return [{"version": r["prompt"], "regret_pct": float(r["regret_pct"]), "limit_breaches": int(r["violations"] or 0),
             "decisions": int(r["calls"] or 0), "run_at": str(r["run_at"])} for r in rows]


def _golden() -> dict | None:
    """Latest scorecard run: answer correctness per question, plus the write-tool safety check when it was scored."""
    rows = sf.query("""WITH latest AS (SELECT run_name FROM CMO_DB.EVALS.AGENT_SCORECARD ORDER BY scored_at DESC LIMIT 1)
                       SELECT s.run_name, s.metric_name, COUNT_IF(s.passed) passed, COUNT(*) total, MAX(s.scored_at) scored_at
                       FROM CMO_DB.EVALS.AGENT_SCORECARD s JOIN latest l ON s.run_name = l.run_name
                       WHERE s.metric_name IN ('answer_correctness', 'no_write_tools') GROUP BY 1, 2""")
    by = {r["metric_name"]: r for r in rows}
    a = by.get("answer_correctness")
    if not a:
        return None
    safe = by.get("no_write_tools")
    return {"run": a["run_name"], "passed": int(a["passed"]), "total": int(a["total"]), "scored_at": str(a["scored_at"]),
            "no_write_tools": {"passed": int(safe["passed"]), "total": int(safe["total"])} if safe else None}


def _climb() -> dict | None:
    """Latest automated hill climb (evals/hillclimb.py): every experiment plus the reference policies."""
    rows = sf.query("""SELECT kind, i, name, regret, failed, objective, test_regret, accepted, best_objective, best_test, best_failed, run_at
                       FROM CMO_DB.EVALS.HILLCLIMB
                       WHERE run_id = (SELECT run_id FROM CMO_DB.EVALS.HILLCLIMB ORDER BY run_at DESC LIMIT 1)
                       ORDER BY kind, i""")
    if not rows:
        return None
    num = lambda v: None if v is None else float(v)
    exps = [{"i": int(r["i"]), "regret": num(r["regret"]), "failed": int(r["failed"]), "objective": num(r["objective"]),
             "accepted": bool(r["accepted"]), "best": num(r["best_objective"]), "best_test": num(r["best_test"]),
             "best_failed": int(r["best_failed"])} for r in rows if r["kind"] == "experiment"]
    refs = [{"name": r["name"], "regret": num(r["regret"]), "failed": int(r["failed"]), "objective": num(r["objective"])}
            for r in rows if r["kind"] == "reference"]
    return {"experiments": exps, "refs": refs, "run_at": str(rows[0]["run_at"]), "trap_penalty": 1.0, "traps_total": 5}


def hillclimb() -> dict:
    return {"decision": _safe(_ladder) or [], "prompts": _safe(_prompts) or [], "golden": _safe(_golden), "climb": _safe(_climb)}
