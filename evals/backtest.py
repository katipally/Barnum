"""Walk-forward backtest: each week a policy sees only past weeks, decides next week's allocation, the world plays it.

Regret is decision regret: the oracle's expected SQLs (true curves, full budget) minus the expected SQLs of the
policy's allocation, both steady-state and noise-free. Realised SQLs (with lag, carryover and real noise) are
reported too. Run: uv run python -m evals.backtest [--weeks 26 --seeds 1 2 3 --write --agent]
"""
from __future__ import annotations

import argparse
import heapq
import json
import random
import subprocess
from dataclasses import dataclass, field
from typing import Callable

from .world import SCENARIOS, World, load, world_at

AUTONOMY = 0.10   # share of the weekly budget a policy may move per week without approval (CORE.ASSUMPTIONS default)
STEP_SHARE = 0.01  # greedy allocation step, as a share of the budget
WARMUP = 8        # weeks of status-quo history every policy sees before its first decision


@dataclass
class Week:
    t: int
    alloc: dict[str, float]
    sqls: dict[str, float]
    mqls: dict[str, float]
    expected: float = 0.0  # steady-state expected SQLs of this allocation under the true curves
    oracle: float = 0.0


@dataclass
class Obs:
    """What a policy may see: past weeks only, plus declared assumptions (exponent, lag profile, limits)."""
    t: int
    history: list[Week]
    budget: float
    channels: list[str]
    exponent: dict[str, float]
    lag_profile: dict[str, int]
    autonomy: float = AUTONOMY

    @property
    def last(self) -> dict[str, float]:
        return self.history[-1].alloc


# ---- allocation helpers ----

def greedy(budget: float, curves: dict[str, Callable[[float], float]], mins: dict[str, float] | None = None) -> dict[str, float]:
    """Same marginal-value heap as CORE.PROPOSE_REALLOCATION; optimal for concave curves."""
    step = budget * STEP_SHARE
    rec = {c: (mins or {}).get(c, 0.0) for c in curves}
    left = budget - sum(rec.values())
    heap = [(-(f(rec[c] + step) - f(rec[c])), c) for c, f in curves.items()]
    heapq.heapify(heap)
    while left >= step and heap:
        _, c = heapq.heappop(heap)
        rec[c] += step
        left -= step
        heapq.heappush(heap, (-(curves[c](rec[c] + step) - curves[c](rec[c])), c))
    if left > 0:
        rec[max(rec, key=lambda c: curves[c](rec[c] + 1) - curves[c](rec[c]))] += left
    return rec


def toward(current: dict[str, float], target: dict[str, float], max_move: float) -> dict[str, float]:
    """Move from current to target, shifting at most max_move dollars (the autonomy limit as a trust region)."""
    keys = set(current) | set(target)
    need = sum(max(target.get(c, 0) - current.get(c, 0), 0) for c in keys)
    k = 1.0 if need <= max_move or need == 0 else max_move / need
    return {c: current.get(c, 0) + k * (target.get(c, 0) - current.get(c, 0)) for c in keys}


def observed_curve(obs: Obs, c: str, window: int | None, key: str = "sqls", lag: int = 0) -> Callable[[float], float] | None:
    """Fit the repo's curve S * (y / X) ** b to observed totals over the window (None = whole history).

    With a lag, results in the window are matched to the spend `lag` weeks earlier.
    """
    n = len(obs.history)
    win = window or n - lag
    if win <= 0 or n < win + lag:
        return None
    weeks = obs.history[n - win:]
    spend_weeks = obs.history[n - win - lag: n - lag]
    x = sum(w.alloc.get(c, 0) for w in spend_weeks) / win
    s = sum(getattr(w, key).get(c, 0) for w in weeks) / win
    if x <= 0 or s <= 0:
        return None
    b = obs.exponent[c]
    return lambda y, s=s, x=x, b=b: s * (y / x) ** b if y > 0 else 0.0


# ---- policies ----

def status_quo(obs: Obs) -> dict[str, float]:
    return dict(obs.last)


