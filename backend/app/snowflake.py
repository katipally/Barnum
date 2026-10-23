"""Snowflake access: one connection from ~/.snowflake/connections.toml, plus Agent Run REST."""
import json
import os
import threading
import tomllib
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
import snowflake.connector

CONNECTION = os.getenv("CMO_CONNECTION", "hackathon")
DB = "CMO_DB"
WAREHOUSE = os.getenv("CMO_WAREHOUSE", "CMO_WH")

_conn = None
_lock = threading.Lock()


def _config() -> dict:
    path = Path(os.getenv("SNOWFLAKE_HOME", Path.home() / ".snowflake")) / "connections.toml"
    return tomllib.loads(path.read_text())[CONNECTION]


def conn():
    global _conn
    with _lock:
        if _conn is None or _conn.is_closed():
            _conn = snowflake.connector.connect(connection_name=CONNECTION)
            # Setup creates CMO_WH; before that, the connection's default warehouse is used.
            if _conn.cursor().execute(f"SHOW WAREHOUSES LIKE '{WAREHOUSE}'").fetchall():
                _conn.cursor().execute(f"USE WAREHOUSE {WAREHOUSE}")
        return _conn


def query(sql: str, params: Any = None) -> list[dict]:
    cur = conn().cursor(snowflake.connector.DictCursor)
    cur.execute(sql, params)
    return [{k.lower(): v for k, v in row.items()} for row in cur.fetchall()] if cur.description else []


def execute(sql: str, params: Any = None) -> None:
    conn().cursor().execute(sql, params)


def run_script(path: Path) -> None:
    for cur in conn().execute_string(path.read_text(), remove_comments=True):
        cur.close()


def ident(name: str) -> str:
    """Uppercase SQL identifier restricted to [A-Z0-9_]; raises on anything else."""
    up = name.upper()
    if not up or not all(ch.isalnum() or ch == "_" for ch in up) or up[0].isdigit():
        raise ValueError(f"invalid identifier: {name!r}")
    return up


# ---- Agent Run REST -------------------------------------------------------

def _base_url() -> str:
    host = _config().get("host") or _config()["account"].lower().replace("_", "-") + ".snowflakecomputing.com"
    return f"https://{host}/api/v2"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_config()['token']}",
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
    }


def _agent_url(schema: str, agent: str) -> str:
    return f"{_base_url()}/databases/{DB}/schemas/{schema}/agents/{agent}:run"


async def run_agent(schema: str, agent: str, question: str, client: httpx.AsyncClient) -> dict:
    """Non-streaming run. Returns {'text': final answer, 'raw': response json}."""
    body = {"messages": [{"role": "user", "content": [{"type": "text", "text": question}]}], "stream": False}
    r = await client.post(_agent_url(schema, agent), json=body, headers=_headers(), timeout=300)
    r.raise_for_status()
    data = r.json()
    text = "".join(c.get("text", "") for c in data.get("content", []) if c.get("type") == "text")
    return {"text": text, "raw": data}


async def stream_agent(schema: str, agent: str, messages: list[dict]) -> AsyncIterator[tuple[str, dict]]:
    """Streaming run. Yields (event_name, data) parsed from the agent's SSE stream."""
    body = {"messages": messages, "stream": True}
    headers = _headers() | {"Accept": "text/event-stream"}
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", _agent_url(schema, agent), json=body, headers=headers) as r:
            r.raise_for_status()
            event = "message"
            async for line in r.aiter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    payload = line[5:].strip()
                    yield event, json.loads(payload) if payload.startswith(("{", "[")) else {"value": payload}
