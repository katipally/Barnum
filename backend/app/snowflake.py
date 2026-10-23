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


async def stream_agent(schema: str, agent: str, messages: list[dict], thread_id: int | None = None,
                       parent_message_id: int = 0) -> AsyncIterator[tuple[str, dict]]:
    """Streaming run, optionally inside a thread. Yields (event_name, data) parsed from the agent's SSE stream,
    starting with ("request", {"request_id"}) taken from the response header (feedback refers to it)."""
    body = {"messages": messages, "stream": True}
    if thread_id is not None:
        body |= {"thread_id": thread_id, "parent_message_id": parent_message_id}
    headers = _headers() | {"Accept": "text/event-stream"}
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", _agent_url(schema, agent), json=body, headers=headers) as r:
            if r.is_error:
                await r.aread()
                raise AgentError(r.status_code, r.text[:500])
            yield "request", {"request_id": r.headers.get("X-Snowflake-Request-Id")}
            event = "message"
            async for line in r.aiter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    payload = line[5:].strip()
                    try:
                        data = json.loads(payload)
                    except ValueError:  # end-of-stream markers such as [DONE]
                        continue
                    yield event, data if isinstance(data, dict) else {"value": data}


class AgentError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"agent run failed ({status}): {body}")
        self.status = status


# ---- Threads + feedback ---------------------------------------------------

async def create_thread() -> int:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{_base_url()}/cortex/threads", json={"origin_application": "agentic_cmo"}, headers=_headers())
        r.raise_for_status()
        data = r.json()
        return int(data["thread_id"] if isinstance(data, dict) else data)


async def last_assistant_message(thread_id: int) -> int:
    """Latest stored assistant message, the only valid parent for the next turn; 0 if the thread has none."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{_base_url()}/cortex/threads/{thread_id}", params={"page_size": 20}, headers=_headers())
        r.raise_for_status()
        ids = [m["message_id"] for m in r.json().get("messages", []) if m.get("role") == "assistant"]
        return max(ids, default=0)


async def send_feedback(schema: str, agent: str, request_id: str | None, positive: bool, message: str | None,
                        categories: list[str], thread_id: int | None = None) -> None:
    """Feedback on one run (by its request id), or on the agent as a whole when request_id is None."""
    body = {"positive": positive, "feedback_message": message or "", "categories": categories}
    if request_id:
        body["orig_request_id"] = request_id
    if thread_id is not None:
        body["thread_id"] = thread_id
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{_base_url()}/databases/{DB}/schemas/{schema}/agents/{agent}:feedback",
                              json=body, headers=_headers())
        r.raise_for_status()
