"""Demo telemetry: append N days of raw rows in each platform's native format, then let the CMO re-check.

Spend follows the current plan: (plan - spent) / days left in the period, split by each campaign's spend share.
Leads follow each campaign's observed MQL and SQL per dollar (stochastic rounding, seeded by date).
Rows go through ingest.upload / load_csv, so the MAP views pick them up like any real upload.
Supported: Google Ads and LinkedIn Ads (daily platforms). Event and billboard spend is booked, not daily.
"""
import csv
import io
import random
from datetime import date, timedelta
from pathlib import Path

from . import snowflake as sf
from .channels import ingest

# channel -> (raw table, date col, campaign key col, spend col, spend unit per USD, CRM key col, CRM source filter)
PLATFORMS = {
    "google": ("RAW_GOOGLE_ADS", "SEGMENTS_DATE", "KEYWORD_TEXT", "COST_MICROS", 1_000_000, "UTM_TERM", "utm_source = 'google'"),
    "linkedin": ("RAW_LINKEDIN_ADS", "DATE", "CREATIVE_ID", "SPEND_USD", 1, "LI_CREATIVE_ID", "lead_source = 'LinkedIn Lead Gen'"),
}


def _round(x: float, rng: random.Random) -> int:
    return int(x) + (rng.random() < x - int(x))


def _csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows({k: ("" if v is None else v) for k, v in r.items()} for r in rows)
    return buf.getvalue().encode()


def simulate(days: int = 14) -> dict:
    if not 1 <= days <= 31:
        raise ValueError("days must be between 1 and 31")
    a = {r["key"]: r for r in sf.query("SELECT key, num, txt FROM CMO_DB.CORE.ASSUMPTIONS")}
    period_end = date.fromisoformat(a["PERIOD_END"]["txt"])
    last = sf.query("SELECT MAX(date) d FROM CMO_DB.CORE.FUNNEL_FACT")[0]["d"]
    new_days = [last + timedelta(i + 1) for i in range(days) if last + timedelta(i + 1) <= period_end]
    if not new_days:
        raise ValueError("the period is already over")
    rng = random.Random(last.toordinal())
    summary = {r["channel_id"]: r for r in sf.query("SELECT * FROM CMO_DB.CORE.CHANNEL_SUMMARY")}
    crm_rows, report = [], {}
    for cid, (table, dcol, key, scol, unit, crm_key, crm_filter) in PLATFORMS.items():
        if cid not in summary:
            continue
        s = summary[cid]
        daily_usd = max((s["plan_usd"] or s["spend_usd"]) - s["spend_usd"], 0) / ((period_end - last).days or 1)
        schema = f"CH_{cid.upper()}"
        templates = sf.query(f"SELECT * FROM CMO_DB.{schema}.{table} QUALIFY ROW_NUMBER() OVER (PARTITION BY {key} ORDER BY {dcol} DESC) = 1")
        by_key = {r[key.lower()]: r for r in templates}
        share = {r["k"]: float(r["s"]) for r in sf.query(
            f"SELECT {key} k, SUM({scol}) / {unit} / SUM(SUM({scol}) / {unit}) OVER () s FROM CMO_DB.{schema}.{table} GROUP BY 1")}
        rates = {r["k"]: r for r in sf.query(
            f"""SELECT {crm_key} k, COUNT_IF(became_mql_date IS NOT NULL) mqls, COUNT_IF(became_sql_date IS NOT NULL) sqls
                FROM CMO_DB.CORE.RAW_CRM_LEADS WHERE {crm_filter} GROUP BY 1""")}
        lead_tpl = {r[crm_key.lower()]: r for r in sf.query(
            f"SELECT * FROM CMO_DB.CORE.RAW_CRM_LEADS WHERE {crm_filter} AND became_mql_date IS NOT NULL "
            f"QUALIFY ROW_NUMBER() OVER (PARTITION BY {crm_key} ORDER BY lead_id) = 1")}
        spend_by_key = {r["k"]: float(r["s"]) for r in sf.query(
            f"SELECT {key} k, SUM({scol}) / {unit} s FROM CMO_DB.{schema}.{table} GROUP BY 1")}
        raw_rows, spent, mqls, sqls = [], 0.0, 0, 0
        for d in new_days:
            for k, tpl in by_key.items():
                usd = round(daily_usd * share.get(k, 0) * rng.uniform(0.7, 1.3), 2)
                row = {c.upper(): v for c, v in tpl.items()} | {dcol: d.isoformat(), scol: round(usd * unit) if unit > 1 else usd}
                if "CLICKS" in row:
                    row["CLICKS"] = max(1, int(usd / 9))
                if "LEAD_FORM_LEADS" in row:
                    row["LEAD_FORM_LEADS"] = 0
                if "CONVERSIONS" in row:
                    row["CONVERSIONS"] = 0
                raw_rows.append(row)
                spent += usd
                r = rates.get(k)
                if not r or k not in lead_tpl or not spend_by_key.get(k):
                    continue
                n_mql = _round(r["mqls"] / spend_by_key[k] * usd, rng)
                n_sql = sum(rng.random() < r["sqls"] / max(r["mqls"], 1) for _ in range(n_mql))
                for i in range(n_mql):
                    crm_rows.append({c.upper(): v for c, v in lead_tpl[k].items()} | {
                        "LEAD_ID": f"SIM-{cid}-{d:%m%d}-{len(crm_rows)}", "EMAIL": f"sim{len(crm_rows)}@{cid}.example",
                        "CREATE_DATE": d.isoformat(), "BECAME_MQL_DATE": d.isoformat(),
                        "BECAME_SQL_DATE": d.isoformat() if i < n_sql else None, "OPP_AMOUNT": a["ACV_USD"]["num"] if i < n_sql else None,
                        "LIFECYCLE_STAGE": "opportunity" if i < n_sql else "mql"})
                mqls, sqls = mqls + n_mql, sqls + n_sql
        if raw_rows:
            ingest.upload(cid, f"{table[4:].lower()}.csv", _csv(raw_rows))
        report[cid] = {"days": len(new_days), "spend_usd": round(spent), "mqls": mqls, "sqls": sqls}
    if crm_rows:
        ingest.load_csv("CORE", "crm_leads.csv", _csv(crm_rows))
    return {"from": new_days[0], "to": new_days[-1], "channels": report}


SEED = Path(__file__).resolve().parents[2] / "seed" / "csv"


def restore_seed() -> list[str]:
    """Replace simulated rows with the original seed files (same columns, so mappings stay valid)."""
    files = [(cid, f"{t[4:].lower()}.csv") for cid, (t, *_) in PLATFORMS.items()]
    for cid, f in files:
        ingest.upload(cid, f, (SEED / f).read_bytes(), replace=True)
    ingest.load_csv("CORE", "crm_leads.csv", (SEED / "crm_leads.csv").read_bytes(), replace=True)
    return [f for _, f in files] + ["crm_leads.csv"]
