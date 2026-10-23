"""Checks against the real Datasaur exports, loaded with: python -m seed.load_real <test-data dir>

Expected values were computed independently from the CSVs with pandas, not from the pipeline.
pytest tests/
"""
import json

import pytest

from backend.app import queries
from backend.app import snowflake as sf

EXPECTED = {  # channel: (spend_usd or None, mqls or None, sqls or None)
    "google": (319_222.26, 2325, None),
    "linkedin": (22_725.41, 13, None),
    "billboard": (30_000.00, 112, None),
    "outbound": (None, 86, 77),
    "seo": (None, None, None),
    "geo": (None, None, None),
    "conferences": (None, 87, None),
    "email_threads": (None, None, None),
}
NO_SPEND = {"outbound", "seo", "geo", "conferences", "email_threads"}
NATIVE = {"seo": {"clicks": 12_462, "impressions": 1_314_511}, "geo": {"ai_answers": 240, "ai_mentions": 79},
          "conferences": {"events": 18, "attendees_est": 244_500, "sales_calls_booked_est": 34},
          "email_threads": {"replies": 337, "positive_meeting": 130, "engaged_question": 116, "internal_reply": 43, "bounce": 14,
                            "threads_replied": 244, "reply_step_sum": 520, "reply_lag_hours_sum": 16_969}}


@pytest.fixture(scope="module")
def raw():
    """Measured values straight from each MAP view, before cross-channel SQL estimation."""
    rows = sf.query("SELECT channel, SUM(spend_usd) spend, SUM(mqls) mqls, SUM(sqls) sqls FROM CMO_DB.CORE.FUNNEL_RAW GROUP BY 1")
    return {r["channel"]: r for r in rows}


@pytest.fixture(scope="module", autouse=True)
def author_data():
    """EXPECTED values are the author's private exports; skip on any other account."""
    active = {c["channel_id"] for c in queries.active_channels()}
    if not set(EXPECTED) <= active:
        pytest.skip(f"needs the 8 channels from seed.load_real, missing: {sorted(set(EXPECTED) - active)}")


@pytest.fixture(scope="module", autouse=True)
def clean(author_data):
    queries.reset_decisions()
    yield
    queries.reset_decisions()


@pytest.mark.parametrize("cid", sorted(EXPECTED))
def test_measured_values_match_export(cid, raw):
    spend, mqls, sqls = EXPECTED[cid]
    r = raw[cid]
    assert (r["spend"] is None) == (spend is None) and (spend is None or abs(r["spend"] - spend) <= 1), r
    assert (r["mqls"] is None) == (mqls is None) and (mqls is None or abs(r["mqls"] - mqls) < 1), r
    assert (r["sqls"] is None) == (sqls is None) and (sqls is None or abs(r["sqls"] - sqls) < 1), r


@pytest.mark.parametrize("cid", sorted(EXPECTED))
def test_channel_reconciles(cid):
    r = json.loads(sf.query(f"CALL CMO_DB.CH_{cid.upper()}.RECONCILE()")[0]["reconcile"])
    assert r["ok"], r


@pytest.mark.parametrize("cid", sorted(NATIVE))
def test_native_metrics_kept(cid):
    m = {r["metric"]: r["total"] for r in sf.query("SELECT metric, total FROM CMO_DB.CORE.CHANNEL_METRICS WHERE channel = %s", (cid,))}
    for k, v in NATIVE[cid].items():
        assert abs(m[k] - v) < 1, (k, m.get(k))


def test_unmeasured_is_never_zero():
    rows = {r["channel_id"]: r for r in queries.channels()["data"]}
    assert rows["outbound"]["spend_usd"] is None and rows["outbound"]["cost_per_sql"] is None
    assert rows["seo"]["mqls"] is None and rows["geo"]["sqls"] is None
    assert rows["conferences"]["spend_usd"] is None and rows["conferences"]["cost_per_mql"] is None
    assert rows["email_threads"]["mqls"] is None and rows["email_threads"]["sqls"] is None


