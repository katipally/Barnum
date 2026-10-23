"""A synthetic marketing world fitted to CMO_DB, so decisions can be scored against a known optimum.

Each channel follows the repo's own response curve (see sql/30_decisions.sql), per week:
    expected_sqls(spend) = S_w * (spend / X_w) ** b      S_w, X_w = weekly SQLs and spend at the fitted point
plus a lag (results arrive later), carryover (part of last week's effect persists) and real week-to-week noise.

Fitting reads CORE.CHANNEL_SUMMARY (annualised spend/SQLs) and CORE.FUNNEL_FACT (weekly series for noise and lag),
then caches to evals/world_cache.json so later runs need no Snowflake. Read-only: nothing in CORE is touched.
"""
from __future__ import annotations

import copy
import json
import math
from dataclasses import asdict, dataclass, field
from pathlib import Path

CACHE = Path(__file__).parent / "world_cache.json"
WEEKS_PER_YEAR = 52

# Conferences have SQLs but no spend in the live export; their cost per SQL comes from the seed's PRD Q4 table
# ($12k for 7 SQLs). Marked `imputed` in the cache so nobody mistakes it for a measured number.
IMPUTED_COST_PER_SQL = {"conferences": 1714.0}
# Lag/carryover by channel kind. Billboard lag is measured from FUNNEL_FACT when possible (first spend -> first SQL).
LAG_WEEKS = {"billboard": 8, "conferences": 4, "linkedin": 1}
CARRYOVER = {"billboard": 0.5, "conferences": 0.3}


@dataclass
class Channel:
    name: str
    weekly_spend: float      # X_w: fitted operating point
    weekly_sqls: float       # S_w: expected SQLs at X_w
    exponent: float          # b: diminishing returns, 0 < b < 1
    mql_to_sql: float        # MQLs = SQLs / mql_to_sql (what an MQL dashboard sees)
    lag_weeks: int = 0
    carryover: float = 0.0
    imputed: bool = False
    source: str = ""

    def expected(self, spend: float) -> float:
        """Steady-state expected SQLs per week for this weekly spend (no lag, no noise)."""
        return self.weekly_sqls * (spend / self.weekly_spend) ** self.exponent if spend > 0 else 0.0


@dataclass
class World:
    channels: dict[str, Channel]
    residuals: list[float] = field(default_factory=lambda: [1.0])  # multiplicative weekly noise, from real weeks
    weekly_budget: float = 0.0
    start_alloc: dict[str, float] = field(default_factory=dict)  # status quo: the live spend mix
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {"channels": {k: asdict(v) for k, v in self.channels.items()}, "residuals": self.residuals,
                "weekly_budget": self.weekly_budget, "start_alloc": self.start_alloc, "notes": self.notes}

    @classmethod
    def from_json(cls, d: dict) -> World:
        return cls({k: Channel(**v) for k, v in d["channels"].items()}, d["residuals"], d["weekly_budget"], d["start_alloc"], d["notes"])

    def copy(self) -> World:
        return copy.deepcopy(self)


