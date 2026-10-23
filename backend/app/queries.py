"""Deterministic reads and actions. Every response carries the SQL that produced it ("Show SQL")."""
import functools
import json
import os
import threading
import time
import uuid
from collections import defaultdict

from . import plan as plan_helpers
from . import snowflake as sf

CACHE_TTL_S = float(os.getenv("CMO_CACHE_TTL_S", "300"))
CACHE_MAX_ENTRIES = 256
_cache: dict = {}
_key_locks = defaultdict(threading.Lock)
_generation = 0


def invalidate() -> None:
    global _generation
    _generation += 1
    _cache.clear()


def writes(fn):
    """Marks a write: drops every cached read once it finishes, success or not."""
    @functools.wraps(fn)
    def wrapper(*args):
        try:
            return fn(*args)
        finally:
            invalidate()
    return wrapper


def cached(fn):
    """TTL cache for deterministic reads: O(1) lookup, one in-flight compute per key.
    A result computed across an invalidate() is returned but never stored."""
    @functools.wraps(fn)
    def wrapper(*args):
        key = (fn.__name__, args)
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        with _key_locks[key]:
            hit = _cache.get(key)
            if hit and hit[0] > time.monotonic():
                return hit[1]
            gen = _generation
            value = fn(*args)
            if gen == _generation and CACHE_TTL_S > 0:
                if len(_cache) >= CACHE_MAX_ENTRIES:
                    _cache.clear()
                _cache[key] = (time.monotonic() + CACHE_TTL_S, value)
            return value
    return wrapper

STRIP_SQL = "SELECT * FROM CMO_DB.CORE.EXEC_STRIP"
CHANNELS_SQL = "SELECT * FROM CMO_DB.CORE.CHANNEL_SUMMARY ORDER BY cost_per_sql NULLS LAST"
PLAN_SQL = "SELECT * FROM CMO_DB.CORE.PLAN_PROJECTION ORDER BY planned_usd DESC"
CAMPAIGNS_SQL = """WITH c AS (
  SELECT campaign, SUM(spend_usd) spend_usd, SUM(mqls) mqls, SUM(sqls) sqls, BOOLOR_AGG(sqls_estimated) sqls_estimated,
         SUM(spend_usd) / NULLIF(SUM(sqls), 0) cost_per_sql, MAX(creative_text) creative_text, MAX(audience) audience
  FROM CMO_DB.CORE.FUNNEL_FACT WHERE channel = %s GROUP BY campaign
), m AS (
  SELECT campaign, OBJECT_AGG(metric, total::VARIANT) metrics FROM (
    SELECT f.campaign, k.key metric, SUM(k.value::FLOAT) total
    FROM CMO_DB.CORE.FUNNEL_FACT f, LATERAL FLATTEN(input => f.metrics) k WHERE f.channel = %s GROUP BY 1, 2) GROUP BY 1
)
SELECT c.*, m.metrics FROM c LEFT JOIN m USING (campaign)
ORDER BY cost_per_sql NULLS LAST, mqls DESC NULLS LAST"""
UNIT_ECON_SQL = "CALL CMO_DB.CORE.UNIT_ECON(%s, %s)"
PLAN_2027_SQL = "CALL CMO_DB.CORE.PLAN_2027(%s, %s, %s, %s)"
PLAN_RUN_SQL = "SELECT plan_id, created_at, inputs, numbers, channels, targets, summary, model FROM CMO_DB.CORE.PLAN_RUNS"
JSON_COLS = ("deltas", "impact", "validation", "mapping", "metrics", "channels_without_spend", "brief")
PLAN_JSON_COLS = ("inputs", "numbers", "channels", "targets")


def _rows(sql: str, params=None) -> list[dict]:
    rows = sf.query(sql, params)
    for r in rows:
        for k in JSON_COLS:
            if isinstance(r.get(k), str):
                r[k] = json.loads(r[k])
    return rows


def _with_sql(data, sql: str, params=None) -> dict:
    return {"data": data, "sql": sql if params is None else sql.replace("%s", "{}").format(*(repr(p) for p in params))}


@cached
def strip() -> dict:
    return _with_sql(_rows(STRIP_SQL)[0], STRIP_SQL)


@cached
def channels() -> dict:
    return _with_sql(_rows(CHANNELS_SQL), CHANNELS_SQL)


@cached
def plan() -> dict:
    return _with_sql(_rows(PLAN_SQL), PLAN_SQL)


@cached
def campaigns(cid: str) -> dict:
    return _with_sql(_rows(CAMPAIGNS_SQL, (cid, cid)), CAMPAIGNS_SQL, (cid, cid))


def active_channels() -> list[dict]:
    return sf.query("SELECT channel_id, display_name, schema_name FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active' ORDER BY 1")


@cached
def registry() -> list[dict]:
    return sf.query("SELECT * FROM CMO_DB.CORE.CHANNEL_REGISTRY ORDER BY created_at")


