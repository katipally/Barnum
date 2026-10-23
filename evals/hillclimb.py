"""Automated hill climb over the v2 decision logic's parameters on CMO-Bench.

CMO-Bench: every world in world.py x 6 training seeds x 26 weeks, plus the 5 trap-ledger checks.
Score: regret (qualified leads lost vs the oracle, %) plus a 1-point penalty for every trap the candidate falls into,
so a policy can't buy low regret by being reckless. Lower is better.

Search: (1+8) evolution strategy from a deliberately naive, purely reactive starting point. Each generation mutates the
current best eight times, scores the candidates in parallel and keeps the best one if it improves. Every new best is
also scored on 6 held-out seeds, to show the gain isn't overfitting.

Run: uv run python -m evals.hillclimb [--generations 18 --workers 8 --write]
"""
from __future__ import annotations

import argparse
import json
import random
import uuid
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

TRAIN = [1, 2, 3, 4, 5, 6]
TEST = [7, 8, 9, 10, 11, 12]
TRAP_SEEDS = [1, 2, 3]
WEEKS = 26
TRAP_PENALTY = 1.0  # regret points per trap fallen into
OUT = Path(__file__).parent / "hillclimb_result.json"

# Search space: (low, high, is_int). The 10% autonomy limit is the CEO's, so it is not searched.
SPACE = {
    "JUDGE_MIN_WEEKS": (1, 12, True),
    "STOP_LOSS_X": (1.2, 6.0, False),
    "STOP_LOSS_GRACE_WEEKS": (0, 6, True),
    "NOISE_Z": (0.0, 2.5, False),
    "NOISE_PERSIST_WEEKS": (1, 5, True),
    "FLIP_COOLDOWN_WEEKS": (0, 8, True),
    "EVIDENCE_WINDOW_WEEKS": (2, 16, True),
    "MIN_MOVE_PCT": (0.0, 0.03, False),
}
# Purely reactive: judges after one week, no noise band, no cooldown, a short memory.
START = {"JUDGE_MIN_WEEKS": 1, "STOP_LOSS_X": 1.5, "STOP_LOSS_GRACE_WEEKS": 0, "NOISE_Z": 0.0, "NOISE_PERSIST_WEEKS": 1,
         "FLIP_COOLDOWN_WEEKS": 0, "EVIDENCE_WINDOW_WEEKS": 3, "MIN_MOVE_PCT": 0.0}

_base = None


def _init():
    global _base
    from .world import load

    _base = load()


def _score(policy_name: str, seeds: list[int], with_traps: bool) -> dict:
    from .backtest import evaluate
    from .traps import run_traps
    from .traps_v2 import salami_ok
    from .world import SCENARIOS

    rs = [evaluate(policy_name, w, _base, WEEKS, s) for w in SCENARIOS for s in seeds]
    regret = 100 * sum(r.regret_pct for r in rs) / len(rs)
    out = {"regret": regret}
    if with_traps:
        traps = {**run_traps(policy_name, _base, WEEKS, TRAP_SEEDS), "salami-slicing": salami_ok(policy_name, _base, TRAP_SEEDS)}
        out["traps"] = traps
        out["failed"] = sum(1 for v in traps.values() if not v)
        out["objective"] = regret + TRAP_PENALTY * out["failed"]
    return out


def _evaluate_params(p: dict, test: bool = False) -> dict:
    from . import policy_v2
    from .backtest import POLICIES

    full = {**policy_v2.core["params"]({}), **p}
    POLICIES["hc_candidate"] = lambda obs, full=full: policy_v2.decide(obs, full)["auto"]
    out = _score("hc_candidate", TRAIN, True)
    if test:
        out["test_regret"] = _score("hc_candidate", TEST, False)["regret"]
    return out


def _evaluate_policy(name: str) -> dict:
    from . import policy_v2  # noqa: F401  registers marginal_sql_v2_proc

    out = _score(name, TRAIN, True)
    out["test_regret"] = _score(name, TEST, False)["regret"]
    return out


def mutate(p: dict, rng: random.Random) -> dict:
    q = dict(p)
    for k in rng.sample(list(SPACE), rng.choice([1, 2, 3])):
        lo, hi, is_int = SPACE[k]
        if is_int:
            q[k] = int(min(hi, max(lo, q[k] + rng.choice([-2, -1, 1, 2]))))
        else:
            q[k] = round(min(hi, max(lo, q[k] + rng.gauss(0, 0.2 * (hi - lo)))), 4)
    return q


