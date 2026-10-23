"""marginal_sql_v2_proc: the backtest twin of CORE.PROPOSE_REALLOCATION_V2.

It runs the exact decision core from sql/35_decisions_v2.sql (the block between the "v2 core" markers), fed with what
the simulated week shows: lag-matched weekly evidence, the plan history for the reversal cooldown, and the moves
already auto-applied this week for the cumulative cap. The only difference from Snowflake is where the inputs come from.
Importing this module registers the policy in backtest.POLICIES.
"""
from __future__ import annotations

from pathlib import Path

from .backtest import POLICIES, Obs, Week

SQL = Path(__file__).resolve().parent.parent / "sql" / "35_decisions_v2.sql"
_src = SQL.read_text()
CORE_SRC = _src[_src.index("# >>> v2 core"): _src.index("# <<< v2 core")]
core: dict = {}
exec(compile(CORE_SRC, str(SQL), "exec"), core)

NAME = "marginal_sql_v2_proc"


def _completed_weeks(obs: Obs) -> list[Week]:
    """One entry per finished week (the last plan of that week); entries dated this week are moves made today."""
    weeks: dict[int, Week] = {}
    for w in obs.history:
        if w.t < obs.t:
            weeks[w.t] = w
    return [weeks[t] for t in sorted(weeks)]


def _evidence(weeks: list[Week], c: str, lag: int, back: int, p: dict):
    end = len(weeks) - 1 - back
    win = int(p["EVIDENCE_WINDOW_WEEKS"])
    pairs = [(weeks[k - lag].alloc.get(c, 0), weeks[k].sqls.get(c, 0)) for k in range(max(end - win + 1, lag), end + 1)]
    return core["evidence"](pairs, p["NOISE_CV"])


def _age(weeks: list[Week], c: str) -> int:
    n = 0
    for w in reversed(weeks):
        if w.alloc.get(c, 0) <= 0:
            break
        n += 1
    return n


def inputs(obs: Obs, p: dict | None = None):
    p = p or core["params"]({})
    weeks = _completed_weeks(obs)
    ch = {}
    for c in obs.channels:
        lag = obs.lag_profile.get(c, 0)
        ev = []
        for i in range(int(p["NOISE_PERSIST_WEEKS"])):
            e = _evidence(weeks, c, lag, i, p)
            if e is None:
                break
            ev.append(e)
        ch[c] = {"b": obs.exponent[c], "lag": lag, "age": _age(weeks, c), "ev": ev, "floor": 0.0}
    # Rolling 7 days = this week's moves so far: from the last finished week's plan through each plan set today.
    plans = [weeks[-1].alloc] + [w.alloc for w in obs.history if w.t == obs.t]
    used = sum(sum(max(b.get(c, 0) - a.get(c, 0), 0) for c in obs.channels) for a, b in zip(plans, plans[1:]))
    last_move = {}
    hist = [w for w in obs.history if w.t <= obs.t]
    for prev, cur in zip(reversed(hist[:-1]), reversed(hist)):
        for c in obs.channels:
            d = cur.alloc.get(c, 0) - prev.alloc.get(c, 0)
            if c not in last_move and abs(d) > core["FLIP_THRESHOLD_PCT"] * obs.budget:
                last_move[c] = (1 if d > 0 else -1, obs.t - cur.t)
    return ch, dict(obs.last), used, last_move


def decide(obs: Obs, p: dict | None = None) -> dict:
    p = p or core["params"]({})
    ch, current, used, last_move = inputs(obs, p)
    return core["decide"](ch, current, obs.budget, p, used, last_move)


def marginal_sql_v2_proc(obs: Obs) -> dict[str, float]:
    """Auto-applied part only: in the backtest nobody approves the pending remainder."""
    return decide(obs)["auto"]


POLICIES[NAME] = marginal_sql_v2_proc
