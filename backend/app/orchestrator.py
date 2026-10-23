"""Hybrid orchestration: fan out to every active channel agent in parallel, then let the CMO agent synthesize.

Events (SSE `event:` names) the frontend can render:
  status        {stage, message}
  strip         executive strip numbers
  delegation    {channel, state: started|done|error, text?, seconds?}
  memo          decision memo (deterministic, from PROPOSE_REALLOCATION)
  meta          {model}            orchestration model of the CMO agent, sent first
  cmo_delta     {text}             the CMO's answer text, sent once it is final; narration before a tool call is dropped
  tool          {name, input, tool_use_id}   CMO tool call started (in /ask); parallel calls overlap
  tool_done     {name, tool_use_id, seconds, ok}
  done          {seconds, model}
  error         {message}

/plan/2027 reuses meta, status, tool, tool_done, cmo_delta, done and error, and adds:
  plan          PLAN_2027 numbers, sent as soon as the procedure returns
  channel_plan  one per channel: numbers + plan_cost_per_sql, verdict, agent_recommends_cut, rationale, actions, risk, source (agent|fallback)
  targets       targets block of the plan
"""
import asyncio
import json
import time
from typing import AsyncIterator

import httpx

from . import plan as plan_helpers
from . import queries
from . import snowflake as sf

HEARTBEAT_SECONDS = 10

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


async def _cmo_stream(messages: list[dict], capture: dict | None = None) -> AsyncIterator[str]:
    """With `capture`, the caller owns meta and the answer: tool calls and results go to capture["calls"], the answer to capture["text"]."""
    if capture is None:
        model = await asyncio.to_thread(sf.agent_model, "CORE", "CMO_AGENT")
        yield sse("meta", {"model": model})
    else:
        capture["calls"] = {}
    started: dict[str, tuple[str, float]] = {}  # tool_use_id -> (name, start)
    held = ""  # text before a tool call is narration, so only text after the last tool call is sent
    events = sf.stream_agent("CORE", "CMO_AGENT", messages).__aiter__()
    nxt = asyncio.ensure_future(events.__anext__())
    t = time.monotonic()
    try:
        while True:
            finished, _ = await asyncio.wait({nxt}, timeout=HEARTBEAT_SECONDS)
            if not finished:
                running = ", ".join(n for n, _ in started.values())
                waited = round(time.monotonic() - t)
                yield sse("status", {"stage": "cmo", "message": f"Still working on {running or 'the answer'} ({waited}s)"})
                continue
            try:
                event, data = nxt.result()
            except StopAsyncIteration:
                break
            nxt = asyncio.ensure_future(events.__anext__())
            t = time.monotonic()
            if event == "response.text.delta":
                held += data.get("text", "")
            elif event == "response.tool_use":
                held = ""
                started[data.get("tool_use_id")] = (data.get("name"), time.monotonic())
                if capture is not None:
                    capture["calls"][data.get("tool_use_id")] = {"name": data.get("name"), "input": data.get("input")}
                yield sse("tool", {"name": data.get("name"), "input": data.get("input"), "tool_use_id": data.get("tool_use_id")})
            elif event == "response.tool_result":
                name, t_start = started.pop(data.get("tool_use_id"), (data.get("name"), time.monotonic()))
                if capture is not None and data.get("tool_use_id") in capture["calls"] and data.get("status") != "error":
                    capture["calls"][data["tool_use_id"]]["result"] = data
                yield sse("tool_done", {"name": name, "tool_use_id": data.get("tool_use_id"),
                                        "seconds": round(time.monotonic() - t_start, 1), "ok": data.get("status") != "error"})
            elif event == "response.status":
                yield sse("status", {"stage": "cmo", "message": data.get("message") or data.get("status")})
                if data.get("status") == "proceeding_to_answer" and held:
                    break  # the answer is complete; the rest of the stream is suggested queries and the aggregate
            elif event == "error":
                yield sse("error", {"message": data.get("message", data)})
    finally:
        nxt.cancel()
        await asyncio.gather(nxt, return_exceptions=True)
        await events.aclose()
    if capture is not None:
        capture["text"] = held
    elif held:
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
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1), "model": sf.agent_model("CORE", "CMO_AGENT")})


async def ask(messages: list[dict]) -> AsyncIterator[str]:
    """Free-form question to the CMO agent; it delegates to channel agents through its ask_channel tool."""
    t0 = time.monotonic()
    async for chunk in _cmo_stream(messages):
        yield chunk
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1), "model": sf.agent_model("CORE", "CMO_AGENT")})


def _plan_prompt(i: dict) -> str:
    return (f"Plan 2027. Inputs: marketing budget ${i['budget_usd']:,.0f}; new revenue target ${i['revenue_target_usd']:,.0f}; "
            f"sales leads (SQLs) per quarter {i['sqls_per_quarter']:g}; brand and awareness share of the budget {i['brand_pct']:.0%}. "
            f"Call plan_2027 with budget={i['budget_usd']:g}, revenue_target={i['revenue_target_usd']:g}, "
            f"sqls_per_quarter={i['sqls_per_quarter']:g}, brand_pct={i['brand_pct']:g}, then ask every channel in parallel.")


async def plan_2027(inputs: dict) -> AsyncIterator[str]:
    """Numbers first (deterministic, seconds), then the CMO agent delegates to every channel agent for verdicts and actions.
    A failed or malformed agent answer degrades to deterministic actions; the plan is saved either way."""
    t0 = time.monotonic()
    try:
        model = await asyncio.to_thread(sf.agent_model, "CORE", "CMO_AGENT")
    except Exception:
        model = None
    yield sse("meta", {"model": model})
    yield sse("status", {"stage": "plan", "message": "computing budgets per channel"})
    try:
        numbers = await asyncio.to_thread(queries.plan_numbers, inputs["budget_usd"], inputs["revenue_target_usd"],
                                          inputs["sqls_per_quarter"], inputs["brand_pct"])
    except ValueError as e:
        yield sse("error", {"message": str(e)})
        return
    yield sse("plan", numbers)
    capture: dict = {}
    try:
        async for chunk in _cmo_stream([{"role": "user", "content": [{"type": "text", "text": _plan_prompt(inputs)}]}], capture):
            yield chunk
    except Exception as e:  # the plan is still useful without the agent
        yield sse("error", {"message": f"CMO agent failed, using fallback actions: {str(e)[:300]}"})
    agent = plan_helpers.parse_agent_json(capture.get("text", ""))
    channels = plan_helpers.merge_channels(numbers, agent, plan_helpers.channel_answers(capture.get("calls", {})))
    for c in channels:
        yield sse("channel_plan", c)
    yield sse("targets", numbers["targets"])
    summary = agent.get("summary") if agent and isinstance(agent.get("summary"), str) and agent["summary"].strip() else plan_helpers.fallback_summary(numbers)
    yield sse("cmo_delta", {"text": summary})
    try:
        plan_id = await asyncio.to_thread(queries.save_plan, inputs, numbers, channels, summary, model)
    except Exception as e:
        plan_id = None
        yield sse("error", {"message": f"Plan not saved: {str(e)[:300]}"})
    yield sse("done", {"seconds": round(time.monotonic() - t0, 1), "model": model, "plan_id": plan_id})
