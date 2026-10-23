"""Load the demo seed through the same plugin path a real user takes: create, upload, propose, approve.

Usage: python -m seed.load [channel ...]   (default: crm + the four Q4 channels; add 'webinars' for the live demo)
"""
import json
import sys
from pathlib import Path

from backend.app.channels import ingest, mapping, provision

CSV = Path(__file__).parent / "csv"

CHANNELS = {
    "google": dict(display_name="Google Ads", plan_usd=34000, files=["google_ads.csv"],
                   description="Paid search on Google: daily rows per keyword with cost in micros. Leads are form fills tracked by utm_source=google, utm_campaign and utm_term (keyword) in the CRM."),
    "linkedin": dict(display_name="LinkedIn Ads", plan_usd=42000, files=["linkedin_ads.csv"],
                     description="Paid social on LinkedIn: sponsored content, document ads and conversation ads targeted by industry, seniority and company size. Leads come from LinkedIn lead-gen forms, tracked by li_creative_id in the CRM."),
    "billboard": dict(display_name="Billboard", plan_usd=25000, files=["ooh_flights.csv"],
                      description="Out-of-home billboards: one row per board per flight with a flat cost. A flight's cost is committed when it starts: book the full flat cost on flight_start. Leads arrive through the board's vanity URL (landing_url in the CRM)."),
    "conferences": dict(display_name="Conferences", plan_usd=24000, files=["events.csv", "badge_scans.csv"],
                        description="Conferences and executive dinners: one row per event with booth, sponsorship and travel cost, plus a badge-scan list. Most scans are not MQLs; the CRM is the source of truth, matched by event_name. Book event cost on the event date."),
    "webinars": dict(display_name="Webinars", plan_usd=8000, files=["webinars.csv"],
                     description="Hosted webinars: one row per session with platform and promotion cost. The file already carries funnel outcomes: qualified_leads are MQLs, sales_accepted are SQLs."),
}


def load(cid: str) -> None:
    if cid == "crm":
        print("crm", ingest.load_csv("CORE", "crm_leads.csv", (CSV / "crm_leads.csv").read_bytes(), replace=True)["rows_loaded"], "rows")
        return
    spec = CHANNELS[cid]
    ingest.create_channel(cid, spec["display_name"], spec["description"], plan_usd=spec["plan_usd"])
    for f in spec["files"]:
        ingest.upload(cid, f, (CSV / f).read_bytes(), replace=True)
    p = mapping.propose(cid)
    failed = [c for c in p["validation"]["checks"] if not c["ok"]]
    print(cid, f"attempts={p['attempts']}", "failed:" if failed else "valid", json.dumps(failed) if failed else "")
    if not failed:
        print(cid, json.dumps({k: v for k, v in provision.approve(cid).items() if k != "validation"}, default=str))


if __name__ == "__main__":
    for c in sys.argv[1:] or ["crm", "google", "linkedin", "billboard", "conferences"]:
        load(c)
