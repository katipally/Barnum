"""Deterministic reads and actions. Every response carries the SQL that produced it ("Show SQL")."""
import json

from . import snowflake as sf

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
JSON_COLS = ("deltas", "impact", "validation", "mapping", "metrics", "channels_without_spend")


def _rows(sql: str, params=None) -> list[dict]:
    rows = sf.query(sql, params)
    for r in rows:
        for k in JSON_COLS:
            if isinstance(r.get(k), str):
                r[k] = json.loads(r[k])
    return rows


def _with_sql(data, sql: str, params=None) -> dict:
    return {"data": data, "sql": sql if params is None else sql.replace("%s", "{}").format(*(repr(p) for p in params))}


def strip() -> dict:
    return _with_sql(_rows(STRIP_SQL)[0], STRIP_SQL)


def channels() -> dict:
    return _with_sql(_rows(CHANNELS_SQL), CHANNELS_SQL)


def plan() -> dict:
    return _with_sql(_rows(PLAN_SQL), PLAN_SQL)


def campaigns(cid: str) -> dict:
    return _with_sql(_rows(CAMPAIGNS_SQL, (cid, cid)), CAMPAIGNS_SQL, (cid, cid))


def active_channels() -> list[dict]:
    return sf.query("SELECT channel_id, display_name, schema_name FROM CMO_DB.CORE.CHANNEL_REGISTRY WHERE status = 'active' ORDER BY 1")


def registry() -> list[dict]:
    return sf.query("SELECT * FROM CMO_DB.CORE.CHANNEL_REGISTRY ORDER BY created_at")


def unit_econ(budget: float, rule: str) -> dict:
    res = json.loads(sf.query(UNIT_ECON_SQL, (budget, rule))[0]["unit_econ"])
    return _with_sql(res, UNIT_ECON_SQL, (budget, rule))


def propose_reallocation(budget: float | None = None) -> dict:
    res = json.loads(sf.query("CALL CMO_DB.CORE.PROPOSE_REALLOCATION(%s)", (budget,))[0]["propose_reallocation"])
    if "error" in res:
        raise ValueError(res["error"])
    return res


def memos(status: str | None = None) -> list[dict]:
    return _rows("SELECT * FROM CMO_DB.CORE.DECISION_LOG WHERE %s IS NULL OR status = %s ORDER BY created_at DESC",
                 (status, status))


def decide(memo_id: str, decision: str) -> dict:
    return json.loads(sf.query("CALL CMO_DB.CORE.DECIDE_MEMO(%s, %s)", (memo_id, decision))[0]["decide_memo"])


def assumptions() -> list[dict]:
    return sf.query("SELECT * FROM CMO_DB.CORE.ASSUMPTIONS ORDER BY key")


def set_assumption(key: str, num: float | None, txt: str | None) -> dict:
    sf.execute("""MERGE INTO CMO_DB.CORE.ASSUMPTIONS t USING (SELECT %s k, %s n, %s x) v ON t.key = v.k
                  WHEN MATCHED THEN UPDATE SET num = v.n, txt = v.x
                  WHEN NOT MATCHED THEN INSERT (key, num, txt) VALUES (v.k, v.n, v.x)""", (key, num, txt))
    return sf.query("SELECT * FROM CMO_DB.CORE.ASSUMPTIONS WHERE key = %s", (key,))[0]


def reset_decisions() -> str:
    return sf.query("CALL CMO_DB.CORE.RESET_DECISIONS()")[0]["reset_decisions"]
