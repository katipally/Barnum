"""Writes backtest results to CMO_DB.EVALS.EVAL_RUNS. Creates only the EVALS schema; CORE is never touched."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

DDL = [
    "CREATE SCHEMA IF NOT EXISTS CMO_DB.EVALS",
    """CREATE TABLE IF NOT EXISTS CMO_DB.EVALS.EVAL_RUNS (
         run_id STRING, run_at TIMESTAMP_TZ, policy STRING, version STRING, world STRING, seed INT, weeks INT,
         sqls FLOAT, expected_sqls FLOAT, oracle_sqls FLOAT, regret FLOAT, regret_pct FLOAT, traps VARIANT)""",
]


def write_runs(results, traps: dict[str, dict[str, bool]], version: str, weeks: int) -> int:
    from backend.app import snowflake as sf

    for stmt in DDL:
        sf.execute(stmt)
    run_id, now = uuid.uuid4().hex[:12], datetime.now(timezone.utc).isoformat()
    rows = [(run_id, now, r.policy, version, r.world, r.seed, weeks, r.sqls, r.expected, r.oracle, r.regret, r.regret_pct,
             json.dumps(traps.get(r.policy, {}))) for r in results]
    # One statement: PARSE_JSON isn't allowed inside VALUES, so select over a VALUES list.
    values = ", ".join(["(" + ", ".join(["%s"] * 13) + ")"] * len(rows))
    sf.execute(f"""INSERT INTO CMO_DB.EVALS.EVAL_RUNS
                   (run_id, run_at, policy, version, world, seed, weeks, sqls, expected_sqls, oracle_sqls, regret, regret_pct, traps)
                   SELECT column1, column2::TIMESTAMP_TZ, column3, column4, column5, column6, column7, column8, column9,
                          column10, column11, column12, PARSE_JSON(column13) FROM VALUES {values}""",
               [v for r in rows for v in r])
    return len(rows)
