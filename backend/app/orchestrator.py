"""Hybrid orchestration: fan out to every active channel agent in parallel, then let the CMO agent synthesize.

Events (SSE `event:` names) the frontend can render:
  status        {stage, message}
  strip         executive strip numbers
  delegation    {channel, state: started|done|error, text?, seconds?}
  memo          decision memo (deterministic, from PROPOSE_REALLOCATION)
  cmo_delta     {text}             the CMO's answer text, sent once the stream ends; narration before a tool call is dropped
  tool          {name, input}      CMO tool calls (in /ask)
  done          {seconds}
  error         {message}
"""
import asyncio
import json
import time
from typing import AsyncIterator

import httpx

from . import queries
from . import snowflake as sf

REVIEW_QUESTION = ("Give the CMO your status report: what your data measures and over which window, the funnel stages "
                   "you measure (and which are proxies or estimates), cost per stage when spend is measured, your most "
                   "telling native metrics, best and worst campaigns or segments, whether spend reconciles, and one "
                   "recommendation.")


def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def _channel(ch: dict, question: str, client: httpx.AsyncClient) -> dict:
    t = time.monotonic()
    try:
        r = await sf.run_agent(ch["schema_name"], "AGENT", question, client)
        return {"channel": ch["channel_id"], "state": "done", "text": r["text"], "seconds": round(time.monotonic() - t, 1)}
    except Exception as e:  # one failing channel must not sink the review
        return {"channel": ch["channel_id"], "state": "error", "text": str(e)[:500], "seconds": round(time.monotonic() - t, 1)}


async def _cmo_stream(messages: list[dict]) -> AsyncIterator[str]:
    held = ""  # text before a tool call is narration, so only text after the last tool call is sent
    async for event, data in sf.stream_agent("CORE", "CMO_AGENT", messages):
        if event == "response.text.delta":
            held += data.get("text", "")
        elif event == "response.tool_use":
            held = ""
            yield sse("tool", {"name": data.get("name"), "input": data.get("input")})
        elif event == "response.status":
            yield sse("status", {"stage": "cmo", "message": data.get("message") or data.get("status")})
        elif event == "error":
            yield sse("error", {"message": data.get("message", data)})
    if held:
        yield sse("cmo_delta", {"text": held})


async def guarded(gen: AsyncIterator[str]) -> AsyncIterator[str]:
    """Turn any failure mid-stream into an error event instead of a silently cut connection."""
    try:
        async for chunk in gen:
            yield chunk
    except Exception as e:
        yield sse("error", {"message": str(e)[:500]})


async def review(question: str = REVIEW_QUESTION) -> AsyncIterator[str]:
    """Full review: strip, parallel channel reports, reallocation memo, CMO memo to the CEO."""
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
    try:
        memo = await asyncio.to_thread(queries.propose_reallocation)
        yield sse("memo", memo)
    except ValueError as e:  # fewer than two budget channels: review still runs
        memo = {"skipped": str(e)}
        yield sse("status", {"stage": "reallocation", "message": f"skipped: {e}"})
    brief = ("Write the CMO memo to the CEO from the material below. Do not call tools; every number you need is here. "
             "Lead with the decision, then evidence per channel in its own terms, then the memo's SQL impact and whether it "
             "needs approval, then data gaps.\n\nChannel agent reports:\n"
             + "\n\n".join(f"[{r['channel']}] {r['text']}" for r in reports if r["state"] == "done")
             + f"\n\nReallocation memo (from the optimizer):\n{json.dumps(memo, default=str)}")
    async for chunk in _cmo_stream([{"role": "user", "content": [{"type": "text", "text": brief}]}]):
        yield chunk
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1)})


async def ask(messages: list[dict]) -> AsyncIterator[str]:
    """Free-form question to the CMO agent; it delegates to channel agents through its ask_channel tool."""
    t0 = time.monotonic()
    async for chunk in _cmo_stream(messages):
        yield chunk
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1)})
