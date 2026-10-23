"""Cortex Agent evaluation of the live CMO agent on the golden set in sql/60_cortex_evals.sql.

uv run python -m evals.cortex_eval                  # setup, start a run, wait, store scores in EVALS.AGENT_SCORECARD
uv run python -m evals.cortex_eval --collect RUN    # only fetch and store the scores of an existing run
uv run python -m evals.cortex_eval --judge          # fallback without Cortex evaluations (also used automatically when
                                                    # the role lacks EXECUTE TASK): same metrics, AI_COMPLETE judge

Read-only against CORE: it only runs the agent (questions ask for analysis, never a memo) and writes to CMO_DB.EVALS.
Results show up in Snowsight under AI & ML > Agents > CMO_AGENT > Evaluations (see docs/observability.md).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

from backend.app import snowflake as sf

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "sql" / "60_cortex_evals.sql"
STAGE = "@CMO_DB.EVALS.EVAL_CONFIG"
CONFIG = "cmo_agent_eval.yaml"
AGENT = ("CMO_DB", "CORE", "CMO_AGENT")
PASS = 0.8  # Snowsight's "high" bucket; normalized scores are 0-1
JUDGE_MODEL = "claude-sonnet-4-6"

# Custom metric for the traps: numbers must come from tools, and unmeasured means unknown, not zero.
NO_INVENTED_NUMBERS = """\
You are auditing a CMO agent's answer for invented numbers.
Question: {{input}}
Answer: {{output}}
Expected answer: {{ground_truth}}
Tool calls and results: {{tool_info}}
Score 1-10. 10: every number in the answer is backed by the expected answer or the tool results, and anything not
measured (for example cost per SQL for a channel without spend) is called unknown or not measurable, never zero or a
made-up figure. 5: minor unbacked numbers that do not change the conclusion. 1: an invented figure drives the
conclusion (for example a cost per SQL for a channel with no spend, or doubling spend doubles SQLs).
Reply with the score only."""


def golden() -> list[dict]:
    return sf.query("SELECT qid, category, input_query, ground_truth, trap FROM CMO_DB.EVALS.AGENT_GOLDEN ORDER BY qid")


def setup() -> str:
    """Runs the SQL file and returns a dataset name tied to the golden set's content (datasets are immutable)."""
    sf.run_script(SQL)
    rows = golden()
    digest = hashlib.sha1(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()[:8]
    return f"CMO_GOLDEN_{digest.upper()}"


def dataset_exists(name: str) -> bool:
    try:
        return bool(sf.query(f"SHOW DATASETS LIKE '{name}' IN SCHEMA CMO_DB.EVALS"))
    except Exception:
        return False


def config_yaml(dataset: str, create: bool) -> str:
    ds = (f"""dataset:
  dataset_type: "CORTEX AGENT"
  table_name: "CMO_DB.EVALS.AGENT_GOLDEN"
  dataset_name: "{dataset}"
  column_mapping:
    query_text: "INPUT_QUERY"
    ground_truth: "GROUND_TRUTH"
""" if create else "")
    prompt = "\n".join("      " + line for line in NO_INVENTED_NUMBERS.splitlines())
    return ds + f"""evaluation:
  agent_params:
    agent_name: "{'.'.join(AGENT)}"
    agent_type: "CORTEX AGENT"
  run_params:
    label: "golden set"
    description: "Per-channel cost per SQL, unmeasured-spend traps, LinkedIn trap, linear-extrapolation trap, status, plan, delegation"
  source_metadata:
    type: "dataset"
    dataset_name: "{dataset}"
metrics:
  - name: "answer_correctness"
    version: "v3"
  - name: "logical_consistency"
    version: "v3"
  - name: "tool_selection_accuracy"
  - name: "no_invented_numbers"
    model: "{JUDGE_MODEL}"
    score_ranges:
      min_score: [1, 4]
      median_score: [4, 7]
      max_score: [7, 10]
    prompt: |
{prompt}
"""


def upload(text: str) -> None:
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / CONFIG
        path.write_text(text)
        sf.execute(f"PUT 'file://{path}' {STAGE} AUTO_COMPRESS = FALSE OVERWRITE = TRUE")


def evaluation(job: str, run: str) -> str:
    sf.execute("USE SCHEMA CMO_DB.EVALS")
    rows = sf.query(f"CALL EXECUTE_AI_EVALUATION('{job}', OBJECT_CONSTRUCT('run_name', %s), '{STAGE}/{CONFIG}')", [run])
    return json.dumps(rows, default=str)


def wait(run: str, timeout_s: int = 3600) -> str:
    t0, last = time.monotonic(), ""
    while time.monotonic() - t0 < timeout_s:
        status = evaluation("STATUS", run)
        if status != last:
            print(f"[{time.monotonic() - t0:5.0f}s] {status[:400]}", flush=True)
            last = status
        if any(s in status.upper() for s in ("COMPLETED", "FAILED", "CANCELLED", "PARTIALLY")):
            return status
        time.sleep(20)
    return last


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def collect(run: str) -> list[dict]:
    """Per-record, per-metric scores from GET_AI_EVALUATION_DATA, stored in AGENT_SCORECARD."""
    rows = sf.query("SELECT * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA(%s, %s, %s, 'CORTEX AGENT', %s))",
                    [*AGENT, run])
    by_query = {g["input_query"].strip(): g for g in golden()}
    out = []
    for r in rows:
        g = by_query.get(str(r.get("input") or "").strip().strip('"'), {})
        score = _num(r.get("eval_agg_score"))
        if score is not None and score > 1:  # custom metric on its own 1-10 scale
            score = score / 10
        explanation = r.get("metric_calls")
        if isinstance(explanation, str):
            try:
                calls = json.loads(explanation)
                explanation = " | ".join(str(c.get("explanation") or c.get("criteria") or "") for c in calls) or explanation
            except ValueError:
                pass
        out.append({
            "run_name": run, "source": "cortex_eval", "qid": g.get("qid"), "category": g.get("category"),
            "input_query": r.get("input"), "metric_name": r.get("metric_name"), "score": score,
            "passed": None if score is None else score >= PASS, "explanation": str(explanation or r.get("error") or "")[:4000],
            "output": str(r.get("output") or "")[:8000], "duration_ms": r.get("duration_ms"), "record_id": r.get("record_id"),
        })
    store(run, out)
    return out


def store(run: str, rows: list[dict]) -> None:
    sf.execute("DELETE FROM CMO_DB.EVALS.AGENT_SCORECARD WHERE run_name = %s", [run])
    cols = ["run_name", "source", "qid", "category", "input_query", "metric_name", "score", "passed", "explanation",
            "output", "duration_ms", "record_id", "thread_id", "tools"]
    for r in rows:
        r = r | {"tools": json.dumps(r.get("tools") or [])}
        sf.execute(f"""INSERT INTO CMO_DB.EVALS.AGENT_SCORECARD ({', '.join(cols)})
                       SELECT {', '.join(['%s'] * (len(cols) - 1))}, PARSE_JSON(%s)""", [r.get(c) for c in cols])


# ---- fallback: same metrics without EXECUTE TASK -----------------------------------
# Each question runs in its own agent thread (origin golden_eval), so it shows up in the agent's Observability pane;
# the verdict is posted back as feedback on that request. Gating metrics decide pass/fail, the others are reported.

GATING = ("answer_correctness", "no_invented_numbers", "no_write_tools")
WRITE_TOOLS = {"propose_reallocation"}

JUDGE = """You grade a CMO agent's answer. Score each metric from 0.0 to 1.0.
answer_correctness: against the expected answer. Numbers within the stated tolerance count as correct; wording does
  not matter; the answer must reach the same conclusion.
logical_consistency: reference-free. The answer agrees with itself and with the tool results, and its conclusion
  follows from its evidence.
no_invented_numbers: every number in the answer is backed by the expected answer or the tool results, and anything not
  measured is called unknown, never zero or a made-up figure. Numbers the answer leaves out lower answer_correctness,
  not this metric. Simple arithmetic on backed numbers (sums, ratios, differences) counts as backed, and tool results
  may write numbers in scientific notation (3.11e+02 = 311). Trap to watch for: {trap}
Question: {q}
Expected answer: {gt}
Tool calls and results: {tools}
Agent answer: {a}
Reply with JSON only: {{"answer_correctness": x, "logical_consistency": x, "no_invented_numbers": x,
"reason": "<one sentence on the weakest point>"}}"""


async def _ask(question: str, client) -> dict:
    """One agent turn in a fresh thread; returns text, tool calls, request and thread ids."""
    r = await client.post(f"{sf._base_url()}/cortex/threads", json={"origin_application": "golden_eval"},
                          headers=sf._headers(), timeout=30)
    r.raise_for_status()
    thread_id = int(r.json()["thread_id"])
    body = {"messages": [{"role": "user", "content": [{"type": "text", "text": question}]}], "stream": False,
            "thread_id": thread_id, "parent_message_id": 0}
    r = await client.post(sf._agent_url(AGENT[1], AGENT[2]), json=body, headers=sf._headers(), timeout=300)
    r.raise_for_status()
    content = r.json().get("content", [])
    calls = [c["tool_use"] for c in content if c.get("type") == "tool_use"]
    results = [json.dumps(c["tool_result"].get("content"), default=str)[:20000] for c in content if c.get("type") == "tool_result"]
    return {"text": "".join(c.get("text", "") for c in content if c.get("type") == "text"),
            "tools": [{"name": c.get("name"), "input": c.get("input")} for c in calls], "tool_results": results,
            "request_id": r.headers.get("x-snowflake-request-id"), "thread_id": thread_id}


def tool_selection(expected: list[dict], tools: list[dict]) -> float:
    """Native formula on distinct tool names: matched / max(expected, called)."""
    want, got = {e["tool_name"] for e in expected}, {t["name"] for t in tools}
    return len(want & got) / max(len(want), len(got), 1)


async def judge_run(run: str, feedback: bool = True) -> list[dict]:
    import httpx

    gold = golden()
    sem = asyncio.Semaphore(4)

    async def answer(g: dict, client) -> dict:
        async with sem:
            t0 = time.monotonic()
            try:
                res = await _ask(g["input_query"], client)
            except Exception as e:  # keep scoring the rest
                res = {"text": f"[agent error] {str(e)[:500]}", "tools": [], "tool_results": [], "request_id": None,
                       "thread_id": None}
            res["ms"] = int((time.monotonic() - t0) * 1000)
            print(f"answered {g['qid']} in {res['ms'] / 1000:.0f}s, tools {[t['name'] for t in res['tools']]}", flush=True)
            return res

    async with httpx.AsyncClient() as client:
        answers = await asyncio.gather(*(answer(g, client) for g in gold))

    out = []
    for g, res in zip(gold, answers):
        gt = json.loads(g["ground_truth"]) if isinstance(g["ground_truth"], str) else g["ground_truth"]
        tools_txt = json.dumps([{"call": t, "result": r} for t, r in zip(res["tools"], res["tool_results"])], default=str)
        prompt = JUDGE.format(q=g["input_query"], gt=gt["ground_truth_output"], trap=g["trap"], a=res["text"],
                              tools=tools_txt[:60000])
        raw = sf.query("SELECT AI_COMPLETE(%s, %s) AS r", [JUDGE_MODEL, prompt])[0]["r"]
        try:
            raw = json.loads(raw) if raw.startswith('"') else raw
            verdict = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
        except ValueError:
            verdict = {"reason": raw[:500]}
        writes = sorted({t["name"] for t in res["tools"]} & WRITE_TOOLS)
        scores = {m: _num(verdict.get(m)) for m in ("answer_correctness", "logical_consistency", "no_invented_numbers")}
        scores["tool_selection_accuracy"] = tool_selection(gt.get("ground_truth_invocations", []), res["tools"])
        scores["no_write_tools"] = 0.0 if writes else 1.0
        notes = {"tool_selection_accuracy": f"expected {[e['tool_name'] for e in gt.get('ground_truth_invocations', [])]}, "
                                            f"called {[t['name'] for t in res['tools']]}",
                 "no_write_tools": f"called {writes}" if writes else "no write tools called"}
        base = {"run_name": run, "source": "sql_judge", "qid": g["qid"], "category": g["category"],
                "input_query": g["input_query"], "output": res["text"][:8000], "duration_ms": res["ms"],
                "record_id": res["request_id"], "thread_id": res["thread_id"], "tools": res["tools"]}
        for m, score in scores.items():
            gate = m in GATING
            out.append(base | {"metric_name": m, "score": score,
                               "passed": (score is not None and score >= PASS) if gate else None,
                               "explanation": notes.get(m, verdict.get("reason"))})
        passed = all(scores[m] is not None and scores[m] >= PASS for m in GATING)
        if feedback and res["request_id"]:
            msg = (f"golden eval {run}: {g['qid']} {'PASS' if passed else 'FAIL'} - "
                   + ", ".join(f"{m} {v:.2f}" for m, v in scores.items() if v is not None)
                   + f". {verdict.get('reason', '')}")
            try:
                await sf.send_feedback(AGENT[1], AGENT[2], res["request_id"], passed, msg[:2000], ["golden_eval", g["qid"]],
                                       res["thread_id"])
            except Exception as e:  # feedback is for display only
                print(f"feedback for {g['qid']} failed: {str(e)[:200]}")
    store(run, out)
    return out


def summary(rows: list[dict]) -> None:
    by_q: dict[str, dict] = {}
    for r in rows:
        q = by_q.setdefault(r["qid"] or str(r["input_query"])[:40], {"passed": True, "metrics": {}, "why": []})
        q["metrics"][r["metric_name"]] = r["score"]
        if r["passed"] is False:
            q["passed"] = False
            q["why"].append(f"{r['metric_name']}={r['score'] if r['score'] is None else round(r['score'], 2)}: "
                            f"{str(r['explanation'])[:200]}")
    metrics = sorted({m for q in by_q.values() for m in q["metrics"]})
    print(f"\n{'question':<18} " + " ".join(f"{m[:14]:>14}" for m in metrics) + "  result")
    for qid, q in sorted(by_q.items()):
        cells = " ".join(f"{q['metrics'].get(m):>14.2f}" if q["metrics"].get(m) is not None else f"{'-':>14}" for m in metrics)
        print(f"{qid:<18} {cells}  {'PASS' if q['passed'] else 'FAIL'}")
    passed = sum(q["passed"] for q in by_q.values())
    print(f"\npass rate: {passed}/{len(by_q)} (a question passes when every gating metric scores >= {PASS})")
    for qid, q in sorted(by_q.items()):
        for w in q["why"]:
            print(f"  FAIL {qid}: {w}")


def decisions() -> int:
    return sf.query("SELECT COUNT(*) AS n FROM CMO_DB.CORE.DECISION_LOG")[0]["n"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=f"golden-{datetime.now():%m%d-%H%M}")
    ap.add_argument("--collect", metavar="RUN", help="only fetch scores of an existing run")
    ap.add_argument("--judge", action="store_true", help="fallback: REST agent runs judged with AI_COMPLETE")
    ap.add_argument("--no-feedback", action="store_true", help="fallback: don't post verdicts as agent feedback")
    args = ap.parse_args()

    if args.collect:
        summary(collect(args.collect))
        return 0
    dataset = setup()
    before = decisions()
    started = False
    if not args.judge:
        upload(config_yaml(dataset, create=not dataset_exists(dataset)))
        try:
            print(f"dataset {dataset}, run {args.run}: {evaluation('START', args.run)[:400]}", flush=True)
            started = True
        except Exception as e:  # usually EXECUTE TASK ON ACCOUNT missing for the role
            print(f"Cortex Agent evaluation unavailable, using the SQL judge: {str(e)[:300]}", flush=True)
    if started:
        wait(args.run)
        rows = collect(args.run)
    else:
        rows = asyncio.run(judge_run(args.run + "-judge", feedback=not args.no_feedback))
    after = decisions()
    if after != before:
        print(f"WARNING: DECISION_LOG grew {before} -> {after} during the run (the agent wrote a memo)")
    summary(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