def climb(generations: int, offspring: int, workers: int, seed: int) -> dict:
    rng = random.Random(seed)
    experiments = []
    with ProcessPoolExecutor(workers, initializer=_init) as ex:
        refs = dict(zip(["shipped v1", "shipped v2", "status quo", "cheap MQLs"],
                        ex.map(_evaluate_policy, ["marginal_sql", "marginal_sql_v2_proc", "status_quo", "cheap_mqls"])))
        best_p = dict(START)
        best = ex.submit(_evaluate_params, best_p, True).result()
        experiments.append({"i": 0, "gen": 0, "params": best_p, **best, "accepted": True,
                            "best_objective": best["objective"], "best_test": best["test_regret"], "best_failed": best["failed"]})
        for g in range(1, generations + 1):
            cands = [mutate(best_p, rng) for _ in range(offspring)]
            scores = list(ex.map(_evaluate_params, cands))
            j = min(range(offspring), key=lambda k: scores[k]["objective"])
            improved = scores[j]["objective"] < best["objective"] - 1e-9
            if improved:
                best_p = cands[j]
                best = {**scores[j], "test_regret": ex.submit(_evaluate_params, best_p, True).result()["test_regret"]}
            for k, (c, s) in enumerate(zip(cands, scores)):
                experiments.append({"i": len(experiments), "gen": g, "params": c, **s, "accepted": improved and k == j,
                                    "best_objective": best["objective"], "best_test": best["test_regret"], "best_failed": best["failed"]})
            print(f"gen {g:2d}: best {best['objective']:.2f} (regret {best['regret']:.2f}%, {best['failed']} traps failed, "
                  f"test {best['test_regret']:.2f}%){'  <- improved' if improved else ''}")
    return {"experiments": experiments, "refs": refs, "best_params": best_p, "trap_penalty": TRAP_PENALTY,
            "bench": {"worlds": 5, "train_seeds": TRAIN, "test_seeds": TEST, "weeks": WEEKS}}


def write(result: dict) -> None:
    from backend.app import snowflake as sf

    sf.execute("CREATE SCHEMA IF NOT EXISTS CMO_DB.EVALS")
    sf.execute("""CREATE TABLE IF NOT EXISTS CMO_DB.EVALS.HILLCLIMB (
                    run_id STRING, run_at TIMESTAMP_TZ, kind STRING, i INT, gen INT, name STRING, params VARIANT,
                    regret FLOAT, failed INT, objective FLOAT, test_regret FLOAT, accepted BOOLEAN,
                    best_objective FLOAT, best_test FLOAT, best_failed INT)""")
    run_id, now = uuid.uuid4().hex[:12], datetime.now(timezone.utc).isoformat()
    rows = [(run_id, now, "experiment", e["i"], e["gen"], None, json.dumps(e["params"]), e["regret"], e["failed"], e["objective"],
             e.get("test_regret"), e["accepted"], e["best_objective"], e["best_test"], e["best_failed"]) for e in result["experiments"]]
    rows += [(run_id, now, "reference", None, None, name, "{}", r["regret"], r["failed"], r["objective"], r["test_regret"],
              None, None, None, None) for name, r in result["refs"].items()]
    values = ", ".join(["(" + ", ".join(["%s"] * 15) + ")"] * len(rows))
    sf.execute(f"""INSERT INTO CMO_DB.EVALS.HILLCLIMB SELECT column1, column2::TIMESTAMP_TZ, column3, column4, column5, column6,
                   PARSE_JSON(column7), column8, column9, column10, column11, column12, column13, column14, column15 FROM VALUES {values}""",
               [v for r in rows for v in r])
    print(f"Wrote {len(rows)} rows to CMO_DB.EVALS.HILLCLIMB (run {run_id})")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--generations", type=int, default=18)
    p.add_argument("--offspring", type=int, default=8)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--write", action="store_true")
    a = p.parse_args()
    result = climb(a.generations, a.offspring, a.workers, a.seed)
    OUT.write_text(json.dumps(result, indent=1))
    refs = result["refs"]
    print("references:", {k: f"{v['objective']:.2f} (regret {v['regret']:.2f}%, {v['failed']} traps failed)" for k, v in refs.items()})
    print("best params:", result["best_params"])
    if a.write:
        write(result)


if __name__ == "__main__":
    main()
