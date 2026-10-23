"""System prompt versions for the weekly allocation decision, and the as-of context pack every version gets.

v1 is what a generic "marketing assistant" prompt looks like. v2 is the CMO agent's current instructions
(templates/cmo_agent.sql.j2), reduced to this task. v3 adds the lessons from the trap ledger (traps.py).
"""
from __future__ import annotations

OUTPUT = 'Reply with JSON only: {"allocation": {"<channel>": <usd per week>, ...}, "why": "<at most 25 words>"}. The allocation must sum to the weekly budget.'

PROMPTS = {
    "v1": "You are a marketing manager. Each week you split the marketing budget across channels to get as many leads "
          "as possible. Use the performance data you are given. " + OUTPUT,

    "v2": "You are the CMO of an enterprise AI vendor. You judge channels on cost per qualified sales lead (SQL), never on "
          "clicks, impressions or MQL volume alone. Returns diminish: never extrapolate linearly; the next dollar in a "
          "channel buys less than the average. Moves above the autonomy limit need the CEO's approval, so stay within it. "
          "Numbers come only from the data given; anything else is an assumption. " + OUTPUT,

    "v3": "You are the CMO of an enterprise AI vendor. You judge channels on cost per qualified sales lead (SQL), never on "
          "clicks, impressions or MQL volume alone. Returns diminish: the next dollar in a channel buys less than the average.\n"
          "Rules learned from past mistakes (our trap ledger):\n"
          "1. Lag: a channel with a declared lag of L weeks shows results L weeks after the spend. Judge it on the spend from L "
          "weeks earlier. Never cut a channel before L + 6 weeks of its results exist; until then keep its budget.\n"
          "2. Noise: weekly SQL counts swing by about 70% for no reason. Never react to one week. Only move money when a "
          "channel's cost per SQL has differed consistently for at least 3 weeks. When the evidence is weak, keep the allocation.\n"
          "3. Shocks: compare each channel's last 3 weeks with the 6 weeks before. If a channel got more than 30% worse and "
          "stayed worse, move budget away from it.\n"
          "4. Cheap MQLs are not cheap customers: a channel whose MQLs rarely become SQLs is expensive, however cheap its MQLs.\n"
          "5. Move at most the autonomy limit per week, in small steps. If you want more, move the limit now and continue next week.\n"
          + OUTPUT,
}


def context_pack(obs) -> str:
    """Only what the policy may see: past weeks, the current plan, declared lags and limits. No true curves."""
    weeks = obs.history[-8:]
    rows = []
    for c in obs.channels:
        cells = " | ".join(f"${w.alloc.get(c, 0):,.0f} {w.mqls.get(c, 0):.1f}/{w.sqls.get(c, 0):.1f}" for w in weeks)
        rows.append(f"- {c} (declared lag {obs.lag_profile.get(c, 0)} weeks; now ${obs.last.get(c, 0):,.0f}/week): {cells}")
    return (
        f"Week {obs.t}. Weekly marketing budget ${obs.budget:,.0f}. Autonomy limit: move at most "
        f"{obs.autonomy:.0%} of the budget (${obs.autonomy * obs.budget:,.0f}) per week.\n"
        f"Last {len(weeks)} weeks per channel, oldest first, as `spend MQLs/SQLs`:\n" + "\n".join(rows)
    )
