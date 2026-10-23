"""Agentic CMO API. Run: uvicorn backend.app.main:app --reload"""
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import orchestrator, queries
from .channels import ingest, mapping, provision

app = FastAPI(title="Agentic CMO", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _sse(gen) -> StreamingResponse:
    return StreamingResponse(gen, media_type="text/event-stream", headers=SSE_HEADERS)


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
    mql_rule: str | None = Field(None, description="Overrides the shared MQL definition for this channel")
    plan_usd: float | None = Field(None, description="Planned spend for the current period")


class ProposeIn(BaseModel):
    feedback: str | None = Field(None, description="Human correction fed to the mapper, e.g. 'book flight cost on start date'")


class ApproveIn(BaseModel):
    version: int | None = None


@app.get("/channels")
def list_channels():
    return queries.registry()


@app.post("/channels", status_code=201)
def create_channel(body: ChannelIn):
    return _guard(ingest.create_channel, body.channel_id, body.display_name, body.description, body.mql_rule, body.plan_usd)


@app.post("/channels/{cid}/files")
async def upload_files(cid: str, files: list[UploadFile] = File(...), replace: bool = False):
    if any(not (f.filename or "").lower().endswith(".csv") for f in files):
        raise HTTPException(415, "only .csv files are supported")
    return [_guard(ingest.upload, cid, f.filename, await f.read(), replace) for f in files]


@app.get("/channels/{cid}/profile")
def channel_profile(cid: str):
    ch = _guard(ingest.get_channel, cid)
    prof = ingest.profile(ch["schema_name"])
    return prof | {"outcome_hint": ingest.outcome_hint(prof)}


@app.post("/channels/{cid}/mapping/propose")
def propose_mapping(cid: str, body: ProposeIn | None = None):
    return _guard(mapping.propose, cid, body.feedback if body else None)


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
    return [ingest.load_csv("CORE", f.filename, await f.read(), replace) for f in files]


# ---- Q4 Now ------------------------------------------------------------------

@app.get("/q4/strip")
def q4_strip():
    return queries.strip()


@app.get("/q4/channels")
def q4_channels():
    return queries.q4_channels()


@app.post("/q4/reallocate")
def q4_reallocate():
    """Deterministic memo, no LLM. Use /q4/review for the full agent run."""
    return queries.propose_reallocation()


@app.post("/q4/review")
def q4_review():
    return _sse(orchestrator.guarded(orchestrator.review()))


# ---- 2027 Plan -------------------------------------------------------------

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


@app.post("/memos/{memo_id}/{decision}")
def decide_memo(memo_id: str, decision: str):
    status = {"approve": "approved", "reject": "rejected"}.get(decision)
    if not status:
        raise HTTPException(404, "use /approve or /reject")
    res = queries.decide(memo_id, status)
    if "error" in res:
        raise HTTPException(409, res["error"])
    return res


class AskIn(BaseModel):
    question: str
    history: list[dict] = Field(default_factory=list, description="Prior messages in Agent Run format")


@app.post("/ask")
def ask(body: AskIn):
    messages = body.history + [{"role": "user", "content": [{"type": "text", "text": body.question}]}]
    return _sse(orchestrator.guarded(orchestrator.ask(messages)))


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


@app.post("/demo/reset")
def demo_reset():
    return {"status": queries.reset_demo()}


@app.get("/health")
def health():
    return {"ok": True, "active_channels": [c["channel_id"] for c in queries.active_channels()]}
