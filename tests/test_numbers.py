"""Numbers the demo depends on. Runs against the live CMO_DB with the seed loaded (python -m seed.load).

pytest tests/
"""
import json

import pytest

from backend.app import queries
from backend.app import snowflake as sf

Q4 = {  # PRD Q4 table: spend, MQL, SQL
    "google": (17000, 34, 9), "linkedin": (21000, 76, 7), "billboard": (13000, 5, 2), "conferences": (12000, 25, 7),
}


@pytest.fixture(scope="module", autouse=True)
def clean():
    queries.reset_demo()
    yield
    queries.reset_demo()


@pytest.mark.parametrize("cid", sorted(Q4))
def test_channel_reconciles(cid):
    r = json.loads(sf.query(f"CALL CMO_DB.CH_{cid.upper()}.RECONCILE()")[0]["reconcile"])
    assert r["ok"] and r["diff_usd"] == 0


def test_q4_funnel_matches_prd():
    rows = {r["channel_id"]: r for r in queries.q4_channels()["data"]}
    for cid, (spend, mqls, sqls) in Q4.items():
        assert (rows[cid]["spend_usd"], rows[cid]["mqls"], rows[cid]["sqls"]) == (spend, mqls, sqls), cid


def test_exec_strip():
    s = queries.strip()["data"]
    assert (s["spent_usd"], s["budget_left_usd"], s["mqls"], s["sqls"]) == (63000, 62000, 140, 25)
    assert round(s["cost_per_mql"]) == 450 and round(s["cost_per_sql"]) == 2520
    assert round(s["cac_full_usd"]) == 56800 and round(s["payback_months"], 1) == 8.1


def test_linkedin_is_the_trap():
    rows = {r["channel_id"]: r for r in queries.q4_channels()["data"]}
    assert min(rows, key=lambda c: rows[c]["cost_per_mql"]) == "linkedin"
    assert rows["linkedin"]["cost_per_sql"] > rows["google"]["cost_per_sql"] > rows["conferences"]["cost_per_sql"]


def test_reallocation_memo_and_approval():
    m = queries.propose_reallocation()
    assert m["status"] == "pending"  # moves more than the 10% autonomy limit
    assert m["finding"].startswith("LinkedIn Ads ranks #1")
    d = {c: v["recommended_usd"] for c, v in m["deltas"].items()}
    assert d["conferences"] > 12000 and d["linkedin"] < 21000 and d["billboard"] == 5000 and sum(d.values()) == 62000
    assert m["impact"]["sqls_after"] > m["impact"]["sqls_before"]
    assert queries.decide(m["memo_id"], "approved")["status"] == "approved"
    assert round(queries.strip()["data"]["projected_sqls_remaining"], 1) == m["impact"]["sqls_after"]
    assert "error" in queries.decide(m["memo_id"], "approved")


def test_plan_1m_12mo():
    u = queries.unit_econ(1_000_000, "12mo")["data"]
    p = u["plan"]
    assert 44 <= p["customers"] <= 47 and 60_000 <= p["avg_cac_usd"] <= 64_000 and 8.5 <= p["payback_months"] <= 9.2
    assert p["last_customer_pays_back"] and u["cac_bound"] and 1_100_000 <= u["ceiling_usd"] <= 1_400_000
    split = {s["channel"]: s["share"] for s in p["split"]}
    assert split["conferences"] > split["linkedin"] > split["google"] >= split["billboard"] == 0.1


def test_plan_3yr_is_not_cac_bound():
    u = queries.unit_econ(2_000_000, "3yr")["data"]
    assert u["ceiling_usd"] is None and not u["cac_bound"]
    one = queries.unit_econ(1_000_000, "3yr")["data"]["plan"]
    assert u["plan"]["net_3yr_usd"] > one["net_3yr_usd"] and u["plan"]["year1_net_usd"] < one["year1_net_usd"]
