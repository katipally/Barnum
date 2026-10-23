"""Monday brief: the CMO agent's weekly summary from CORE.WEEKLY_BRIEFS, shown on the dashboard.

Reading it keeps it current: when the latest brief predates the last Monday 07:00 PT, the agent writes a new one in the
background. This replaces CORE.WEEKLY_BRIEF_TASK while the owner role lacks EXECUTE TASK.
"""
import json
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter

from . import snowflake as sf
from .queries import _with_sql

router = APIRouter(prefix="/brief", tags=["brief"])

LATEST_SQL = "SELECT created_at, source, brief, pending_memos, strip FROM CMO_DB.CORE.WEEKLY_BRIEFS ORDER BY created_at DESC LIMIT 1"
REFRESH_SQL = "CALL CMO_DB.CORE.WEEKLY_BRIEF()"
PT = ZoneInfo("America/Los_Angeles")

_writing = threading.Lock()


def _last_monday_7am(now: datetime) -> datetime:
    now = now.astimezone(PT)
    due = (now - timedelta(days=now.weekday())).replace(hour=7, minute=0, second=0, microsecond=0)
    return due if now >= due else due - timedelta(days=7)


def _latest() -> dict | None:
    rows = sf.query(LATEST_SQL)
    if not rows:
        return None
    r = rows[0]
    for k in ("pending_memos", "strip"):
        if isinstance(r.get(k), str):
            r[k] = json.loads(r[k])
    return r


def _write() -> None:
    try:
        sf.query(REFRESH_SQL)
    finally:
        _writing.release()


def _start_write() -> bool:
    """Starts one background write; False when one is already running."""
    if not _writing.acquire(blocking=False):
        return False
    threading.Thread(target=_write, daemon=True).start()
    return True


@router.get("")
def latest_brief():
    row = _latest()
    if row is None or row["created_at"] < _last_monday_7am(datetime.now(PT)):
        _start_write()
    return _with_sql({"brief": row, "writing": _writing.locked()}, LATEST_SQL)


@router.post("/refresh")
def refresh_brief():
    """Runs the CMO agent now (about a minute) and returns the new brief."""
    with _writing:
        sf.query(REFRESH_SQL)
    return _with_sql({"brief": _latest(), "writing": False}, REFRESH_SQL)
