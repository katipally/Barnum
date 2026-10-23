"""Channel lifecycle, part 1: create a channel, load CSVs into its schema, profile what landed."""
import hashlib
import re
import tempfile
import time
from pathlib import Path

from .. import snowflake as sf

SAMPLE_ROWS = 20


def schema_for(cid: str) -> str:
    return "CH_" + sf.ident(cid)


def slug(cid: str) -> str:
    s = re.sub(r"[^a-z0-9_]", "_", cid.strip().lower()).strip("_")
    if not s:
        raise ValueError("channel id is empty")
    sf.ident(s)
    return s


def get_channel(cid: str) -> dict:
    rows = sf.query("SELECT * FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE channel_id = %s", (cid,))
    if not rows:
        raise KeyError(f"unknown channel {cid!r}")
    return rows[0]


def create_channel(cid: str, display_name: str, description: str, mql_rule: str | None = None,
                   plan_usd: float | None = None) -> dict:
    cid = slug(cid)
    s = schema_for(cid)
    sf.execute(f"CREATE SCHEMA IF NOT EXISTS CMO_DB.{s}")
    sf.execute(f"CREATE STAGE IF NOT EXISTS CMO_DB.{s}.UPLOADS")
    sf.execute(
        """MERGE INTO CMO_DB.CORE.CHANNEL_REGISTRY t
           USING (SELECT %s cid, %s dn, %s d, %s r, %s s) v ON t.channel_id = v.cid
           WHEN MATCHED THEN UPDATE SET display_name = v.dn, description = v.d, mql_rule = v.r, updated_at = CURRENT_TIMESTAMP()
           WHEN NOT MATCHED THEN INSERT (channel_id, display_name, description, mql_rule, schema_name, status)
                VALUES (v.cid, v.dn, v.d, v.r, v.s, 'draft')""",
        (cid, display_name, description, mql_rule, s),
    )
    if plan_usd is not None:
        set_plan(cid, plan_usd)
    return get_channel(cid)


def set_plan(cid: str, plan_usd: float, memo_id: str | None = None) -> None:
    sf.execute(
        """INSERT INTO CMO_DB.CORE.ALLOCATION (channel_id, period, planned_usd, memo_id)
           SELECT %s, txt, %s, %s FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = 'PERIOD'""",
        (cid, plan_usd, memo_id),
    )


def load_csv(schema: str, filename: str, data: bytes, replace: bool = False) -> dict:
    """Stage one CSV and load it into RAW_<file stem>. Same stem appends (or replaces); new columns are added."""
    stem = sf.ident(re.sub(r"\W", "_", Path(filename).stem).strip("_") or "upload")
    table, prefix = f"CMO_DB.{schema}.RAW_{stem}", f"@CMO_DB.{schema}.UPLOADS/{stem}/"
    staged = f"{stem}_{int(time.time() * 1000)}.csv"
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / staged
        path.write_bytes(data)
        sf.execute(f"PUT 'file://{path}' {prefix} AUTO_COMPRESS=TRUE")
    infer = (f"TABLE(INFER_SCHEMA(LOCATION => '{prefix}', FILES => '{staged}.gz', "
             f"FILE_FORMAT => 'CMO_DB.CORE.CSV_FMT', IGNORE_CASE => TRUE))")
    inferred = {r["column_name"]: r["type"] for r in sf.query(f"SELECT column_name, type FROM {infer}")}
    existing = columns(schema, f"RAW_{stem}")
    if not existing:
        sf.execute(f"CREATE TABLE {table} USING TEMPLATE (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM {infer})")
    added = [c for c in inferred if c not in existing] if existing else []
    for c in added:
        sf.execute(f'ALTER TABLE {table} ADD COLUMN "{c}" {inferred[c]}')
    if replace and existing:
        sf.execute(f"TRUNCATE TABLE {table}")
    res = sf.query(f"""COPY INTO {table} FROM {prefix} FILES = ('{staged}.gz')
                       FILE_FORMAT = (FORMAT_NAME = 'CMO_DB.CORE.CSV_FMT') MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE""")
    return {"table": table, "rows_loaded": sum(r.get("rows_loaded") or 0 for r in res),
            "columns": list(inferred), "added_columns": added, "new_table": not existing}


def upload(cid: str, filename: str, data: bytes, replace: bool = False) -> dict:
    ch = get_channel(cid)
    result = load_csv(ch["schema_name"], filename, data, replace)
    if ch["status"] == "active" and (result["added_columns"] or result["new_table"]):
        sf.execute("UPDATE CMO_DB.CORE.CHANNEL_REGISTRY SET status = 'needs_mapping', updated_at = CURRENT_TIMESTAMP() "
                   "WHERE channel_id = %s", (cid,))
    return result | {"status": get_channel(cid)["status"]}


def columns(schema: str, table: str) -> dict[str, str]:
    rows = sf.query("""SELECT column_name, data_type FROM CMO_DB.INFORMATION_SCHEMA.COLUMNS
                       WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position""", (schema, table))
    return {r["column_name"]: r["data_type"] for r in rows}


def profile(schema: str, table_prefix: str = "RAW_") -> dict:
    """Tables, columns, row counts and sample rows; fingerprint changes when any column set changes."""
    tables = sf.query("""SELECT table_name, row_count FROM CMO_DB.INFORMATION_SCHEMA.TABLES
                         WHERE table_schema = %s AND table_name LIKE %s ORDER BY table_name""",
                      (schema, table_prefix + "%"))
    out = []
    for t in tables:
        cols = columns(schema, t["table_name"])
        rows = sf.query(f"SELECT * FROM CMO_DB.{schema}.{sf.ident(t['table_name'])} LIMIT {SAMPLE_ROWS}")
        out.append({"table": f"CMO_DB.{schema}.{t['table_name']}", "row_count": t["row_count"], "columns": cols,
                    "sample": [{k: (str(v)[:80] if v is not None else None) for k, v in r.items()} for r in rows]})
    sig = "|".join(f"{t['table']}:{','.join(t['columns'])}" for t in out)
    return {"tables": out, "fingerprint": hashlib.md5(sig.encode()).hexdigest()}


def outcome_hint(prof: dict) -> str:
    """SELF when the dataset already carries sales outcomes, else CRM (joined to the shared CRM table)."""
    pat = re.compile(r"(^|_)(SQLS?|SALES_ACCEPTED|WON|CLOSED_WON|OPPORTUNIT\w*)($|_)")
    return "SELF" if any(pat.search(c) for t in prof["tables"] for c in t["columns"]) else "CRM"
