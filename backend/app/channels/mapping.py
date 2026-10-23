"""Channel lifecycle, part 2: Claude proposes a raw -> FUNNEL mapping, the validator checks it.

Channels report what their data can show. Shared fields (spend, MQL, SQL...) are optional and NULL when not
measured; every native signal worth keeping goes into `metrics`, so nothing a channel knows is thrown away.
"""
import json
import os
import re

from .. import snowflake as sf
from . import ingest

MODELS = [m for m in (os.getenv("CMO_MAPPER_MODEL", "claude-opus-5-5"), os.getenv("CMO_MAPPER_FALLBACK", "claude-opus-4-5")) if m]
MAX_ATTEMPTS = 3
MEASURES = ("spend_usd", "mqls", "sqls", "opps", "pipeline_usd", "won", "won_acv_usd")

CONTRACT = """Output columns, exactly these names:
  date          DATE     as-of date of the row: the day, flight start, send date, or window_end for lifetime totals
  campaign      STRING   the channel's natural unit: campaign, keyword, creative, board, sequence, query, page...
  spend_usd     FLOAT    money spent in USD (convert micros, derive from cost-per-x x count when that is all there is)
  mqls          FLOAT    marketing qualified leads by this channel's MQL rule
  sqls          FLOAT    sales qualified leads by this channel's SQL rule
  opps          FLOAT    opportunities
  pipeline_usd  FLOAT    opportunity amount
  won           FLOAT    closed-won deals
  won_acv_usd   FLOAT    closed-won annual contract value
  creative_text STRING   ad copy, subject line, billboard creative, page title or AI answer excerpt, else NULL
  audience      STRING   targeting, market, segment, country, device or company, else NULL
  metrics       OBJECT   OBJECT_CONSTRUCT('<snake_case_name>', <number>, ...) of every ADDITIVE native count worth keeping
                         (clicks, impressions, video_views, conversions, conversion_value_usd, opens, replies, qr_scans,
                         url_visits, ai_answers, ai_mentions...). Numbers only, summable across rows; no rates or averages
                         (store numerator and denominator instead, e.g. position_x_impressions + impressions)."""

SCHEMA = {"type": "json", "schema": {"type": "object", "properties": {
    "select_sql": {"type": "string"},
    "raw_spend_sql": {"type": "string"},
    "measures": {"type": "object", "properties": {m: {"type": "boolean"} for m in MEASURES},
                 "required": list(MEASURES)},
    "grain": {"type": "string", "enum": ["daily", "weekly", "monthly", "flight", "event", "message", "lifetime"]},
    "window_start": {"type": "string"},
    "window_end": {"type": "string"},
    "metric_notes": {"type": "string"},
    "notes": {"type": "string"},
    "assumptions": {"type": "array", "items": {"type": "string"}},
}, "required": ["select_sql", "raw_spend_sql", "measures", "grain", "window_start", "window_end",
                "metric_notes", "notes", "assumptions"]}}

FORBIDDEN = re.compile(r"\b(insert|update|delete|merge|create|drop|alter|grant|revoke|call|put|copy|truncate|execute|use)\b", re.I)


def _rules(ch: dict) -> tuple[str, str]:
    a = {r["key"]: r["txt"] for r in sf.query("SELECT key, txt FROM CMO_DB.CORE.ASSUMPTIONS WHERE txt IS NOT NULL")}
    return ch["mql_rule"] or a["MQL_RULE"], ch["sql_rule"] or a["SQL_RULE"]


def _prompt(ch: dict, raw: dict, crm: dict, errors: list[str], previous: dict | None) -> str:
    mql_rule, sql_rule = _rules(ch)
    window = (f"Known data window: {ch['window_start']} to {ch['window_end']}. Use it as window_start/window_end."
              if ch["window_start"] and ch["window_end"] else
              "Infer window_start/window_end (YYYY-MM-DD) from the data; if the data carries no dates, say so in assumptions.")
    parts = [
        f"You are the {ch['display_name']} channel agent for a B2B marketing team. Channel description: {ch['description']}",
        "Write one Snowflake SELECT that maps this channel's raw platform data into the shared funnel while keeping "
        "everything the data can tell. Channels differ: report only what this data actually measures.",
        CONTRACT,
        f"MQL rule for this channel: {mql_rule}\nSQL rule for this channel: {sql_rule}",
        "NULL means not measured and is never written as 0. Declare in `measures` which shared fields this data really "
        "measures; every undeclared field must be NULL in every row (cast: NULL::FLOAT). A declared field may be 0 on a row.",
        "When counting people (contacts, leads), count distinct people, not rows; exclude internal addresses of the own company "
        "and bounced or bad-data records unless the rules say otherwise.",
        window,
        "Rules: fully qualify every table (CMO_DB.SCHEMA.TABLE). Aggregate to one row per (date, campaign) at the data's natural "
        "grain; if spend and leads come from different tables, UNION ALL then GROUP BY and merge metrics with OBJECT_AGG or by "
        "summing each key. Respect column types in the profile: TRY_TO_NUMBER / TRY_TO_DATE only on TEXT columns; "
        "for DATE/TIMESTAMP columns use col::DATE; BOOLEAN columns compare directly. Only SELECT/WITH. No semicolons.",
        "raw_spend_sql: a scalar SELECT computing total spend in USD directly from the raw table(s), independent of select_sql; "
        "'SELECT NULL' when the data has no spend.",
        "metric_notes: one line per metrics key: what it counts and which raw column it comes from.",
        "Raw tables for this channel:\n" + json.dumps(raw["tables"], default=str),
    ]
    if crm["tables"]:
        parts.append("Shared CRM tables (join only when this channel's rows can be linked to them):\n" + json.dumps(crm["tables"], default=str))
    if errors:
        parts.append("Revise your previous mapping: keep what is right and fix every issue below.\nPrevious:\n"
                     + json.dumps(previous) + "\nIssues (validation failures or human review):\n- " + "\n- ".join(errors))
    return "\n\n".join(parts)


