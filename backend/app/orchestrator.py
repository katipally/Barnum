"""Hybrid orchestration: fan out to every active channel agent in parallel, then let the CMO agent synthesize.

Events (SSE `event:` names) the frontend can render:
  status        {stage, message}
  strip         executive strip numbers
  delegation    {channel, state: started|done|error, text?, seconds?}
  memo          decision memo (deterministic, from PROPOSE_REALLOCATION)
  cmo_delta     {text}             streamed CMO tokens
  tool          {name, input}      CMO tool calls (in /ask)
  done          {seconds, thread_id?, message_id?, request_id?}   /ask: thread to continue, parent for the next turn
  error         {message}
"""
import asyncio
import json
import time
from typing import AsyncIterator

import httpx

from . import queries
from . import snowflake as sf

REVIEW_QUESTION = ("Give your status report for this quarter for the CMO: spend vs plan, MQLs, SQLs, cost per SQL, "
                   "MQL-to-SQL rate, what the next $10k buys, best and worst campaigns, whether spend reconciles, "
                   "and one recommendation with a dollar amount.")


def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def _channel(ch: dict, question: str, client: httpx.AsyncClient) -> dict:
    t = time.monotonic()
    try:
        r = await sf.run_agent(ch["schema_name"], "AGENT", question, client)
        return {"channel": ch["channel_id"], "state": "done", "text": r["text"], "seconds": round(time.monotonic() - t, 1)}
    except Exception as e:  # one failing channel must not sink the review
        return {"channel": ch["channel_id"], "state": "error", "text": str(e)[:500], "seconds": round(time.monotonic() - t, 1)}


def _user(text: str) -> dict:
    return {"role": "user", "content": [{"type": "text", "text": text}]}


async def _cmo_stream(messages: list[dict], run: dict | None = None, thread_id: int | None = None,
                      parent_message_id: int = 0) -> AsyncIterator[str]:
    """Streams the CMO agent as SSE; fills `run` with its request_id and stored assistant message_id."""
    run = {} if run is None else run
    async for event, data in sf.stream_agent("CORE", "CMO_AGENT", messages, thread_id, parent_message_id):
        if event == "request":
            run["request_id"] = data.get("request_id")
        elif event == "metadata" and (data.get("metadata") or {}).get("role") == "assistant":
            run["message_id"] = data["metadata"].get("message_id")
        elif event == "response.text.delta":
            yield sse("cmo_delta", {"text": data.get("text", "")})
        elif event == "response.tool_use":
            yield sse("tool", {"name": data.get("name"), "input": data.get("input")})
        elif event == "response.status":
            yield sse("status", {"stage": "cmo", "message": data.get("message") or data.get("status")})
        elif event == "error":
            yield sse("error", {"message": data.get("message", data)})


async def guarded(gen: AsyncIterator[str]) -> AsyncIterator[str]:
    """Turn any failure mid-stream into an error event instead of a silently cut connection."""
    try:
        async for chunk in gen:
            yield chunk
    except Exception as e:
        yield sse("error", {"message": str(e)[:500]})


async def review(question: str = REVIEW_QUESTION) -> AsyncIterator[str]:
    """Full Q4 review: strip, parallel channel reports, reallocation memo, CMO memo to the CEO."""
    t0 = time.monotonic()
    yield sse("strip", await asyncio.to_thread(queries.strip))
    channels = await asyncio.to_thread(queries.active_channels)
    for ch in channels:
        yield sse("delegation", {"channel": ch["channel_id"], "state": "started"})
    reports = []
    async with httpx.AsyncClient() as client:
        for fut in asyncio.as_completed([_channel(ch, question, client) for ch in channels]):
            r = await fut
            reports.append(r)
            yield sse("delegation", r)
    yield sse("status", {"stage": "reallocation", "message": "optimizing remaining budget on SQLs"})
    memo = await asyncio.to_thread(queries.propose_reallocation)
    yield sse("memo", memo)
    brief = ("Write the CMO memo to the CEO for this quarter from the material below. Do not call tools; every number you "
             "need is here. Lead with the decision, then evidence per channel, then the memo's SQL impact and whether it "
             "needs approval.\n\nChannel agent reports:\n"
             + "\n\n".join(f"[{r['channel']}] {r['text']}" for r in reports if r["state"] == "done")
             + f"\n\nReallocation memo (from the optimizer):\n{json.dumps(memo, default=str)}")
    run: dict = {}
    try:
        async for chunk in _cmo_stream([_user(brief)], run):
            yield chunk
    finally:
        if run.get("request_id"):  # lets the CEO's decision on this memo become feedback on this run
            try:
                await asyncio.to_thread(record_memo_run, memo["memo_id"], run["request_id"])
            except Exception as e:
                print(f"[memo-runs] could not record {memo['memo_id']}: {e}")
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1)})


