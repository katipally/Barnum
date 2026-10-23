"""Channel lifecycle, part 2: Claude proposes a raw -> FUNNEL mapping, the validator checks it."""
import json
import os
import re

from .. import snowflake as sf
from . import ingest

MODEL = os.getenv("CMO_MAPPER_MODEL", "claude-sonnet-4-5")
MAX_ATTEMPTS = 3

CONTRACT = """Output columns, exactly these names, one row per (date, campaign):
  date          DATE     day the spend or lead happened
  campaign      STRING   the channel's natural unit: keyword, creative, board, event, webinar...
  spend_usd     FLOAT    spend in US dollars (convert micros, cents, flat flight costs spread over live days...)
  mqls          INT      marketing qualified leads
  sqls          INT      sales qualified leads
  opps          INT      opportunities created
  pipeline_usd  FLOAT    opportunity amount created
  won           INT      closed-won deals
  won_acv_usd   FLOAT    closed-won annual contract value
  creative_text STRING   ad copy or session title if available, else NULL
  audience      STRING   targeting / audience description if available, else NULL"""

SCHEMA = {"type": "json", "schema": {"type": "object", "properties": {
    "outcome_mode": {"type": "string", "enum": ["SELF", "CRM"]},
    "select_sql": {"type": "string"},
    "raw_spend_sql": {"type": "string"},
    "crm_mql_sql": {"type": "string"},
    "notes": {"type": "string"},
    "assumptions": {"type": "array", "items": {"type": "string"}},
}, "required": ["outcome_mode", "select_sql", "raw_spend_sql", "crm_mql_sql", "notes", "assumptions"]}}

FORBIDDEN = re.compile(r"\b(insert|update|delete|merge|create|drop|alter|grant|revoke|call|put|copy|truncate|execute|use)\b", re.I)


def _rules(ch: dict) -> tuple[str, str]:
    a = {r["key"]: r["txt"] for r in sf.query("SELECT key, txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE txt IS NOT NULL")}
    return ch["mql_rule"] or a["MQL_RULE"], a["SQL_RULE"]


def _prompt(ch: dict, raw: dict, crm: dict, hint: str, errors: list[str], previous: dict | None) -> str:
    mql_rule, sql_rule = _rules(ch)
    parts = [
        f"You are the {ch['display_name']} channel agent for a B2B marketing team. Channel description: {ch['description']}",
        "Write one Snowflake SELECT that maps this channel's raw platform data into the common marketing funnel.",
        CONTRACT,
        f"MQL definition: {mql_rule}\nSQL definition: {sql_rule}",
        "Outcome modes:\n- SELF: the raw data already has MQL/SQL/won-like columns; map them directly.\n"
        "- CRM: the raw data has spend and activity only. Count MQLs (became_mql_date not null), SQLs (became_sql_date not null), "
        "opps, pipeline and won from the shared CRM table, filtered to the leads this channel generated, joined or filtered by the "
        "keys the data offers (utm fields, creative id, email, landing url, event name). Date leads by their MQL date (SQLs/opps by the same lead's MQL date).",
        f"Heuristic hint for outcome mode: {hint}",
        "Rules: fully qualify every table (CMO_DB.SCHEMA.TABLE). Build spend rows and lead rows separately, UNION ALL them, then "
        "GROUP BY date, campaign so a day can have spend without leads and leads without spend. Leads must land on the same campaign "
        "names as their spend. Every column in the contract must appear, use NULL::STRING where unknown. Only SELECT/WITH. No semicolons.",
        "raw_spend_sql: a scalar SELECT returning total spend in USD computed directly from the raw table(s), independent of select_sql.",
        "crm_mql_sql: in CRM mode, a scalar SELECT counting this channel's MQLs in the CRM table; in SELF mode return 'SELECT NULL'.",
        "Raw tables for this channel:\n" + json.dumps(raw["tables"], default=str),
        "Shared CRM tables:\n" + json.dumps(crm["tables"], default=str),
    ]
    if errors:
        parts.append("Your previous mapping failed validation. Fix every issue.\nPrevious:\n" + json.dumps(previous)
                     + "\nErrors:\n- " + "\n- ".join(errors))
    return "\n\n".join(parts)


def _complete(prompt: str) -> dict:
    r = sf.query("SELECT AI_COMPLETE(model => %s, prompt => %s, model_parameters => {'max_tokens': 8000, 'temperature': 0}, "
                 "response_format => PARSE_JSON(%s)) r", (MODEL, prompt, json.dumps(SCHEMA)))
    return json.loads(r[0]["r"])