def _complete(prompt: str) -> dict:
    """Structured completion; a model that returns nothing is retried once on the fallback model."""
    for model in MODELS:
        r = sf.query("SELECT AI_COMPLETE(model => %s, prompt => %s, model_parameters => {'max_tokens': 12000, 'temperature': 0}, "
                     "response_format => PARSE_JSON(%s)) r", (model, prompt, json.dumps(SCHEMA)))
        if r[0]["r"]:
            return json.loads(r[0]["r"]) | {"model": model}
    raise ValueError(f"{', '.join(MODELS)} returned no mapping (prompt {len(prompt):,} chars)")


def map_select(cid: str, select_sql: str) -> str:
    """Casts any mapping to the FUNNEL contract, keeping NULL as not measured. Shared by validator and MAP view."""
    return f"""SELECT date::DATE AS date, '{cid}'::STRING AS channel, campaign::STRING AS campaign,
       ROUND(spend_usd, 2)::FLOAT AS spend_usd, mqls::FLOAT AS mqls, sqls::FLOAT AS sqls, opps::FLOAT AS opps,
       pipeline_usd::FLOAT AS pipeline_usd, won::FLOAT AS won, won_acv_usd::FLOAT AS won_acv_usd,
       creative_text::STRING AS creative_text, audience::STRING AS audience, metrics::OBJECT AS metrics
FROM ({select_sql})"""


def _scalar(sql: str):
    return list(sf.query(f"SELECT ({sql}) v")[0].values())[0]


