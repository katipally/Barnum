"""Channel lifecycle, part 1: create a channel, load CSVs into its schema, profile what landed."""
import csv
import hashlib
import io
import json
import re
import tempfile
import time
from datetime import datetime
from pathlib import Path

from .. import snowflake as sf



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
                   sql_rule: str | None = None, window_start: str | None = None, window_end: str | None = None,
                   plan_usd: float | None = None) -> dict:
    cid = slug(cid)
    s = schema_for(cid)
    sf.execute(f"CREATE SCHEMA IF NOT EXISTS CMO_DB.{s}")
    sf.execute(f"CREATE STAGE IF NOT EXISTS CMO_DB.{s}.UPLOADS")
    sf.execute(
        """MERGE INTO CMO_DB.CORE.CHANNEL_REGISTRY t
           USING (SELECT %s cid, %s dn, %s d, %s mr, %s sr, TRY_TO_DATE(%s::STRING) ws, TRY_TO_DATE(%s::STRING) we, %s s) v ON t.channel_id = v.cid
           WHEN MATCHED THEN UPDATE SET display_name = v.dn, description = v.d, mql_rule = v.mr, sql_rule = v.sr,
                window_start = v.ws, window_end = v.we, updated_at = CURRENT_TIMESTAMP()
           WHEN NOT MATCHED THEN INSERT (channel_id, display_name, description, mql_rule, sql_rule, window_start, window_end, schema_name, status)
                VALUES (v.cid, v.dn, v.d, v.mr, v.sr, v.ws, v.we, v.s, 'draft')""",
        (cid, display_name, description, mql_rule, sql_rule, window_start, window_end, s),
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


NUMERIC = re.compile(r"^-?[\d,]*\.?\d+%?$")
DATE_FORMATS = ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%m/%d/%Y %H:%M",
                "%B %d, %Y %H:%M", "%B %d, %Y", "%b %d, %Y", "%d %b %Y")


def _date_format(values: list[str]) -> str | None:
    """The one format every non-empty value parses with, else None."""
    vals = [v for v in values if v]
    for fmt in DATE_FORMATS if vals else ():
        try:
            for v in vals:
                datetime.strptime(v, fmt)
            return fmt
        except ValueError:
            continue
    return None


def _col(name: str, seen: set) -> str:
    """SQL-safe header: 'Cost / conv.' -> COST_CONV, '(in UTC)' dropped, duplicates suffixed."""
    base = re.sub(r"_+", "_", re.sub(r"[^A-Z0-9]", "_", re.sub(r"\(in [^)]*\)", "", name).upper())).strip("_") or "COL"
    base = "C_" + base if base[0].isdigit() else base
    out, i = base, 2
    while out in seen:
        out, i = f"{base}_{i}", i + 1
    seen.add(out)
    return out


def normalize_csv(data: bytes) -> tuple[bytes, dict[str, str], int]:
    """Make a real-world export loadable: any BOM/encoding, comma or tab, report preambles, '1,129.58', '6.65%',
    and dates like 'April 01, 2026 08:35' or '5/12/2021' (rewritten as ISO so they load as DATE/TIMESTAMP).

    Returns (clean utf-8 csv, {clean column: original header}, preamble rows skipped). O(rows x cols).
    """
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        text = data.decode("utf-16")
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp1252", errors="replace")
    sample = "\n".join(text.splitlines()[:50])
    delim = "\t" if sample.count("\t") > sample.count(",") else ","
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delim)]
    # header = first row whose non-empty width matches the widest row seen in the next 20; preambles are narrower
    width = lambda r: len([v for v in r if v.strip()])
    hdr = next(i for i, r in enumerate(rows) if r and width(r) >= max((width(x) for x in rows[i:i + 20]), default=0) * 0.8
               and width(r) > 1)
    header, body = rows[hdr], [r for r in rows[hdr + 1:] if any(v.strip() for v in r)]
    keep = [j for j, h in enumerate(header) if h.strip() or any(j < len(r) and r[j].strip() for r in body)]
    seen: set = set()
    names = {j: _col(header[j] or f"col_{j}", seen) for j in keep}
    cell = lambda r, j: r[j].strip() if j < len(r) else ""
    numeric = {j for j in keep if all(not cell(r, j) or NUMERIC.match(cell(r, j)) for r in body)
               and any(cell(r, j) for r in body)}
    dates = {j: f for j in keep if j not in numeric and (f := _date_format([cell(r, j) for r in body]))}
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(names[j] for j in keep)
    for r in body:
        w.writerow(cell(r, j).replace(",", "").rstrip("%") if j in numeric
                   else datetime.strptime(cell(r, j), dates[j]).isoformat(sep=" ") if j in dates and cell(r, j)
                   else cell(r, j) for j in keep)
    return out.getvalue().encode(), {names[j]: header[j] for j in keep}, hdr