def fit_from_snowflake() -> World:
    from backend.app import snowflake as sf

    rows = sf.query("""SELECT channel_id, annual_spend_usd, annual_sqls, mql_to_sql, response_exponent
                       FROM CMO_DB.CORE.CHANNEL_SUMMARY""")
    notes, channels = [], {}
    for r in rows:
        cid, spend, sqls = r["channel_id"], r["annual_spend_usd"], r["annual_sqls"]
        b = float(r["response_exponent"] or 0.52)
        m2s = float(r["mql_to_sql"] or 0.15)
        imputed = False
        if (not spend) and sqls and cid in IMPUTED_COST_PER_SQL:
            spend, imputed = float(sqls) * IMPUTED_COST_PER_SQL[cid], True
            notes.append(f"{cid}: spend imputed at ${IMPUTED_COST_PER_SQL[cid]:,.0f}/SQL (seed PRD table)")
        if not spend or not sqls:
            notes.append(f"{cid}: skipped (no spend or no SQLs in CHANNEL_SUMMARY)")
            continue
        channels[cid] = Channel(cid, float(spend) / WEEKS_PER_YEAR, float(sqls) / WEEKS_PER_YEAR, b, m2s,
                                LAG_WEEKS.get(cid, 0), CARRYOVER.get(cid, 0.0), imputed, "CORE.CHANNEL_SUMMARY")

    weekly = sf.query("""SELECT channel, DATE_TRUNC('week', date) wk, SUM(spend_usd) spend, SUM(sqls) sqls
                         FROM CMO_DB.CORE.FUNNEL_FACT GROUP BY 1, 2 ORDER BY 1, 2""")
    # Noise: each real week's SQLs relative to its channel's mean, from channels with a weekly series.
    residuals = []
    for cid in {w["channel"] for w in weekly}:
        series = [float(w["sqls"]) for w in weekly if w["channel"] == cid and w["sqls"] is not None]
        nonzero = [s for s in series if s > 0]
        if len(nonzero) >= 5:
            mean = sum(nonzero) / len(nonzero)
            residuals += [min(3.0, max(0.3, s / mean)) for s in nonzero]
    if not residuals:
        residuals = [1.0]
        notes.append("no weekly series long enough for noise; world is noise-free")
    else:
        notes.append(f"noise: {len(residuals)} real weekly residuals, CV {_cv(residuals):.2f}")

    # Lag: weeks from a channel's first spend to its first SQL, where the weekly series shows it.
    for cid, ch in channels.items():
        series = [w for w in weekly if w["channel"] == cid]
        first_spend = next((w["wk"] for w in series if (w["spend"] or 0) > 0), None)
        first_sql = next((w["wk"] for w in series if (w["sqls"] or 0) > 0), None)
        if first_spend and first_sql and first_sql > first_spend:
            ch.lag_weeks = round((first_sql - first_spend).days / 7)
            notes.append(f"{cid}: lag {ch.lag_weeks} weeks measured from FUNNEL_FACT")

    total = sum(c.weekly_spend for c in channels.values())
    return World(channels, residuals, total, {k: c.weekly_spend for k, c in channels.items()}, notes)


def _cv(xs: list[float]) -> float:
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs)) / m


def load(refit: bool = False) -> World:
    if refit or not CACHE.exists():
        w = fit_from_snowflake()
        CACHE.write_text(json.dumps(w.to_json(), indent=1, default=str))
        return w
    return World.from_json(json.loads(CACHE.read_text()))


# ---- Scenarios: each returns the world as it is in week t (the truth the policies never see directly) ----

def _scale(w: World, cid: str, f: float) -> None:
    if cid in w.channels:
        w.channels[cid].weekly_sqls *= f


def baseline(w: World, t: int) -> World:
    return w


def competitor_shock(w: World, t: int) -> World:
    """A competitor starts bidding on our Google keywords in week 6: each dollar there buys 40% fewer SQLs."""
    if t >= 6:
        _scale(w, "google", 0.6)
    return w


def linkedin_trap(w: World, t: int) -> World:
    """LinkedIn floods the dashboard with the cheapest MQLs, but only 1% of them become SQLs."""
    if "linkedin" in w.channels:
        w.channels["linkedin"].mql_to_sql = 0.01
    return w


def billboard_lag(w: World, t: int) -> World:
    """Billboards are secretly the best channel per SQL, but results arrive 8 weeks late."""
    if "billboard" in w.channels:
        ch = w.channels["billboard"]
        ch.lag_weeks, ch.carryover = 8, 0.5
        best = max(c.weekly_sqls / c.weekly_spend for c in w.channels.values() if c.name != "billboard")
        ch.weekly_sqls = max(ch.weekly_sqls, 1.6 * best * ch.weekly_spend)
    return w


def creative_fatigue(w: World, t: int) -> World:
    """Google's ads wear out: each week the same spend buys 4% fewer SQLs until the creative is refreshed."""
    _scale(w, "google", 0.96 ** t)
    return w


SCENARIOS = {f.__name__: f for f in (baseline, competitor_shock, linkedin_trap, billboard_lag, creative_fatigue)}


def world_at(base: World, scenario: str, t: int) -> World:
    return SCENARIOS[scenario](base.copy(), t)
