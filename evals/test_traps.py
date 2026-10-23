"""Trap ledger as tests. Default policy: marginal_sql (mirrors CORE.PROPOSE_REALLOCATION). Live agent: uv run pytest evals --policy agent (slow)."""
import pytest

from evals.backtest import evaluate
from evals.traps import TRAPS
from evals.world import load

SEEDS = [1, 2, 3]


@pytest.fixture(scope="session")
def base():
    return load()  # cached world; refit with: uv run python -m evals.backtest --refit


@pytest.mark.parametrize("trap", TRAPS, ids=lambda t: t.id)
def test_trap(trap, policy, weeks, base):
    every = 2 if policy == "agent" else 1
    failed = [s for s in SEEDS if not trap.check(evaluate(policy, trap.world, base, weeks, s, every).trace, base)]
    assert not failed, f"{policy} falls into {trap.id} on seeds {failed}: {trap.rule}"


# The ledger is only useful if its traps catch the obvious mistake; these keep the checks honest.
@pytest.mark.parametrize("trap_id, naive", [("linkedin-mql-trap", "cheap_mqls"), ("react-to-competitor", "status_quo")])
def test_trap_catches_naive_policy(trap_id, naive, base, weeks):
    trap = next(t for t in TRAPS if t.id == trap_id)
    assert not all(trap.check(evaluate(naive, trap.world, base, weeks, s).trace, base) for s in SEEDS)
