"""Channel lifecycle, part 3: approve a validated mapping and stand up the channel's isolated agent stack."""
import json
import os
from pathlib import Path

import jinja2

from .. import snowflake as sf
from . import ingest, mapping

TEMPLATE = Path(__file__).resolve().parents[3] / "templates" / "channel.sql.j2"
MODEL = os.getenv("CMO_CHANNEL_MODEL", "claude-sonnet-4-5")

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


def render(ch: dict, m: dict) -> str:
    return _env.from_string(TEMPLATE.read_text()).render(
        s=ch["schema_name"], cid=ch["channel_id"], display=ch["display_name"], description=ch["description"],
        map_select=mapping.map_select(ch["channel_id"], m["select_sql"]), raw_spend_sql=m["raw_spend_sql"],
        model=MODEL, warehouse=sf.WAREHOUSE)


def approve(cid: str, version: int | None = None) -> dict:
    """Re-validate (data may have changed since proposal), provision, activate, rebuild FUNNEL_FACT."""
    ch = ingest.get_channel(cid)
    rec = latest_mapping(cid, version)
    check = mapping.validate(cid, rec["mapping"])
    if not check["ok"]:
        return {"approved": False, "validation": check}
    sf.conn().execute_string(render(ch, rec["mapping"]), remove_comments=True)
    sf.execute("""UPDATE CMO_DB.CORE.CHANNEL_REGISTRY SET status = 'active', outcome_mode = %s, map_version = %s,
                  updated_at = CURRENT_TIMESTAMP() WHERE channel_id = %s""",
               (rec["mapping"]["outcome_mode"], rec["version"], cid))
    sf.execute("UPDATE CMO_DB.CORE.MAPPING_HISTORY SET status = 'approved' WHERE channel_id = %s AND version = %s",
               (cid, rec["version"]))
    sf.execute("CALL CMO_DB.CORE.REBUILD_FUNNEL()")
    reconcile = json.loads(sf.query(f"CALL CMO_DB.{ch['schema_name']}.RECONCILE()")[0]["reconcile"])
    return {"approved": True, "version": rec["version"], "reconcile": reconcile, "validation": check}


def set_active(cid: str, active: bool) -> dict:
    """Pause or resume a provisioned channel; FUNNEL_FACT and the CMO fan-out follow the registry."""
    ch = ingest.get_channel(cid)
    if active and not ch["map_version"]:
        raise ValueError(f"{cid} has no approved mapping yet")
    sf.execute("UPDATE CMO_DB.CORE.CHANNEL_REGISTRY SET status = %s, updated_at = CURRENT_TIMESTAMP() WHERE channel_id = %s",
               ("active" if active else "paused", cid))
    sf.execute("CALL CMO_DB.CORE.REBUILD_FUNNEL()")
    return ingest.get_channel(cid)