@cached
def unit_econ(budget: float, rule: str) -> dict:
    res = json.loads(sf.query(UNIT_ECON_SQL, (budget, rule))[0]["unit_econ"])
    return _with_sql(res, UNIT_ECON_SQL, (budget, rule))


@writes
def propose_reallocation(budget: float | None = None) -> dict:
    res = json.loads(sf.query("CALL CMO_DB.CORE.PROPOSE_REALLOCATION(%s)", (budget,))[0]["propose_reallocation"])
    if "error" in res:
        raise ValueError(res["error"])
    return res


@cached
def memos(status: str | None = None) -> list[dict]:
    return _rows("SELECT * FROM CMO_DB.CORE.DECISION_LOG WHERE %s IS NULL OR status = %s ORDER BY created_at DESC",
                 (status, status))


@writes
def decide(memo_id: str, decision: str) -> dict:
    return json.loads(sf.query("CALL CMO_DB.CORE.DECIDE_MEMO(%s, %s)", (memo_id, decision))[0]["decide_memo"])


@cached
def assumptions() -> list[dict]:
    return sf.query("SELECT * FROM CMO_DB.CORE.ASSUMPTIONS ORDER BY key")


@writes
def set_assumption(key: str, num: float | None, txt: str | None) -> dict:
    sf.execute("""MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (SELECT %s k, %s n, %s x) v ON t.key = v.k
                  WHEN MATCHED THEN UPDATE SET num = v.n, txt = v.x
                  WHEN NOT MATCHED THEN INSERT (key, num, txt) VALUES (v.k, v.n, v.x)""", (key, num, txt))
    return sf.query("SELECT * FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = %s", (key,))[0]


@writes
def reset_decisions() -> str:
    return sf.query("CALL CMO_DB.CORE.RESET_DECISIONS()")[0]["reset_decisions"]


def plan_numbers(budget: float, revenue_target: float, sqls_per_quarter: float, brand_pct: float) -> dict:
    res = json.loads(sf.query(PLAN_2027_SQL, (budget, revenue_target, sqls_per_quarter, brand_pct))[0]["plan_2027"])
    if "error" in res:
        raise ValueError(res["error"])
    return res


def _plan_run(sql: str, params=None) -> dict | None:
    rows = sf.query(sql, params)
    if not rows:
        return None
    row = rows[0]
    for k in PLAN_JSON_COLS:
        row[k] = json.loads(row[k])
    return {"plan_id": row["plan_id"], "created_at": row["created_at"], "inputs": row["inputs"], "totals": row["numbers"]["totals"],
            "targets": row["targets"], "channels": row["channels"], "summary": row["summary"], "model": row["model"]}


@cached
def plan_latest() -> dict:
    sql = PLAN_RUN_SQL + " ORDER BY created_at DESC LIMIT 1"
    return _with_sql(_plan_run(sql), sql)


@writes
def save_plan(inputs: dict, numbers: dict, channels: list, summary: str, model: str | None) -> str:
    plan_id = uuid.uuid4().hex[:12]
    sf.execute("""INSERT INTO CMO_DB.CORE.PLAN_RUNS (plan_id, inputs, numbers, channels, targets, summary, model)
                  SELECT %s, PARSE_JSON(%s), PARSE_JSON(%s), PARSE_JSON(%s), PARSE_JSON(%s), %s, %s""",
               (plan_id, json.dumps(inputs), json.dumps(numbers), json.dumps(channels), json.dumps(numbers["targets"]), summary, model))
    return plan_id


def _draft(row: dict) -> dict:
    return {k: row[k] for k in ("campaign_id", "plan_id", "channel_id", "created_at", "status", "brief")} | {"stub": True}


@writes
def create_campaign_draft(plan_id: str, channel_id: str) -> dict:
    run = _plan_run(PLAN_RUN_SQL + " WHERE plan_id = %s", (plan_id,))
    if not run:
        raise KeyError(f"no plan {plan_id!r}")
    ch = next((c for c in run["channels"] if c["channel_id"] == channel_id), None)
    if not ch:
        raise KeyError(f"plan {plan_id!r} has no channel {channel_id!r}")
    campaign_id = uuid.uuid4().hex[:12]
    sf.execute("INSERT INTO CMO_DB.CORE.CAMPAIGN_DRAFTS (campaign_id, plan_id, channel_id, brief) SELECT %s, %s, %s, PARSE_JSON(%s)",
               (campaign_id, plan_id, channel_id, json.dumps(plan_helpers.build_brief(ch))))
    return _draft(_rows("SELECT * FROM CMO_DB.CORE.CAMPAIGN_DRAFTS WHERE campaign_id = %s", (campaign_id,))[0])


@cached
def campaign_drafts(channel_id: str | None = None) -> dict:
    sql = "SELECT * FROM CMO_DB.CORE.CAMPAIGN_DRAFTS WHERE %s IS NULL OR channel_id = %s ORDER BY created_at DESC"
    return _with_sql([_draft(r) for r in _rows(sql, (channel_id, channel_id))], sql, (channel_id, channel_id))