def validate(cid: str, m: dict) -> dict:
    """Run every check the data supports; never raises. Returns {ok, checks[], totals}."""
    checks, totals = [], {}

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    for key in ("select_sql", "raw_spend_sql"):
        sql = m.get(key, "").strip()
        bad = not re.match(r"(?is)^\s*\(?\s*(select|with)\b", sql) or ";" in sql or FORBIDDEN.search(sql)
        check(f"{key} is read-only", not bad, "must be a single SELECT/WITH without DDL/DML")
    if not all(c["ok"] for c in checks):
        return {"ok": False, "checks": checks, "totals": totals}

    view = map_select(cid, m["select_sql"])
    sums = ", ".join(f"SUM({f}) {f}, COUNT({f}) n_{f}" for f in MEASURES)
    try:
        t = sf.query(f"""SELECT COUNT(*) n, {sums}, COUNT_IF(date IS NULL) null_dates, COUNT_IF(campaign IS NULL) null_campaigns,
                                MIN(date) first_day, MAX(date) last_day FROM ({view})""")[0]
        metric_info = sf.query(f"""SELECT COUNT(*) n, ARRAY_AGG(DISTINCT f.key) WITHIN GROUP (ORDER BY f.key) keys,
                                          COUNT_IF(TYPEOF(f.value) NOT IN ('INTEGER', 'DECIMAL', 'DOUBLE')) non_numeric
                                   FROM ({view}) v, LATERAL FLATTEN(input => v.metrics) f""")[0]
        totals = dict(t) | {"metric_keys": json.loads(metric_info["keys"] or "[]")}
        check("select_sql runs", True, f"{t['n']} rows, {t['first_day']} to {t['last_day']}")
    except Exception as e:  # compile/runtime error goes back to Claude
        check("select_sql runs", False, str(e)[:600])
        return {"ok": False, "checks": checks, "totals": totals}

    check("has rows", t["n"] > 0, f"{t['n']} rows")
    check("no null dates", t["null_dates"] == 0, f"{t['null_dates']} null dates")
    check("no null campaigns", t["null_campaigns"] == 0, f"{t['null_campaigns']} null campaigns")
    check("metrics are numeric", metric_info["non_numeric"] == 0, f"{metric_info['non_numeric']} non-numeric metric values")
    declared = m.get("measures", {})
    for f in MEASURES:
        n = t[f"n_{f}"]
        if declared.get(f):
            check(f"{f} measured", n == t["n"], f"declared measured, NULL on {t['n'] - n} of {t['n']} rows")
            check(f"{f} not all zero", (t[f] or 0) > 0, f"declared measured but totals {t[f]}: a filter or parse is likely wrong")
        else:
            check(f"{f} not measured", n == 0, f"declared not measured but present on {n} rows (unmeasured must be NULL, not 0)")
    if declared.get("mqls") and declared.get("sqls"):
        check("funnel narrows", (t["mqls"] or 0) >= (t["sqls"] or 0), f"mqls {t['mqls']} >= sqls {t['sqls']}")
    if declared.get("spend_usd"):
        try:
            raw = float(_scalar(m["raw_spend_sql"]) or 0)
            totals["raw_spend"] = raw
            check("spend reconciles", abs(raw - float(t["spend_usd"] or 0)) <= 1,
                  f"raw ${raw:,.2f} vs mapped ${float(t['spend_usd'] or 0):,.2f}")
        except Exception as e:
            check("spend reconciles", False, f"raw_spend_sql failed: {str(e)[:400]}")
    w = sf.query("SELECT TRY_TO_DATE(%s::STRING) s, TRY_TO_DATE(%s::STRING) e", (m.get("window_start"), m.get("window_end")))[0]
    valid = w["s"] is not None and w["e"] is not None and w["s"] <= w["e"]
    check("window is valid", valid, f"{m.get('window_start')} to {m.get('window_end')}")
    if valid:
        check("dates inside window", w["s"] <= t["first_day"] and t["last_day"] <= w["e"],
              f"rows span {t['first_day']} to {t['last_day']}, window {w['s']} to {w['e']} (lifetime rows use window_end)")
    return {"ok": all(c["ok"] for c in checks), "checks": checks, "totals": totals}


def _store(cid: str, mapping: dict, fingerprint: str, result: dict) -> int:
    version = sf.query("SELECT COALESCE(MAX(version), 0) + 1 v FROM CMO_DB.CORE.MAPPING_HISTORY WHERE channel_id = %s", (cid,))[0]["v"]
    sf.execute("""INSERT INTO CMO_DB.CORE.MAPPING_HISTORY (channel_id, version, mapping, notes, fingerprint, validation, status)
                  SELECT %s, %s, PARSE_JSON(%s), %s, %s, PARSE_JSON(%s), %s""",
               (cid, version, json.dumps(mapping), mapping.get("notes"), fingerprint,
                json.dumps(result, default=str), "proposed" if result["ok"] else "failed"))
    return version


def submit(cid: str, mapping: dict) -> dict:
    """A human-written mapping: same contract, same validator, same approval step as Claude's."""
    ch = ingest.get_channel(cid)
    missing = [k for k in SCHEMA["schema"]["required"] if k not in mapping]
    if missing:
        raise ValueError(f"mapping is missing {', '.join(missing)}")
    mapping = mapping | {"model": "human"}
    result = validate(cid, mapping)
    version = _store(cid, mapping, ingest.profile(ch["schema_name"])["fingerprint"], result)
    return {"channel_id": cid, "version": version, "attempts": 1, "mapping": mapping, "validation": result}


def propose(cid: str, feedback: str | None = None) -> dict:
    """Ask Claude for a mapping, validate, feed failures back. Stores the final attempt."""
    ch = ingest.get_channel(cid)
    raw = ingest.profile(ch["schema_name"])
    if not raw["tables"]:
        raise ValueError(f"channel {cid} has no uploaded data yet")
    crm = ingest.profile("CORE")
    errors, mapping, result = [], None, None
    if feedback:  # a human correction edits the latest proposal instead of starting over
        prev = sf.query("SELECT mapping FROM CMO_DB.CORE.MAPPING_HISTORY WHERE channel_id = %s ORDER BY version DESC LIMIT 1", (cid,))
        errors, mapping = [f"Human review: {feedback}"], (json.loads(prev[0]["mapping"]) if prev else None)
    for attempt in range(1, MAX_ATTEMPTS + 1):
        mapping = _complete(_prompt(ch, raw, crm, errors, mapping))
        result = validate(cid, mapping)
        if result["ok"]:
            break
        errors = [f"{c['check']}: {c['detail']}" for c in result["checks"] if not c["ok"]]
    version = _store(cid, mapping, raw["fingerprint"], result)
    return {"channel_id": cid, "version": version, "attempts": attempt, "mapping": mapping, "validation": result}
