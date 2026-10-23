"""Trap added with the V2 decision logic: salami slicing.

The weekly ledger in traps.py decides once a week, so it can't see a policy that is called several times a week and
moves its full per-memo limit each time. This trap calls the policy once a day for a week, in the week where its own
weekly run moved the most (so it wants to move), and checks the plan never moves more than the autonomy limit within
those 7 days.
"""
from __future__ import annotations

from .backtest import AUTONOMY, POLICIES, Obs, Week, evaluate, run
from .world import World

CALLS_PER_WEEK = 7
WORLDS = ["baseline", "billboard_lag", "competitor_shock"]


def busiest_week(policy: str, world: str, base: World, seed: int, weeks: int = 26) -> int:
    trace = evaluate(policy, world, base, weeks, seed).trace
    prev, best, best_t = base.start_alloc, -1.0, 0
    for w in trace:
        moved = sum(max(w.alloc.get(c, 0) - prev.get(c, 0), 0) for c in base.channels)
        if moved > best:
            best, best_t = moved, w.t
        prev = w.alloc
    return best_t


def _obs_at(policy: str, world: str, base: World, t: int, seed: int) -> Obs:
    seen: list[Obs] = []

    def record(obs: Obs) -> dict[str, float]:
        if obs.t == t:  # snapshot: run() appends this week's plan to the same history list after the call
            seen.append(Obs(obs.t, list(obs.history), obs.budget, obs.channels, obs.exponent, obs.lag_profile, obs.autonomy))
        return POLICIES[policy](obs)

    run(world, record, base, t + 1, seed)
    return seen[0]


def week_of_daily_calls(policy: str, world: str, base: World, t: int, seed: int) -> float:
    """Total dollars moved (sum of increases) from the start-of-week plan to the plan after 7 daily calls."""
    obs = _obs_at(policy, world, base, t, seed)
    history, start = list(obs.history), dict(obs.last)
    for _ in range(CALLS_PER_WEEK):
        alloc = POLICIES[policy](Obs(t, history, obs.budget, obs.channels, obs.exponent, obs.lag_profile, obs.autonomy))
        # A plan set earlier this week: same week number, last week's results (no new data arrives intra-week).
        history.append(Week(t, alloc, dict(history[-1].sqls), dict(history[-1].mqls)))
    return sum(max(history[-1].alloc.get(c, 0) - start.get(c, 0), 0) for c in obs.channels)


def salami_ok(policy: str, base: World, seeds=(1, 2, 3)) -> bool:
    return all(week_of_daily_calls(policy, w, base, busiest_week(policy, w, base, s), s) <= AUTONOMY * base.weekly_budget * 1.001
               for w in WORLDS for s in seeds)


RULE = "Called daily for a week, never move more than the 10% limit within those 7 days in total."
