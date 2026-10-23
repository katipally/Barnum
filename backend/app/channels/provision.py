"""Channel lifecycle, part 3: approve a validated mapping and stand up the channel's isolated agent stack."""
import json
import os
from pathlib import Path

import jinja2

from .. import snowflake as sf
from . import ingest, mapping

TEMPLATE = Path(__file__).resolve().parents[3] / "templates" / "channel.sql.j2"
MODEL = os.getenv("CMO_CHANNEL_MODEL", "claude-opus-5-5")

_env = jinja2.Environment(undefined=jinja2.StrictUndefined, autoescape=False)
_env.filters["sq"] = lambda v: str(v or "").replace("'", "''")          # inside '...' SQL literals
_env.filters["yq"] = lambda v: " ".join(str(v or "").split()).replace('"', "'")  # inside YAML scalars


def latest_mapping(cid: str, version: int | None = None) -> dict:
    rows = sf.query("""SELECT version, mapping, validation, status, fingerprint FROM CMO_DB.CORE.MAPPING_HISTORY
                       WHERE channel_id = %s AND (%s IS NULL OR version = %s) ORDER BY version DESC LIMIT 1""",
                    (cid, version, version))
    if not rows:
        raise KeyError(f"no mapping proposed for {cid}")
    r = rows[0]
    return r | {"mapping": json.loads(r["mapping"]), "validation": json.loads(r["validation"])}


MAX_TEXT_LEN = 500  # longer text columns (HTML bodies, full AI answers) are not useful as dimensions


def raw_tables(schema: str) -> list[dict]:
    """Raw uploads exposed to the channel's own semantic view: text/date columns as dimensions, numbers as facts."""
    out = []
    for i, t in enumerate(ingest.profile(schema)["tables"]):
        cols = {c: v["type"] for c, v in t["columns"].items()}
        text = [c for c, ty in cols.items() if ty == "TEXT"]
        lens = sf.query(f"SELECT {', '.join(f'MAX(LEN({c})) {c}' for c in text)} FROM {t['table']}")[0] if text else {}
        out.append({"alias": f"raw{i + 1}", "table": t["table"],
                    "dims": [c for c, ty in cols.items() if ty != "NUMBER" and ty != "FLOAT"
                             and (ty != "TEXT" or (lens.get(c.lower()) or 0) <= MAX_TEXT_LEN)],
                    "nums": [c for c, ty in cols.items() if ty in ("NUMBER", "FLOAT")]})
    return out


def render(ch: dict, m: dict, agent: str = "AGENT", agent_only: bool = False) -> str:
    measured = [f for f, on in m["measures"].items() if on]
    return _env.from_string(TEMPLATE.read_text()).render(
        s=ch["schema_name"], cid=ch["channel_id"], display=ch["display_name"], description=ch["description"],
        map_select=mapping.map_select(ch["channel_id"], m["select_sql"]), raw_spend_sql=m["raw_spend_sql"],
        raw_tables=raw_tables(ch["schema_name"]), metric_notes=m["metric_notes"],
        measured=", ".join(measured) or "no shared funnel fields",
        unmeasured=", ".join(f for f in mapping.MEASURES if f not in measured) or "nothing",
        model=MODEL, warehouse=sf.WAREHOUSE, agent=sf.ident(agent), agent_only=agent_only)


def approve(cid: str, version: int | None = None) -> dict:
    """Re-validate (data may have changed since proposal), provision, activate, rebuild FUNNEL_FACT."""
    ch = ingest.get_channel(cid)
    rec = latest_mapping(cid, version)
    check = mapping.validate(cid, rec["mapping"])
    if not check["ok"]:
        return {"approved": False, "validation": check}
    sf.conn().execute_string(render(ch, rec["mapping"]), remove_comments=True)
    m = rec["mapping"]
    sf.execute("""UPDATE CMO_DB.CORE.CHANNEL_REGISTRY SET status = 'active', map_version = %s, grain = %s,
                  window_start = COALESCE(TRY_TO_DATE(%s::STRING), window_start), window_end = COALESCE(TRY_TO_DATE(%s::STRING), window_end),
                  updated_at = CURRENT_TIMESTAMP() WHERE channel_id = %s""",
               (rec["version"], m["grain"], m["window_start"], m["window_end"], cid))
    sf.execute("UPDATE CMO_DB.CORE.MAPPING_HISTORY SET status = 'approved' WHERE channel_id = %s AND version = %s",
               (cid, rec["version"]))
    sf.execute("CALL CMO_DB.CORE.REBUILD_FUNNEL()")
    reconcile = json.loads(sf.query(f"CALL CMO_DB.{ch['schema_name']}.RECONCILE()")[0]["reconcile"])
    return {"approved": True, "version": rec["version"], "reconcile": reconcile, "validation": check}


def deploy_agent(cid: str, agent: str = "AGENT") -> str:
    """Redeploy only the channel's agent from the approved mapping, e.g. a side-by-side AGENT_V2."""
    ch = ingest.get_channel(cid)
    if not ch["map_version"]:
        raise ValueError(f"{cid} has no approved mapping yet")
    sf.conn().execute_string(render(ch, latest_mapping(cid, ch["map_version"])["mapping"], agent, agent_only=True),
                             remove_comments=True)
    return f"CMO_DB.{ch['schema_name']}.{sf.ident(agent)}"


def set_active(cid: str, active: bool) -> dict:
    """Pause or resume a provisioned channel; FUNNEL_FACT and the CMO fan-out follow the registry."""
    ch = ingest.get_channel(cid)
    if active and not ch["map_version"]:
        raise ValueError(f"{cid} has no approved mapping yet")
    sf.execute("UPDATE CMO_DB.CORE.CHANNEL_REGISTRY SET status = %s, updated_at = CURRENT_TIMESTAMP() WHERE channel_id = %s",
               ("active" if active else "paused", cid))
    sf.execute("CALL CMO_DB.CORE.REBUILD_FUNNEL()")
    return ingest.get_channel(cid)