def equal(obs: Obs) -> dict[str, float]:
    return {c: obs.budget / len(obs.channels) for c in obs.channels}


def cheap_mqls(obs: Obs) -> dict[str, float]:
    """The dashboard trap: chase the lowest cost per MQL, inside the same weekly limit as everyone else."""
    curves = {c: f for c in obs.channels if (f := observed_curve(obs, c, None, "mqls"))}
    return toward(obs.last, greedy(obs.budget, curves), obs.autonomy * obs.budget) if curves else dict(obs.last)


def marginal_sql(obs: Obs) -> dict[str, float]:
    """v1, mirrors CORE.PROPOSE_REALLOCATION: period-to-date curves per channel, channels with no SQLs get nothing."""
    curves = {c: f for c in obs.channels if (f := observed_curve(obs, c, None))}
    return toward(obs.last, greedy(obs.budget, curves), obs.autonomy * obs.budget) if curves else dict(obs.last)


def marginal_sql_v2(obs: Obs) -> dict[str, float]:
    """v2: a 6-week window so it notices change; lagged channels are judged on the spend that caused their
    results, and keep their budget until 6 weeks of those results exist."""
    curves, held = {}, {}
    for c in obs.channels:
        lag = obs.lag_profile.get(c, 0)
        if _funded_streak(obs, c) < 6 + lag:
            held[c] = obs.last.get(c, 0)  # too young to judge: no verdict before its results can arrive
        elif f := observed_curve(obs, c, 6, lag=lag):
            curves[c] = f
    target = greedy(obs.budget - sum(held.values()), curves) if curves else {}
    return toward(obs.last, {**target, **held}, obs.autonomy * obs.budget)


def marginal_sql_v3(obs: Obs, half_life: float = 3.0, min_gain: float = 0.03) -> dict[str, float]:
    """v3 (experiment): v2's lag handling, exponentially weighted estimates instead of a hard window, and a
    deadband: only move when the expected gain is at least `min_gain`, so noise alone doesn't move money."""
    decay = 0.5 ** (1 / half_life)
    curves, held = {}, {}
    n = len(obs.history)
    for c in obs.channels:
        lag = obs.lag_profile.get(c, 0)
        if _funded_streak(obs, c) < 6 + lag:
            held[c] = obs.last.get(c, 0)
            continue
        wts = [decay ** (n - 1 - i) for i in range(lag, n)]
        s = sum(wt * obs.history[i].sqls.get(c, 0) for wt, i in zip(wts, range(lag, n))) / sum(wts)
        x = sum(wt * obs.history[i - lag].alloc.get(c, 0) for wt, i in zip(wts, range(lag, n))) / sum(wts)
        if s > 0 and x > 0:
            b = obs.exponent[c]
            curves[c] = lambda y, s=s, x=x, b=b: s * (y / x) ** b if y > 0 else 0.0
    if not curves:
        return dict(obs.last)
    target = {**greedy(obs.budget - sum(held.values()), curves), **held}
    value = lambda a: sum(f(a.get(c, 0)) for c, f in curves.items())
    proposal = toward(obs.last, target, obs.autonomy * obs.budget)
    return proposal if value(proposal) >= (1 + min_gain) * value(obs.last) else dict(obs.last)


def _funded_streak(obs: Obs, c: str) -> int:
    """Consecutive most recent weeks in which channel c had budget."""
    n = 0
    for w in reversed(obs.history):
        if w.alloc.get(c, 0) <= 0:
            break
        n += 1
    return n


def agent(obs: Obs) -> dict[str, float]:
    """The live CMO agent (CMO_DB.CORE.CMO_AGENT) given an as-of context pack. About 30 s per call."""
    import asyncio

    import httpx

    from backend.app import snowflake as sf

    async def call() -> str:
        async with httpx.AsyncClient() as client:
            return (await sf.run_agent("CORE", "CMO_AGENT", context_pack(obs), client))["text"]

    try:
        return parse_alloc(asyncio.run(call()), obs)
    except Exception as e:  # a failed call keeps the plan; the run records it as a status-quo week
        print(f"  [agent] week {obs.t}: {e}; keeping current plan")
        return dict(obs.last)