def _fold(history: list[dict], question: str) -> str:
    """A thread's first turn takes exactly one user message, so earlier context goes into it as a transcript."""
    lines = [f"[{m.get('role')}] " + "".join(c.get("text", "") for c in m.get("content", [])) for m in history]
    if not lines:
        return question
    return "Context from before this conversation:\n\n" + "\n\n".join(lines) + f"\n\n[user] {question}"


async def ask(question: str, history: list[dict], thread_id: int | None = None, parent_message_id: int | None = None,
              new_thread: bool = False) -> AsyncIterator[str]:
    """Free-form question to the CMO agent; it delegates to channel agents through its ask_channel tool.
    With a thread the agent keeps the conversation; without one (or when threads fail) `history` is sent instead."""
    t0 = time.monotonic()
    run: dict = {}
    try:
        if thread_id is None and new_thread:
            thread_id, parent_message_id = await sf.create_thread(), 0
        elif thread_id is not None and parent_message_id is None:
            parent_message_id = await sf.last_assistant_message(thread_id)
    except Exception as e:
        yield sse("status", {"stage": "thread", "message": f"threads unavailable, sending history instead: {str(e)[:200]}"})
        thread_id = None
    if thread_id is not None:
        text = _fold(history, question) if parent_message_id == 0 else question
        try:
            async for chunk in _cmo_stream([_user(text)], run, thread_id, parent_message_id):
                yield chunk
        except sf.AgentError as e:  # raised before any output, so retrying without the thread is safe
            yield sse("status", {"stage": "thread", "message": f"thread {thread_id} unusable, sending history instead: {e}"})
            thread_id = None
    if thread_id is None:
        async for chunk in _cmo_stream(history + [_user(question)], run):
            yield chunk
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1), "thread_id": thread_id,
                       # No stored assistant message means the turn was not saved; continue from the previous one.
                       "message_id": run.get("message_id") or (parent_message_id if thread_id is not None else None),
                       "request_id": run.get("request_id")})


# ---- CEO decisions as agent feedback ---------------------------------------------
# Kept outside CORE (shared live): which CMO run wrote each memo, and what the CEO decided.

MEMO_RUNS = "CMO_DB.EVALS.MEMO_RUNS"
_memo_runs_ready = False


def _ensure_memo_runs() -> None:
    global _memo_runs_ready
    if not _memo_runs_ready:
        sf.execute("CREATE SCHEMA IF NOT EXISTS CMO_DB.EVALS")
        sf.execute(f"""CREATE TABLE IF NOT EXISTS {MEMO_RUNS} (
            memo_id STRING, agent STRING, request_id STRING, created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
            decision STRING, note STRING, positive BOOLEAN, feedback_at TIMESTAMP_NTZ, feedback_error STRING)""")
        _memo_runs_ready = True


def record_memo_run(memo_id: str, request_id: str) -> None:
    _ensure_memo_runs()
    sf.execute(f"INSERT INTO {MEMO_RUNS} (memo_id, agent, request_id) VALUES (%s, 'CORE.CMO_AGENT', %s)", (memo_id, request_id))


async def memo_feedback(memo_id: str, decision: str, note: str | None) -> dict:
    """Approve = positive, reject = negative feedback on the run that wrote the memo (agent-level if none did)."""
    await asyncio.to_thread(_ensure_memo_runs)
    rows = await asyncio.to_thread(sf.query, f"SELECT request_id FROM {MEMO_RUNS} WHERE memo_id = %s "
                                   "AND request_id IS NOT NULL ORDER BY created_at DESC LIMIT 1", (memo_id,))
    request_id = rows[0]["request_id"] if rows else None
    positive = decision == "approved"
    message = f"CEO {decision} memo {memo_id}" + (f": {note}" if note else "")
    error = None
    try:
        await sf.send_feedback("CORE", "CMO_AGENT", request_id, positive, message, ["ceo_decision", f"memo_{decision}"])
    except Exception as e:
        error = str(e)[:500]
    await asyncio.to_thread(sf.execute, f"""MERGE INTO {MEMO_RUNS} t USING (SELECT %s memo_id) v ON t.memo_id = v.memo_id
        WHEN MATCHED THEN UPDATE SET decision = %s, note = %s, positive = %s, feedback_at = CURRENT_TIMESTAMP(), feedback_error = %s
        WHEN NOT MATCHED THEN INSERT (memo_id, agent, decision, note, positive, feedback_at, feedback_error)
          VALUES (v.memo_id, 'CORE.CMO_AGENT', %s, %s, %s, CURRENT_TIMESTAMP(), %s)""",
                            (memo_id, decision, note, positive, error, decision, note, positive, error))
    return {"memo_id": memo_id, "request_id": request_id, "positive": positive, "error": error}
