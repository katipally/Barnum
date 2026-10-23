"""Load the real Datasaur exports through the same plugin path a user takes: create, upload, propose, approve.

The data stays outside the repo. Usage:
  python -m seed.load_real /path/to/test-data [channel ...]
"""
import json
import sys
from pathlib import Path

from backend.app import snowflake as sf
from backend.app.channels import ingest, mapping, provision

HAND_WRITTEN = Path(__file__).parent / "mappings"  # <channel>.sql replaces Claude's proposal for that channel

NOT_MEASURED = "Not measurable from this data: leave sqls NULL."

CHANNELS = {
    "google": dict(
        display_name="Google Ads", files=["Datasaur All Google Ads Campaigns.csv"],
        window=("2024-06-01", "2026-10-23"),
        description="Google Ads export: one lifetime row per campaign (no dates, no cost column). Date every row window_end. "
                    "Spend = CONVERSIONS x COST_CONV (cost per conversion), because the export has no cost column; campaigns "
                    "with zero conversions therefore show 0 spend, an understatement to state in assumptions. Keep clicks, "
                    "conversions, conversion value and TrueView views as metrics; CTR is a rate, so store impressions = clicks / CTR when CTR > 0.",
        mql_rule="Google Ads platform conversions (CONVERSIONS column) per campaign.", sql_rule=NOT_MEASURED),
    "linkedin": dict(
        display_name="LinkedIn Ads", files=["Datasaur All LinkedIn Ads Campaigns.csv"],
        window=("2024-06-01", "2026-10-23"),
        description="LinkedIn Campaign Manager ad performance export: one lifetime row per ad (every START_DATE is the report "
                    "start, so treat rows as lifetime totals dated window_end). Campaign = CAMPAIGN_NAME. Spend = TOTAL_SPENT. "
                    "Keep impressions, clicks, leads, lead forms opened, conversions, video views and engagements as metrics. "
                    "creative_text = ad headline or introduction text; audience = ad set name.",
        mql_rule="LinkedIn lead-gen form leads (LEADS column).", sql_rule=NOT_MEASURED),
    "billboard": dict(
        display_name="Billboards", files=["Datasaur Billboards.csv"],
        description="Out-of-home billboard flights: one row per flight with a flat cost. Book each flight's FLAT_COST_USD on "
                    "FLIGHT_START. Campaign = BOARD_ID, audience = MARKET, creative_text = CREATIVE. Keep vanity URL visits, "
                    "QR scans and impressions (WEEKLY_IMPRESSIONS x WEEKS) as metrics.",
        mql_rule="QR code scans (QR_SCANS).", sql_rule=NOT_MEASURED),
    "outbound": dict(
        display_name="Outbound Email", files=["Datasaur Outbound Emails.csv"],
        description="Apollo outbound email log: one row per email sent in a sequence. No spend is recorded. Campaign = SEQUENCE, "
                    "date = day of SENT_AT_PST, audience = TO_COMPANY. Count people by lower-cased TO_EMAIL; exclude addresses "
                    "at datasaur domains (internal tests). Keep emails sent, bounces, opens, clicks, replies, unsubscribes and "
                    "distinct contacts as metrics. Date each contact's MQL and SQL on the first send to that contact.",
        mql_rule="Distinct external contacts who replied (REPLIED true), excluding bounced and 'Bad Data' contacts.",
        sql_rule="Distinct external contacts who replied (the MQL set) and whose CONTACT_STAGE is 'Interested'. "
                 "Interested contacts who never replied are not SQLs."),
    "seo": dict(
        display_name="SEO (Search Console)", files=[f"Datasaur SEO/{f}.csv" for f in
                                                    ("Chart", "Queries", "Pages", "Countries", "Devices", "Search appearance", "Filters")],
        description="Google Search Console export, last 12 months, web search. RAW_CHART is the daily total: map ONLY RAW_CHART "
                    "into the funnel (campaign = 'organic search', one row per DATE). The other tables (queries, pages, countries, "
                    "devices, search appearance) are breakdowns of the same totals; do not add them to the funnel or totals double count. "
                    "Metrics: clicks, impressions, and position_x_impressions = POSITION x IMPRESSIONS so average position can be "
                    "recomputed. No spend, no leads.",
        mql_rule="Not measurable from this data: leave mqls NULL.", sql_rule=NOT_MEASURED),
    "geo": dict(
        display_name="GEO (AI search visibility)", files=["Datasaur GEO.csv"],
        description="Generative-engine visibility tracking: one row per prompt run on an AI engine (ChatGPT, Bing Copilot, "
                    "Google AI Mode) with whether Datasaur appeared, its rank, citations and sentiment, plus competitor brands. "
                    "Campaign = AI_ENGINE, date = day of TIMESTAMP, audience = TOPIC_NAME, creative_text = QUERY. Metrics: ai_answers "
                    "(rows), ai_mentions (BRAND_FOUND = yes), rank_sum and ranked_answers (numeric BRAND_RANK), sentiment_sum and "
                    "sentiment_answers (numeric SENTIMENT), top3_mentions (rank <= 3). No spend, no leads.",
        mql_rule="Not measurable from this data: leave mqls NULL.", sql_rule=NOT_MEASURED),
}


def hand_written(cid: str, select_sql: str) -> dict:
    lines = select_sql.splitlines()
    body = "\n".join(l for l in lines if not l.lstrip().startswith("--"))
    header = " ".join(l.lstrip("- ").strip() for l in lines if l.lstrip().startswith("--"))
    w = sf.query(f"SELECT MIN(date) s, MAX(date) e, COUNT(spend_usd) sp, COUNT(mqls) mq, COUNT(sqls) sq FROM ({body})")[0]
    return {"select_sql": body, "raw_spend_sql": "SELECT NULL", "grain": "daily",
            "measures": {f: False for f in mapping.MEASURES} | {"spend_usd": w["sp"] > 0, "mqls": w["mq"] > 0, "sqls": w["sq"] > 0},
            "window_start": str(w["s"]), "window_end": str(w["e"]),
            "metric_notes": header + " Metrics: emails_sent, bounces, opens, clicks, replies, unsubscribes (email-level counts); "
                            "new_contacts (contacts first emailed that day).",
            "notes": "hand-written mapping (seed/mappings/" + cid + ".sql)",
            "assumptions": ["hand-written; reviewed against an independent count of the export"]}


def load(root: Path, cid: str) -> dict:
    spec = CHANNELS[cid]
    start, end = spec.get("window", (None, None))
    ingest.create_channel(cid, spec["display_name"], spec["description"], spec["mql_rule"], spec["sql_rule"], start, end)
    for f in spec["files"]:
        ingest.upload(cid, Path(f).name, (root / f).read_bytes(), replace=True)
    sql_file = HAND_WRITTEN / f"{cid}.sql"
    p = mapping.submit(cid, hand_written(cid, sql_file.read_text())) if sql_file.exists() else mapping.propose(cid)
    failed = [c for c in p["validation"]["checks"] if not c["ok"]]
    result = {"channel": cid, "attempts": p["attempts"], "failed": failed,
              "totals": {k: v for k, v in p["validation"]["totals"].items() if v is not None}}
    if not failed:
        approved = provision.approve(cid)
        result["reconcile"] = approved.get("reconcile")
    return result


if __name__ == "__main__":
    root = Path(sys.argv[1]).expanduser()
    for c in sys.argv[2:] or list(CHANNELS):
        print(json.dumps(load(root, c), default=str))