def context_pack(obs: Obs) -> str:
    recent = obs.history[-6:]
    lines = []
    for c in obs.channels:
        spend = sum(w.alloc.get(c, 0) for w in recent)
        sqls = sum(w.sqls.get(c, 0) for w in recent)
        mqls = sum(w.mqls.get(c, 0) for w in recent)
        lines.append(f"- {c}: now ${obs.last.get(c, 0):,.0f}/week; last 6 weeks spend ${spend:,.0f}, MQLs {mqls:.1f}, SQLs {sqls:.1f}, "
                     f"declared lag {obs.lag_profile.get(c, 0)} weeks")
    return (
        "This is an offline simulation for evaluation. Use ONLY the data below; do not call tools or query Snowflake.\n"
        f"Week {obs.t}. Weekly marketing budget ${obs.budget:,.0f}. You may move at most {obs.autonomy:.0%} of it per week.\n"
        "Goal: maximise qualified sales leads (SQLs) per dollar. Returns diminish (exponent ~0.5). Channels with a lag "
        "show results that many weeks after spend.\n" + "\n".join(lines) +
        '\nReply with JSON only: {"allocation": {"<channel>": <usd per week>, ...}} summing to the budget.'
    )


def parse_alloc(text: str, obs: Obs) -> dict[str, float]:
    j = json.loads(text[text.index("{"): text.rindex("}") + 1])
    raw = j.get("allocation", j)
    alloc = {c: max(0.0, float(raw.get(c, 0))) for c in obs.channels}
    total = sum(alloc.values())
    if total <= 0:
        raise ValueError("empty allocation")
    return {c: v * obs.budget / total for c, v in alloc.items()}  # normalise; the limit itself is checked by the traps


POLICIES: dict[str, Callable[[Obs], dict[str, float]]] = {
    "status_quo": status_quo,
    "equal": equal,
    "cheap_mqls": cheap_mqls,
    "marginal_sql": marginal_sql,
    "marginal_sql_v2": marginal_sql_v2,
    "marginal_sql_v3": marginal_sql_v3,
}
OPTIONAL = {"agent": agent}


# ---- simulation ----

def _true_expected(w: World, alloc: dict[str, float]) -> float:
    return sum(ch.expected(alloc.get(c, 0)) for c, ch in w.channels.items())


def run(scenario: str, policy: Callable[[Obs], dict[str, float]], base: World, weeks: int = 26, seed: int = 1,
        decide_every: int = 1) -> list[Week]:
    rng = random.Random(seed)
    budget = base.weekly_budget
    names = list(base.channels)
    lag_profile = {c: world_at(base, scenario, 0).channels[c].lag_weeks for c in names}
    exponent = {c: base.channels[c].exponent for c in names}
    new = set(SCENARIO_NEW.get(scenario, ()))  # channels launched at the start of the warm-up: no earlier results
    history: list[Week] = []
    carry = {c: 0.0 for c in names}
    alloc = dict(base.start_alloc)
    for t in range(-WARMUP, weeks):
        w = world_at(base, scenario, max(t, 0))
        if t >= 0 and t % decide_every == 0:
            alloc = policy(Obs(t, history, budget, names, exponent, lag_profile))
        sqls, mqls = {}, {}
        for c, ch in w.channels.items():
            past = t - ch.lag_weeks
            if past >= t:
                spent = alloc.get(c, 0)
            elif past >= -WARMUP:
                spent = history[past + WARMUP].alloc.get(c, 0)
            else:
                spent = 0.0 if c in new else base.start_alloc[c]
            carry[c] = ch.expected(spent) + ch.carryover * carry[c]
            sqls[c] = carry[c] * (1 - ch.carryover) * rng.choice(base.residuals)
            mqls[c] = sqls[c] / ch.mql_to_sql
        oracle = _true_expected(w, greedy(budget, {c: ch.expected for c, ch in w.channels.items()}))
        history.append(Week(t, dict(alloc), sqls, mqls, _true_expected(w, alloc), oracle))
    return [h for h in history if h.t >= 0]


