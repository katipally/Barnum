"""Before/after for the V2 decision logic: v1 (marginal_sql) vs marginal_sql_v2_proc (PROPOSE_REALLOCATION_V2).

Run: uv run python -m evals.compare_v2 [--weeks 26 --seeds 1 2 3 --policies ...]
Prints regret per world, the four ledger traps, the salami-slicing trap, and the weekly moves/reversals behind them.
"""
from __future__ import annotations

import argparse

from . import policy_v2  # noqa: F401  registers marginal_sql_v2_proc
from .backtest import AUTONOMY, evaluate, print_table
from .traps import run_traps
from .traps_v2 import salami_ok
from .world import SCENARIOS, load


def behaviour(results, base) -> dict[str, tuple[float, int]]:
    """Per policy: largest weekly move (share of budget) and most reversals of one channel, over all runs."""
    out = {}
    for r in results:
        prev, last, flips, biggest = base.start_alloc, {}, {c: 0 for c in base.channels}, 0.0
        for w in r.trace:
            biggest = max(biggest, sum(max(w.alloc.get(c, 0) - prev.get(c, 0), 0) for c in base.channels) / base.weekly_budget)
            for c in base.channels:
                d = w.alloc.get(c, 0) - prev.get(c, 0)
                s = (d > 0.002 * base.weekly_budget) - (d < -0.002 * base.weekly_budget)
                if s and last.get(c) and s != last[c]:
                    flips[c] += 1
                if s:
                    last[c] = s
            prev = w.alloc
        b, f = out.get(r.policy, (0.0, 0))
        out[r.policy] = (max(b, biggest), max(f, max(flips.values())))
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--policies", nargs="*", default=["status_quo", "marginal_sql", "marginal_sql_v2_proc"])
    p.add_argument("--weeks", type=int, default=26)
    p.add_argument("--seeds", type=int, nargs="*", default=[1, 2, 3])
    a = p.parse_args()

    base = load()
    worlds = list(SCENARIOS)
    results = [evaluate(pol, w, base, a.weeks, s) for pol in a.policies for w in worlds for s in a.seeds]
    traps = {pol: run_traps(pol, base, a.weeks, a.seeds) for pol in a.policies}
    for pol in a.policies:
        traps[pol]["salami-slicing"] = salami_ok(pol, base, a.seeds)
    print_table(results, traps, worlds, a.policies, base)

    print(f"\nBehaviour (all worlds and seeds; limit {AUTONOMY:.0%} a week, ledger allows 4 reversals):")
    for pol, (big, flips) in behaviour(results, base).items():
        print(f"  {pol:24s} largest weekly move {big:5.1%}   most reversals of one channel {flips}")


if __name__ == "__main__":
    main()
