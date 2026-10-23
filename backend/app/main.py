"""Agentic CMO API. Run: uvicorn backend.app.main:app --reload"""
import asyncio
import threading
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import brief, evals_summary, orchestrator, queries
from . import snowflake as sf
from .channels import ingest, mapping, provision

PAGE_LOAD_READS = (queries.strip, queries.channels, queries.memos, queries.assumptions)


def _warm():
    for read in PAGE_LOAD_READS:
        try:
            read(None) if read is queries.memos else read()  # memos is keyed by its status argument
        except Exception:
            return  # warming is best effort; the first real request reports the error


def _changed():
    queries.invalidate()
    threading.Thread(target=_warm, daemon=True).start()


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=_warm, daemon=True).start()
    yield


app = FastAPI(title="Agentic CMO", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(brief.router)


@app.middleware("http")
async def drop_cache_after_writes(request: Request, call_next):
    """Any non-GET may change what the reads return; channel routes write outside queries.py."""
    try:
        return await call_next(request)
    finally:
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            _changed()


SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


async def _invalidate_when_done(gen):
    """Review and ask write memos while streaming, after the middleware has returned."""
    try:
        async for chunk in gen:
            yield chunk
    finally:
        _changed()


def _sse(gen) -> StreamingResponse:
    return StreamingResponse(_invalidate_when_done(gen), media_type="text/event-stream", headers=SSE_HEADERS)


def _guard(fn, *args):
    """Map domain errors to HTTP codes; everything else stays a 500."""
    try:
        return fn(*args)
    except KeyError as e:
        raise HTTPException(404, str(e).strip("'\""))
    except ValueError as e:
        raise HTTPException(422, str(e))


# ---- channels: the plugin lifecycle ---------------------------------------

class ChannelIn(BaseModel):
    channel_id: str = Field(examples=["webinars"])
    display_name: str
    description: str = Field(description="What the channel is and how its data links to leads; goes into the mapping prompt")
    mql_rule: str | None = Field(None, description="What counts as an MQL in this data; proxies are fine")
    sql_rule: str | None = Field(None, description="What counts as an SQL; leave empty when the data cannot show SQLs")
    window_start: str | None = Field(None, description="YYYY-MM-DD the data starts; inferred from the data when omitted")
    window_end: str | None = Field(None, description="YYYY-MM-DD the data ends")
    plan_usd: float | None = Field(None, description="Planned spend for the planning period")


class ProposeIn(BaseModel):
    feedback: str | None = Field(None, description="Human correction fed to the mapper, e.g. 'book flight cost on start date'")


class ApproveIn(BaseModel):
    version: int | None = None


@app.get("/channels")
def list_channels():
    return queries.registry()


@app.post("/channels", status_code=201)
def create_channel(body: ChannelIn):
    return _guard(ingest.create_channel, body.channel_id, body.display_name, body.description, body.mql_rule,
                  body.sql_rule, body.window_start, body.window_end, body.plan_usd)


@app.post("/channels/{cid}/files")
async def upload_files(cid: str, files: list[UploadFile] = File(...), replace: bool = False):
    if any(not (f.filename or "").lower().endswith(".csv") for f in files):
        raise HTTPException(415, "only .csv files are supported")
    return [_guard(ingest.upload, cid, f.filename, await f.read(), replace) for f in files]


@app.get("/channels/{cid}/profile")
def channel_profile(cid: str):
    ch = _guard(ingest.get_channel, cid)
    return ingest.profile(ch["schema_name"])


@app.post("/channels/{cid}/mapping/propose")
def propose_mapping(cid: str, body: ProposeIn | None = None):
    return _guard(mapping.propose, cid, body.feedback if body else None)


@app.post("/channels/{cid}/mapping")
def submit_mapping(cid: str, body: dict):
    """Hand-written mapping (same JSON shape as a proposal); validated, then approved like any other."""
    return _guard(mapping.submit, cid, body)


@app.get("/channels/{cid}/mapping")
def get_mapping(cid: str, version: int | None = None):
    return _guard(provision.latest_mapping, cid, version)


@app.post("/channels/{cid}/mapping/approve")
def approve_mapping(cid: str, body: ApproveIn | None = None):
    res = _guard(provision.approve, cid, body.version if body else None)
    if not res["approved"]:
        raise HTTPException(409, res)
    return res


@app.post("/channels/{cid}/pause")
def pause_channel(cid: str):
    return _guard(provision.set_active, cid, False)


@app.post("/channels/{cid}/resume")
def resume_channel(cid: str):
    return _guard(provision.set_active, cid, True)


@app.get("/channels/{cid}/campaigns")
def channel_campaigns(cid: str):
    return queries.campaigns(cid)


@app.post("/crm/files")
async def upload_crm(files: list[UploadFile] = File(...), replace: bool = False):
    out = [ingest.load_csv("CORE", f.filename, await f.read(), replace) for f in files]
    sf.execute("CALL CMO_DB.CORE.REBUILD_FUNNEL()")
    return out


# ---- Now: where every channel stands ------------------------------------------

@app.get("/now/strip")
def now_strip():
    return queries.strip()


@app.get("/now/channels")
def now_channels():
    return queries.channels()


@app.post("/now/reallocate")
def now_reallocate(budget: float | None = None):
    """Deterministic memo, no LLM. budget defaults to the current annual run rate. /now/review runs the agents."""
    return _guard(queries.propose_reallocation, budget)


@app.post("/now/review")
def now_review():
    return _sse(orchestrator.guarded(orchestrator.review()))


# ---- 2027 Plan -------------------------------------------------------------

@app.get("/plan/current")
def plan_current():
    return queries.plan()


class PlanIn(BaseModel):
    budget_usd: float = Field(gt=0, le=1e12, allow_inf_nan=False)
    revenue_target_usd: float = Field(ge=0, le=1e13, allow_inf_nan=False)
    sqls_per_quarter: float = Field(ge=0, le=1e9, allow_inf_nan=False)
    brand_pct: float = Field(ge=0, le=1, allow_inf_nan=False, description="Share of the budget reserved for brand and awareness, 0 to 1")


@app.post("/plan/2027")
def plan_2027(body: PlanIn):
    """SSE: plan numbers first, then the CMO agent's verdicts and campaign actions per channel. See docs/PLAN_2027_CONTRACT.md."""
    return _sse(orchestrator.guarded(orchestrator.plan_2027(body.model_dump())))


@app.get("/plan/2027/latest")
def plan_2027_latest():
    return queries.plan_latest()


class DraftIn(BaseModel):
    plan_id: str
    channel_id: str


@app.post("/campaigns/draft")
def campaign_draft(body: DraftIn):
    """Stub: records a draft brief built from the saved plan; nothing is sent to any ad platform."""
    return {"data": _guard(queries.create_campaign_draft, body.plan_id, body.channel_id)}


@app.get("/campaigns")
def list_campaigns(channel_id: str | None = None):
    return queries.campaign_drafts(channel_id)


@app.get("/plan/scenarios")
def plan_scenarios(budget: float = 1_000_000, rule: str = "12mo"):
    if rule not in ("12mo", "3yr"):
        raise HTTPException(422, "rule must be 12mo or 3yr")
    if not 0 < budget <= 50_000_000:
        raise HTTPException(422, "budget must be between 0 and 50,000,000")
    return queries.unit_econ(budget, rule)


# ---- memos + chat --------------------------------------------------------------

@app.get("/memos")
def list_memos(status: str | None = None):
    return queries.memos(status)


class DecideIn(BaseModel):
    note: str | None = Field(None, description="The CEO's reason; sent with the decision as agent feedback")


@app.post("/memos/{memo_id}/{decision}")
async def decide_memo(memo_id: str, decision: str, background: BackgroundTasks, body: DecideIn | None = None):
    status = {"approve": "approved", "reject": "rejected"}.get(decision)
    if not status:
        raise HTTPException(404, "use /approve or /reject")
    res = await asyncio.to_thread(queries.decide, memo_id, status)
    if "error" in res:
        raise HTTPException(409, res["error"])
    # Feedback on the run that wrote the memo; after the response so the decision itself stays fast.
    background.add_task(orchestrator.memo_feedback, memo_id, status, body.note if body else None)
    return res


class AskIn(BaseModel):
    question: str
    history: list[dict] = Field(default_factory=list, description="Prior messages in Agent Run format; "
                                "used when no thread is given, folded into a new thread's first turn, and as the fallback")
    thread_id: int | None = Field(None, description="Agent Run thread to continue (returned in the done event)")
    parent_message_id: int | None = Field(None, description="Last assistant message_id from the done event; looked up if omitted")
    new_thread: bool = Field(False, description="Start a thread when thread_id is empty")


@app.post("/ask")
def ask(body: AskIn):
    return _sse(orchestrator.guarded(orchestrator.ask(body.question, body.history, body.thread_id,
                                                      body.parent_message_id, body.new_thread)))


# ---- settings + demo ---------------------------------------------------------

class AssumptionIn(BaseModel):
    num: float | None = None
    txt: str | None = None


@app.get("/assumptions")
def list_assumptions():
    return queries.assumptions()


@app.put("/assumptions/{key}")
def put_assumption(key: str, body: AssumptionIn):
    return queries.set_assumption(key, body.num, body.txt)


@app.post("/decisions/reset")
def decisions_reset():
    """Clears memos and approved plans; uploaded data is untouched."""
    return {"status": queries.reset_decisions()}


@app.get("/evals/hillclimb")
def evals_hillclimb():
    """The agent's own eval history: decision-logic versions, prompt versions, golden-question score."""
    return evals_summary.hillclimb()


@app.get("/health")
def health():
    return {"ok": True, "active_channels": [c["channel_id"] for c in queries.active_channels()]}