def map_select(cid: str, select_sql: str) -> str:
    """Wrapper that casts any mapping to the FUNNEL contract. Shared by validator and provisioned MAP view."""
    return f"""SELECT date::DATE AS date, '{cid}'::STRING AS channel, campaign::STRING AS campaign,
       ROUND(spend_usd, 2)::FLOAT AS spend_usd, COALESCE(mqls, 0)::INT AS mqls, COALESCE(sqls, 0)::INT AS sqls,
       COALESCE(opps, 0)::INT AS opps, COALESCE(pipeline_usd, 0)::FLOAT AS pipeline_usd,
       COALESCE(won, 0)::INT AS won, COALESCE(won_acv_usd, 0)::FLOAT AS won_acv_usd,
       creative_text::STRING AS creative_text, audience::STRING AS audience
FROM ({select_sql})"""


def _scalar(sql: str):
    return list(sf.query(f"SELECT ({sql}) v")[0].values())[0]


def validate(cid: str, m: dict) -> dict:
    """Run every check; never raises. Returns {ok, checks[], totals}."""
    checks, totals = [], {}

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    for key in ("select_sql", "raw_spend_sql", "crm_mql_sql"):
        sql = m.get(key, "").strip()
        bad = not re.match(r"(?is)^\s*\(?\s*(select|with)\b", sql) or ";" in sql or FORBIDDEN.search(sql)
        check(f"{key} is read-only", not bad, "must be a single SELECT/WITH without DDL/DML")
    if not all(c["ok"] for c in checks):
        return {"ok": False, "checks": checks, "totals": totals}

    try:
        t = sf.query(f"""SELECT COUNT(*) n, SUM(spend_usd) spend, SUM(mqls) mqls, SUM(sqls) sqls, SUM(won) won,
                                COUNT_IF(date IS NULL) null_dates, COUNT_IF(campaign IS NULL) null_campaigns,
                                MIN(date) first_day, MAX(date) last_day
                         FROM ({map_select(cid, m['select_sql'])})""")[0]
        totals = dict(t)
        check("select_sql runs", True, f"{t['n']} rows, {t['first_day']} to {t['last_day']}")
    except Exception as e:  # compile/runtime error goes back to Claude
        check("select_sql runs", False, str(e)[:600])
        return {"ok": False, "checks": checks, "totals": totals}

    spend, mqls, sqls, won = (float(t[k] or 0) for k in ("spend", "mqls", "sqls", "won"))
    check("has rows", t["n"] > 0, f"{t['n']} rows")
    check("no null dates", t["null_dates"] == 0, f"{t['null_dates']} null dates")
    check("no null campaigns", t["null_campaigns"] == 0, f"{t['null_campaigns']} null campaigns")
    check("funnel narrows", mqls >= sqls >= won >= 0, f"mqls {mqls:.0f} >= sqls {sqls:.0f} >= won {won:.0f}")
    try:
        raw = float(_scalar(m["raw_spend_sql"]) or 0)
        totals["raw_spend"] = raw
        check("spend reconciles", abs(raw - spend) <= 1, f"raw ${raw:,.2f} vs mapped ${spend:,.2f}")
    except Exception as e:
        check("spend reconciles", False, f"raw_spend_sql failed: {str(e)[:400]}")
    if m["outcome_mode"] == "CRM":
        try:
            crm = float(_scalar(m["crm_mql_sql"]) or 0)
            totals["crm_mqls"] = crm
            check("MQLs match CRM", crm == mqls, f"CRM {crm:.0f} vs mapped {mqls:.0f}")
        except Exception as e:
            check("MQLs match CRM", False, f"crm_mql_sql failed: {str(e)[:400]}")
    return {"ok": all(c["ok"] for c in checks), "checks": checks, "totals": totals}


def propose(cid: str, feedback: str | None = None) -> dict:
    """Ask Claude for a mapping, validate, feed failures back. Stores every attempt's final result."""
    ch = ingest.get_channel(cid)
    raw = ingest.profile(ch["schema_name"])
    if not raw["tables"]:
        raise ValueError(f"channel {cid} has no uploaded data yet")
    crm = ingest.profile("CORE")
    hint = ingest.outcome_hint(raw)
    errors, mapping, result = ([feedback] if feedback else []), None, None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        mapping = _complete(_prompt(ch, raw, crm, hint, errors, mapping))
        result = validate(cid, mapping)
        if result["ok"]:
            break
        errors = [f"{c['check']}: {c['detail']}" for c in result["checks"] if not c["ok"]]
    version = sf.query("SELECT COALESCE(MAX(version), 0) + 1 v FROM CMO_DB.CORE.MAPPING_HISTORY WHERE channel_id = %s", (cid,))[0]["v"]
    sf.execute("""INSERT INTO CMO_DB.CORE.MAPPING_HISTORY (channel_id, version, mapping, notes, fingerprint, validation, status)
                  SELECT %s, %s, PARSE_JSON(%s), %s, %s, PARSE_JSON(%s), %s""",
               (cid, version, json.dumps(mapping), mapping.get("notes"), raw["fingerprint"],
                json.dumps(result, default=str), "proposed" if result["ok"] else "failed"))
    return {"channel_id": cid, "version": version, "attempts": attempt, "mapping": mapping, "validation": result}
