"""V2 decision logic (sql/35_decisions_v2.sql): the ledger, the salami-slicing trap, and each rule on the core itself."""
import pytest

from evals.backtest import evaluate
from evals.policy_v2 import NAME, core
from evals.traps import TRAPS
from evals.traps_v2 import RULE, salami_ok
from evals.world import load

SEEDS = [1, 2, 3]
P = core["params"]({})


@pytest.fixture(scope="session")
def base():
    return load()


@pytest.mark.parametrize("trap", TRAPS, ids=lambda t: t.id)
def test_v2_ledger(trap, base, weeks):
    failed = [s for s in SEEDS if not trap.check(evaluate(NAME, trap.world, base, weeks, s).trace, base)]
    assert not failed, f"{NAME} falls into {trap.id} on seeds {failed}: {trap.rule}"


def test_v2_salami(base):
    assert salami_ok(NAME, base, SEEDS), RULE


def test_salami_catches_v1(base):
    assert not salami_ok("marginal_sql", base, SEEDS)


# ---- the core, one rule at a time. Two channels, $100/week; "cheap" is clearly better per SQL. ----

def _ch(age=20, lag=0, s_cheap=10.0, s_dear=2.0, rse=0.05, weeks=2):
    return {"cheap": {"b": 0.5, "lag": 0, "age": 20, "ev": [(50.0, s_cheap, rse)] * weeks},
            "dear": {"b": 0.5, "lag": lag, "age": age, "ev": [(50.0, s_dear, rse)] * weeks}}


CUR = {"cheap": 50.0, "dear": 50.0}


def test_moves_on_a_clear_persistent_gap():
    d = core["decide"](_ch(), CUR, 100.0, P)
    assert d["auto"]["cheap"] > 50 and d["auto_moved"] == pytest.approx(10.0)
    assert d["target"]["cheap"] > d["auto"]["cheap"]  # the rest of the move waits for approval


def test_cumulative_cap_across_calls():
    cur, used = dict(CUR), 0.0
    for _ in range(7):  # seven memos in one week
        d = core["decide"](_ch(), cur, 100.0, P, used)
        used += d["auto_moved"]
        cur = d["auto"]
    assert used == pytest.approx(10.0) and cur["dear"] == pytest.approx(40.0)


def test_patience_holds_a_lagged_channel():
    d = core["decide"](_ch(age=10, lag=8, s_dear=4.0), CUR, 100.0, P)  # judge after 8 + 6 weeks
    assert d["channels"]["dear"]["status"] == "patience" and d["auto"] == CUR


def test_stop_loss_cuts_before_the_window():
    d = core["decide"](_ch(age=10, lag=8, s_dear=1.0), CUR, 100.0, P)  # 10x the marginal cost, past lag + 2
    assert d["channels"]["dear"]["status"] == "stop_loss" and d["auto"]["dear"] < 50


def test_noise_band_holds_a_small_gap():
    d = core["decide"](_ch(s_dear=9.0, rse=0.25), CUR, 100.0, P)
    assert d["auto"] == CUR and "noise" in d["channels"]["cheap"]["blocked"]


def test_gap_must_persist():
    ch = _ch()
    ch["dear"]["ev"] = [(50.0, 2.0, 0.05), (50.0, 10.0, 0.05)]  # only this week's evaluation shows the gap
    assert core["decide"](ch, CUR, 100.0, P)["auto"] == CUR


def test_reversal_cooldown():
    d = core["decide"](_ch(), CUR, 100.0, P, last_move={"cheap": (-1, 2), "dear": (1, 2)})
    assert d["auto"] == CUR and "reverse" in d["channels"]["cheap"]["blocked"]
    assert core["decide"](_ch(), CUR, 100.0, P, last_move={"cheap": (-1, 5), "dear": (1, 5)})["auto"] != CUR