def load_csv(schema: str, filename: str, data: bytes, replace: bool = False) -> dict:
    """Normalize, stage and load one CSV into RAW_<file stem>. Same stem appends (or replaces); new columns are added."""
    stem = sf.ident(re.sub(r"\W", "_", Path(filename).stem).strip("_").upper() or "UPLOAD")
    table, prefix = f"CMO_DB.{schema}.RAW_{stem}", f"@CMO_DB.{schema}.UPLOADS/{stem}/"
    staged = f"{stem}_{int(time.time() * 1000)}.csv"
    data, original_headers, skipped = normalize_csv(data)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / staged
        path.write_bytes(data)
        sf.execute(f"PUT 'file://{path}' {prefix} AUTO_COMPRESS=TRUE")
    infer = (f"TABLE(INFER_SCHEMA(LOCATION => '{prefix}', FILES => '{staged}.gz', "
             f"FILE_FORMAT => 'CMO_DB.CORE.CSV_FMT', IGNORE_CASE => TRUE))")
    inferred = {r["column_name"]: r["type"] for r in sf.query(f"SELECT column_name, type FROM {infer}")}
    existing = columns(schema, f"RAW_{stem}")
    if not existing:
        # Inferred precision fits only the first file (max 9 -> NUMBER(1,0)); widen so later uploads never overflow.
        sf.execute(f"""CREATE TABLE {table} USING TEMPLATE (
            SELECT ARRAY_AGG(OBJECT_CONSTRUCT('COLUMN_NAME', column_name, 'NULLABLE', TRUE,
                   'TYPE', REGEXP_REPLACE(type, 'NUMBER\\\\(\\\\d+,', 'NUMBER(38,'))) FROM {infer})""")
    added = [c for c in inferred if c not in existing] if existing else []
    for c in added:
        sf.execute(f'ALTER TABLE {table} ADD COLUMN "{c}" {re.sub(r"NUMBER\(\d+,", "NUMBER(38,", inferred[c])}')
    if replace and existing:
        sf.execute(f"TRUNCATE TABLE {table}")
    res = sf.query(f"""COPY INTO {table} FROM {prefix} FILES = ('{staged}.gz')
                       FILE_FORMAT = (FORMAT_NAME = 'CMO_DB.CORE.CSV_FMT') MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE""")
    return {"table": table, "rows_loaded": sum(r.get("rows_loaded") or 0 for r in res),
            "columns": list(inferred), "added_columns": added, "new_table": not existing,
            "original_headers": original_headers, "preamble_rows_skipped": skipped}


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
    """Per table: row count and, per column, type, non-null count and up to 3 distinct examples.

    Column-wise beats row samples for wide exports (115-column ad reports). Fingerprint changes when any column set changes.
    """
    tables = sf.query("""SELECT table_name, row_count FROM CMO_DB.INFORMATION_SCHEMA.TABLES
                         WHERE table_schema = %s AND table_name LIKE %s ORDER BY table_name""",
                      (schema, table_prefix + "%"))
    out = []
    for t in tables:
        cols = columns(schema, t["table_name"])
        fq = f"CMO_DB.{schema}.{sf.ident(t['table_name'])}"
        stats = sf.query("SELECT " + ", ".join(
            f"COUNT({c}) n_{i}, ARRAY_SLICE(ARRAY_UNIQUE_AGG(LEFT({c}::STRING, 60)), 0, 3) ex_{i}" for i, c in enumerate(cols))
            + f" FROM (SELECT * FROM {fq} LIMIT 2000)")[0]
        out.append({"table": fq, "row_count": t["row_count"],
                    "columns": {c: {"type": ty, "non_null_in_sample": stats[f"n_{i}"], "examples": json.loads(stats[f"ex_{i}"])}
                                for i, (c, ty) in enumerate(cols.items())}})
    sig = "|".join(f"{t['table']}:{','.join(t['columns'])}" for t in out)
    return {"tables": out, "fingerprint": hashlib.md5(sig.encode()).hexdigest()}
