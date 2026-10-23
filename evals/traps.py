"""The trap ledger: mistakes a marketing allocator must never make, each a world plus a check on the weekly trace.

Add one entry for every real or backtest failure, so the agent can't fall into the same trap twice.
A trap passes only if it passes on every seed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .backtest import AUTONOMY, Week, evaluate
from .world import World


def share(trace: list[Week], c: str, t: int) -> float:
    a = trace[t].alloc
    return a.get(c, 0) / sum(a.values())


def _mean_share(trace: list[Week], c: str, weeks: range) -> float:
    return sum(share(trace, c, t) for t in weeks) / len(weeks)


@dataclass
class Trap:
    id: str
    world: str
    rule: str
    check: Callable[[list[Week], World], bool]


def _linkedin(trace: list[Week], base: World) -> bool:
    start = base.start_alloc["linkedin"] / base.weekly_budget
    return share(trace, "linkedin", len(trace) - 1) <= start + 0.005


def _patience(trace: list[Week], base: World) -> bool:
    start = base.start_alloc["billboard"] / base.weekly_budget
    return min(share(trace, "billboard", t) for t in range(6)) >= 0.5 * start


def _competitor(trace: list[Week], base: World) -> bool:
    return _mean_share(trace, "google", range(10, 14)) < _mean_share(trace, "google", range(2, 6)) - 0.02


def _calm(trace: list[Week], base: World) -> bool:
    budget = base.weekly_budget
    prev = base.start_alloc
    flips = {c: 0 for c in base.channels}
    last_dir = {c: 0 for c in base.channels}
    for w in trace:
        moved = sum(max(w.alloc.get(c, 0) - prev.get(c, 0), 0) for c in base.channels)
        if moved > AUTONOMY * budget * 1.001:
            return False
        for c in base.channels:
            d = w.alloc.get(c, 0) - prev.get(c, 0)
            sign = (d > 0.002 * budget) - (d < -0.002 * budget)
            if sign and last_dir[c] and sign != last_dir[c]:
                flips[c] += 1
            if sign:
                last_dir[c] = sign
        prev = w.alloc
    return max(flips.values()) <= 4


TRAPS = [
    Trap("linkedin-mql-trap", "linkedin_trap", "Cheapest MQLs, 1% become SQLs: never end up funding LinkedIn more than at the start.", _linkedin),
    Trap("billboard-patience", "billboard_lag", "Best channel, results arrive 8 weeks late: don't cut it below half its budget in the first 6 weeks.", _patience),
    Trap("react-to-competitor", "competitor_shock", "Google gets 40% worse in week 6: its share must be lower in weeks 10-13 than in weeks 2-5.", _competitor),
    Trap("no-overreaction", "baseline", "Nothing changes but real noise: never move more than the 10% limit a week, at most 4 reversals per channel.", _calm),
]


def run_traps(policy: str, base: World, weeks: int = 26, seeds: list[int] = (1, 2, 3), decide_every: int = 1) -> dict[str, bool]:
    return {trap.id: all(trap.check(evaluate(policy, trap.world, base, weeks, s, decide_every).trace, base) for s in seeds)
            for trap in TRAPS}