def test_conference_sqls_are_estimated_and_replies_stay_out_of_the_funnel():
    rows = {r["channel_id"]: r for r in queries.channels()["data"]}
    assert rows["conferences"]["sqls_estimated"] and abs(rows["conferences"]["sqls"] - 87 * 0.15) < 0.01
    assert not rows["email_threads"]["sqls_estimated"] and rows["email_threads"]["annual_spend_usd"] is None


def test_sql_estimation_uses_assumed_rate_and_is_flagged():
    s = queries.strip()["data"]
    assert s["mql_to_sql_source"].startswith("assumed") and s["mql_to_sql_rate"] == 0.15
    rows = {r["channel_id"]: r for r in queries.channels()["data"]}
    assert rows["google"]["sqls_estimated"] and not rows["outbound"]["sqls_estimated"]
    assert abs(rows["google"]["sqls"] - 2325 * 0.15) < 0.01 and rows["outbound"]["sqls"] == 77
    assert s["sqls_estimated"] and set(s["channels_without_spend"]) == NO_SPEND


def test_windows_match_data_and_flights_are_not_annualized():
    rows = {r["channel_id"]: r for r in queries.channels()["data"]}
    span = {r["channel"]: (r["a"], r["b"]) for r in sf.query("SELECT channel, MIN(date) a, MAX(date) b FROM CMO_DB.CORE.FUNNEL_FACT GROUP BY 1")}
    for cid in ("seo", "geo", "outbound", "conferences", "email_threads"):
        assert rows[cid]["window_start"] <= span[cid][0] and span[cid][1] <= rows[cid]["window_end"], (cid, span[cid])
    assert rows["billboard"]["annual_spend_usd"] == rows["billboard"]["spend_usd"]
    assert rows["google"]["annual_spend_usd"] < rows["google"]["spend_usd"]  # 875-day window


def test_strip_cost_metrics_cover_paid_channels_only():
    s = queries.strip()["data"]
    paid = sum(EXPECTED[c][0] for c in ("google", "linkedin", "billboard"))
    assert abs(s["measured_spend_usd"] - paid) <= 3
    assert abs(s["cost_per_mql"] - paid / (2325 + 13 + 112)) < 1


def test_reallocation_memo_and_approval():
    m = queries.propose_reallocation()
    assert set(m["deltas"]) == {"google", "linkedin", "billboard"} and set(m["impact"]["not_allocated"]) == NO_SPEND
    assert abs(sum(d["recommended_usd"] for d in m["deltas"].values()) - m["impact"]["budget_usd"]) <= 3
    assert m["impact"]["sqls_after"] >= m["impact"]["sqls_before"]
    if m["status"] == "pending":
        assert queries.decide(m["memo_id"], "approved")["status"] == "approved"
        assert "error" in queries.decide(m["memo_id"], "approved")
    plan = queries.strip()["data"]["plan_projected_sqls"]
    assert abs(plan - m["impact"]["sqls_after"]) < 0.2


@pytest.mark.parametrize("rule", ["12mo", "3yr"])
def test_unit_econ_runs_on_paid_channels(rule):
    u = queries.unit_econ(1_000_000, rule)["data"]
    assert set(u["channels_not_allocated"]) == NO_SPEND
    assert {s["channel"] for s in u["plan"]["split"]} == {"google", "linkedin", "billboard"}
    assert u["plan"]["customers"] > 0 and "google" in u["sqls_estimated_for"]


def test_unit_econ_respects_scale_cap():
    u = queries.unit_econ(2_000_000, "12mo")["data"]
    cap = u["basis"]["scale_cap_x"]
    for s in u["plan"]["split"]:
        assert s["usd"] <= cap * u["basis"]["curves"][s["channel"]]["annual_spend_usd"] + 1, s
    assert u["plan"]["unallocated_usd"] > 0
    assert abs(sum(s["usd"] for s in u["plan"]["split"]) + u["plan"]["unallocated_usd"] - 2_000_000) <= 3