# Scenarios whose channels are new at the warm-up start (so a lagged channel shows nothing at first).
SCENARIO_NEW = {"billboard_lag": ["billboard"]}


@dataclass
class Result:
    policy: str
    world: str
    seed: int
    sqls: float
    expected: float
    oracle: float
    trace: list[Week] = field(repr=False, default_factory=list)

    @property
    def regret(self) -> float:
        return self.oracle - self.expected

    @property
    def regret_pct(self) -> float:
        return self.regret / self.oracle if self.oracle else 0.0


def evaluate(policy_name: str, scenario: str, base: World, weeks: int, seed: int, decide_every: int = 1) -> Result:
    fn = POLICIES.get(policy_name) or OPTIONAL[policy_name]
    trace = run(scenario, fn, base, weeks, seed, decide_every)
    return Result(policy_name, scenario, seed, sum(sum(w.sqls.values()) for w in trace),
                  sum(w.expected for w in trace), sum(w.oracle for w in trace), trace)


def version() -> str:
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "evals"], capture_output=True, text=True).stdout.strip()
        return sha + ("-dirty" if dirty else "")
    except Exception:
        return "unknown"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--policies", nargs="*", default=list(POLICIES))
    p.add_argument("--worlds", nargs="*", default=list(SCENARIOS))
    p.add_argument("--weeks", type=int, default=26)
    p.add_argument("--seeds", type=int, nargs="*", default=[1, 2, 3])
    p.add_argument("--agent", action="store_true", help="also run the live CMO agent (slow: ~30 s per decision)")
    p.add_argument("--decide-every", type=int, default=1, help="weeks between decisions (use 2-4 with --agent)")
    p.add_argument("--refit", action="store_true", help="refit the world from Snowflake instead of the JSON cache")
    p.add_argument("--write", action="store_true", help="write results to CMO_DB.EVALS.EVAL_RUNS")
    p.add_argument("--label", default=None, help="version label stored with the run (default: git sha)")
    a = p.parse_args()

    base = load(refit=a.refit)
    policies = a.policies + (["agent"] if a.agent else [])
    results = [evaluate(pol, w, base, a.weeks, s, a.decide_every) for pol in policies for w in a.worlds for s in a.seeds]
    from .traps import run_traps  # deferred: traps imports this module
    traps = {pol: run_traps(pol, base, a.weeks, a.seeds, a.decide_every) for pol in policies}
    print_table(results, traps, a.worlds, policies, base)
    if a.write:
        from .store import write_runs
        n = write_runs(results, traps, a.label or version(), a.weeks)
        print(f"\nWrote {n} rows to CMO_DB.EVALS.EVAL_RUNS")


def print_table(results: list[Result], traps: dict[str, dict[str, bool]], worlds: list[str], policies: list[str], base: World) -> None:
    def cell(pol: str, w: str) -> str:
        rs = [r for r in results if r.policy == pol and r.world == w]
        reg = sum(r.regret_pct for r in rs) / len(rs)
        sq = sum(r.sqls for r in rs) / len(rs)
        return f"{reg:6.1%} {sq:5.1f}"

    print(f"Weekly budget ${base.weekly_budget:,.0f}; channels: {', '.join(base.channels)}; seeds averaged.")
    print("Cell = decision regret vs oracle (lower is better)  realised SQLs over the run\n")
    w0 = max(len(p) for p in policies) + 2
    print("policy".ljust(w0) + "".join(w[:17].rjust(18) for w in worlds) + "   traps passed")
    for pol in policies:
        t = traps.get(pol, {})
        print(pol.ljust(w0) + "".join(cell(pol, w).rjust(18) for w in worlds) + f"   {sum(t.values())}/{len(t)}")
    print("\nTrap ledger (pass on every seed):")
    names = list(next(iter(traps.values())).keys()) if traps else []
    print("policy".ljust(w0) + "".join(n.rjust(22) for n in names))
    for pol in policies:
        print(pol.ljust(w0) + "".join(("PASS" if traps[pol][n] else "FAIL").rjust(22) for n in names))


if __name__ == "__main__":
    main()
