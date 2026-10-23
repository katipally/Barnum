"""2027 plan helpers: parse the CMO's JSON answer, fall back deterministically, build campaign draft briefs.

Numbers always come from CORE.PLAN_2027; the agent only supplies verdicts, rationale, actions and risks.
"""
import json
import re

VERDICTS = ("start", "scale", "optimize", "maintain", "cut")
MAX_ACTIONS = 4
FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)

OBJECTIVE = {
    "start": "Launch a measured {name} campaign with ${usd:,.0f} in 2027.",
    "scale": "Scale what works in {name} up to ${usd:,.0f} in 2027.",
    "optimize": "Improve {name} efficiency within ${usd:,.0f} in 2027.",
    "maintain": "Hold {name} steady at ${usd:,.0f} in 2027 and keep measuring.",
    "cut": "Wind down {name} and redeploy its budget in 2027.",
}
KPIS = {
    "performance": ["SQLs per quarter", "Cost per SQL", "Customers won"],
    "brand": ["Impressions", "Clicks", "Mentions"],
    "unpriced": ["Contacts reached", "Meetings booked", "Cost per meeting"],
}
RISKS = {
    "performance": "Returns diminish as spend rises, so cost per SQL can climb faster than the plan assumes.",
    "brand": "Awareness lags and may not show up in SQLs within the year.",
    "unpriced": "No cost data yet, so the test may not show whether the channel can scale.",
}


def parse_agent_json(text: str) -> dict | None:
    """The fenced json block if present, else the outermost braces. None when nothing parses to an object."""
    candidates = [m.strip() for m in FENCE.findall(text or "")]
    start, end = (text or "").find("{"), (text or "").rfind("}")
    if 0 <= start < end:
        candidates.append(text[start:end + 1])
    for c in candidates:
        try:
            out = json.loads(c)
        except ValueError:
            continue
        if isinstance(out, dict):
            return out
    return None


def channel_answers(calls: dict) -> dict[str, str]:
    """channel_id -> answer text from the ask_channel tool results; failed or malformed results are skipped."""
    out = {}
    for call in calls.values():
        if call.get("name") != "ask_channel" or "result" not in call:
            continue
        try:
            res = json.loads(call["result"]["content"][0]["json"]["result"])
            out[res["channel"]] = res["answer"]
        except (KeyError, IndexError, TypeError, ValueError):
            continue
    return out


def _clean_actions(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    actions = [{"title": str(a["title"]).strip(), "detail": str(a.get("detail") or "").strip()}
               for a in raw if isinstance(a, dict) and str(a.get("title") or "").strip()]
    return actions[:MAX_ACTIONS]


def _first_sentence(text: str) -> str:
    return re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0][:300]


def _fallback(c: dict, portfolio_cps: float | None, answer: str | None) -> dict:
    """Deterministic verdict and actions: performance by cost per SQL against the performance blend, unpriced starts a measured test."""
    name, usd, kind = c["display_name"], c["budget_usd"], c["kind"]
    sqls_year = (c["projected_sqls_per_quarter"] or 0) * 4
    if usd <= 0:
        verdict = "cut"
    elif kind == "performance":
        verdict = "scale" if sqls_year and portfolio_cps and usd / sqls_year <= portfolio_cps else "optimize"
    else:
        verdict = "start" if kind == "unpriced" else "maintain"
    actions = {
        "cut": [("Pause spend", f"Stop {name} spend and move the budget to channels with a lower cost per SQL.")],
        "scale": [("Raise spend toward the plan", f"Step {name} up to ${usd:,.0f} in stages and watch cost per SQL at each step."),
                  ("Double down on the best campaigns", "Shift budget inside the channel toward campaigns with the lowest cost per SQL.")],
        "optimize": [("Cut the weakest campaigns", f"Review {name} campaigns by cost per SQL and pause the worst performers."),
                     ("Tighten targeting and creative", "Test narrower audiences and new creative before adding budget.")],
        "start": [("Run a measured test", f"Spend the ${usd:,.0f} test budget on {name} with a fixed time box and a cost per contact target."),
                  ("Track cost and outcomes", "Record spend per contact and meeting so the next plan has a cost curve.")],
        "maintain": [("Hold brand spend steady", f"Keep {name} at ${usd:,.0f} and report its native awareness metrics monthly."),
                     ("Link awareness to demand", "Tag landing pages or codes so brand reach can be traced to SQLs.")],
    }[verdict]
    return {"verdict": verdict, "rationale": _first_sentence(answer) if answer else c["basis_note"],
            "actions": [{"title": t, "detail": d} for t, d in actions], "risk": RISKS[kind], "source": "fallback"}


def merge_channels(numbers: dict, agent: dict | None, answers: dict[str, str]) -> list[dict]:
    """One object per planned channel: the deterministic numbers plus the agent's judgment where it is usable, else the fallback."""
    given = {c.get("channel_id"): c for c in (agent or {}).get("channels", []) if isinstance(c, dict)}
    perf = [c for c in numbers["channels"] if c["kind"] == "performance" and c["projected_sqls_per_quarter"]]
    sqls = sum(c["projected_sqls_per_quarter"] * 4 for c in perf)
    portfolio_cps = sum(c["budget_usd"] for c in perf) / sqls if sqls else None
    out = []
    for c in numbers["channels"]:
        g = given.get(c["channel_id"], {})
        actions = _clean_actions(g.get("actions"))
        if g.get("verdict") in VERDICTS and actions and isinstance(g.get("rationale"), str):
            judged = {"verdict": g["verdict"], "rationale": g["rationale"], "actions": actions,
                      "risk": str(g.get("risk") or RISKS[c["kind"]]), "source": "agent"}
        else:
            judged = _fallback(c, portfolio_cps, answers.get(c["channel_id"]))
        sqls_year = (c["projected_sqls_per_quarter"] or 0) * 4
        extra = {"plan_cost_per_sql": round(c["budget_usd"] / sqls_year, 2) if sqls_year else None,
                 "agent_recommends_cut": judged["source"] == "agent" and judged["verdict"] == "cut" and c["budget_usd"] > 0}
        out.append(c | judged | extra)
    return out


def fallback_summary(numbers: dict) -> str:
    t, tg = numbers["totals"], numbers["targets"]
    met = "meets" if tg["revenue"]["met"] and tg["sqls_per_quarter"]["met"] else "misses"
    return (f"${t['allocated_usd']:,.0f} of ${t['budget_usd']:,.0f} is allocated. The plan projects "
            f"{t['projected_sqls_per_quarter']:g} SQLs per quarter and ${t['projected_new_arr_usd']:,.0f} of new ARR, "
            f"so it {met} the targets.")


def build_brief(ch: dict) -> dict:
    """Campaign draft brief from a saved plan channel. Deterministic; nothing is sent to any platform."""
    actions = ch["actions"]
    kpis = list(KPIS[ch["kind"]])
    if ch["kind"] == "performance" and ch["projected_sqls_per_quarter"] is not None:
        kpis[0] += f" (plan: {ch['projected_sqls_per_quarter']:g})"
    return {"name": f"{ch['display_name']} 2027: {actions[0]['title']}" if actions else f"{ch['display_name']} 2027 campaign",
            "objective": OBJECTIVE[ch["verdict"]].format(name=ch["display_name"], usd=ch["budget_usd"]),
            "budget_usd": ch["budget_usd"], "kpis": kpis, "steps": actions}
