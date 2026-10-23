"""Prompt sweep and model sweep through Cortex COMPLETE.

  1. Strategy (weekly allocation): each prompt version and model drives the walk-forward backtest in every world;
     scored on decision regret, the trap ledger and autonomy-limit violations.
  2. Analysis: numeric questions over the channel data, exact answers.
  3. Triage: is a campaign name / CRM note a prompt injection?

Run: uv run python -m evals.sweep [--weeks 16 --every 2 --workers 8 --write]
Responses are cached in evals/.llm_cache, so a rerun costs nothing and prints the same numbers.
"""
from __future__ import annotations

import argparse
import json
import threading
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .backtest import Obs, Result, run, toward
from .llm import complete
from .prompts import PROMPTS, context_pack
from .tasks import ANALYSIS_SYSTEM, TRIAGE, TRIAGE_SYSTEM, analysis_cases, score_analysis, score_triage
from .traps import TRAPS
from .world import SCENARIOS, World, load

MODELS = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "llama3.3-70b", "llama3.1-8b"]
_lock = threading.Lock()
PROMPT_MODEL = "claude-sonnet-4-5"  # the prompt sweep holds the model fixed
SWEEP_PROMPT = "v3"                 # the model sweep holds the prompt fixed


@dataclass
class Stats:
    calls: int = 0
    violations: int = 0     # asked to move more than the autonomy limit (the harness then caps it, like the backend does)
    parse_failures: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    seconds: float = 0.0


def llm_policy(model: str, prompt: str, stats: Stats):
    def decide(obs: Obs) -> dict[str, float]:
        r = complete(model, PROMPTS[prompt], context_pack(obs))
        with _lock:
            stats.calls += 1
            stats.prompt_tokens += r["prompt_tokens"]
            stats.completion_tokens += r["completion_tokens"]
            stats.seconds += r["seconds"]
        try:
            text = r["text"]
            raw = json.loads(text[text.index("{"): text.rindex("}") + 1])["allocation"]
            alloc = {c: max(0.0, float(raw.get(c, 0))) for c in obs.channels}
            total = sum(alloc.values())
            alloc = {c: v * obs.budget / total for c, v in alloc.items()}
        except Exception:
            with _lock:
                stats.parse_failures += 1
            return dict(obs.last)
        limit = obs.autonomy * obs.budget
        if sum(max(alloc[c] - obs.last.get(c, 0), 0) for c in obs.channels) > limit * 1.01:
            with _lock:
                stats.violations += 1
        return toward(obs.last, alloc, limit)
    return decide


@dataclass
class Config:
    model: str
    prompt: str
    results: dict[str, Result] = field(default_factory=dict)
    stats: Stats = field(default_factory=Stats)

    @property
    def name(self) -> str:
        return f"{self.model}/{self.prompt}"


def run_strategy(configs: list[Config], base: World, weeks: int, every: int, seeds: list[int], workers: int) -> None:
    def job(cfg: Config, world: str, seed: int) -> None:
        trace = run(world, llm_policy(cfg.model, cfg.prompt, cfg.stats), base, weeks, seed, every)
        cfg.results[(world, seed)] = Result(cfg.name, world, seed, sum(sum(w.sqls.values()) for w in trace),
                                            sum(w.expected for w in trace), sum(w.oracle for w in trace), trace)
    with ThreadPoolExecutor(workers) as ex:
        for f in [ex.submit(job, c, w, s) for c in configs for w in SCENARIOS for s in seeds]:
            f.result()


def regret(cfg: Config, world: str) -> float:
    rs = [r.regret_pct for (w, _), r in cfg.results.items() if w == world]
    return sum(rs) / len(rs)


def traps_for(cfg: Config, base: World) -> dict[str, bool]:
    """A trap passes only if it passes on every seed."""
    return {t.id: all(t.check(r.trace, base) for (w, _), r in cfg.results.items() if w == t.world) for t in TRAPS}


def run_tasks(models: list[str], base: World, workers: int) -> dict[str, dict]:
    data, cases = analysis_cases(base)
    jobs = [(m, "analysis", i) for m in models for i in range(len(cases))] + [(m, "triage", i) for m in models for i in range(len(TRIAGE))]

    def job(m: str, task: str, i: int):
        if task == "analysis":
            r = complete(m, ANALYSIS_SYSTEM, f"{data}\n\nQuestion: {cases[i]['q']}", 1200)
            return m, task, score_analysis(r["text"], cases[i]["a"]), r
        r = complete(m, TRIAGE_SYSTEM, f"Text: {TRIAGE[i][0]}", 300)
        return m, task, score_triage(r["text"], TRIAGE[i][1]), r

    out: dict[str, dict] = defaultdict(lambda: defaultdict(lambda: {"ok": 0, "n": 0, "seconds": 0.0, "tokens": 0}))
    with ThreadPoolExecutor(workers) as ex:
        for m, task, ok, r in ex.map(lambda j: job(*j), jobs):
            s = out[m][task]
            s["ok"] += ok
            s["n"] += 1
            s["seconds"] += r["seconds"]
            s["tokens"] += r["prompt_tokens"] + r["completion_tokens"]
    return out


def print_strategy(title: str, configs: list[Config], base: World, label) -> None:
    worlds = list(SCENARIOS)
    print(f"\n{title}\n" + "-" * len(title))
    print("config".ljust(26) + "".join(w[:14].rjust(15) for w in worlds) + "   mean   traps  over-limit  sec/call")
    for c in configs:
        regs = [regret(c, w) for w in worlds]
        t = traps_for(c, base)
        per = c.stats.seconds / max(1, c.stats.calls)
        print(label(c).ljust(26) + "".join(f"{r:14.1%} " for r in regs) + f"{sum(regs) / len(regs):6.1%}   {sum(t.values())}/{len(t)}"
              f"   {c.stats.violations:3d}/{c.stats.calls:<3d}   {per:6.1f}")
    print("traps:", ", ".join(t.id for t in TRAPS))
    for c in configs:
        print("  " + label(c).ljust(24) + "  ".join(("PASS" if v else "FAIL") for v in traps_for(c, base).values()))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--weeks", type=int, default=16)
    p.add_argument("--every", type=int, default=2, help="weeks between decisions")
    p.add_argument("--seeds", type=int, nargs="*", default=[1, 2, 3])
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--models", nargs="*", default=MODELS)
    p.add_argument("--skip-prompts", action="store_true")
    p.add_argument("--skip-models", action="store_true")
    p.add_argument("--skip-tasks", action="store_true")
    p.add_argument("--write", action="store_true", help="store results in CMO_DB.EVALS.SWEEP_RUNS")
    a = p.parse_args()
    base = load()

    prompt_cfgs = [] if a.skip_prompts else [Config(PROMPT_MODEL, v) for v in PROMPTS]
    model_cfgs = [] if a.skip_models else [Config(m, SWEEP_PROMPT) for m in a.models if not (m == PROMPT_MODEL and prompt_cfgs)]
    run_strategy(prompt_cfgs + model_cfgs, base, a.weeks, a.every, a.seeds, a.workers)
    tasks = {} if a.skip_tasks else run_tasks(a.models, base, a.workers)

    print(f"{a.weeks} weeks, a decision every {a.every} weeks, seeds {a.seeds} (regret averaged; traps must pass on every seed). "
          "Regret = qualified leads lost vs the oracle (lower is better).")
    if prompt_cfgs:
        print_strategy(f"1. Prompt sweep on {PROMPT_MODEL}", prompt_cfgs, base, lambda c: f"prompt {c.prompt}")
    if model_cfgs or prompt_cfgs:
        shown = model_cfgs + [c for c in prompt_cfgs if c.prompt == SWEEP_PROMPT]
        shown.sort(key=lambda c: a.models.index(c.model) if c.model in a.models else 99)
        if not a.skip_models:
            print_strategy(f"2. Model sweep, strategy (prompt {SWEEP_PROMPT})", shown, base, lambda c: c.model)
    if tasks:
        print("\n3. Model sweep, lower-level tasks\n---------------------------------")
        print("model".ljust(22) + "analysis (exact)   sec/q   triage (injection)   sec/q")
        for m in a.models:
            an, tr = tasks[m]["analysis"], tasks[m]["triage"]
            print(m.ljust(22) + f"{an['ok']:>4}/{an['n']:<4}       {an['seconds'] / an['n']:5.1f}      {tr['ok']:>4}/{tr['n']:<4}           {tr['seconds'] / tr['n']:5.1f}")
    if a.write:
        write(prompt_cfgs + model_cfgs, tasks, base, a)


def write(configs: list[Config], tasks: dict, base: World, a) -> None:
    from backend.app import snowflake as sf

    sf.execute("CREATE SCHEMA IF NOT EXISTS CMO_DB.EVALS")
    sf.execute("""CREATE TABLE IF NOT EXISTS CMO_DB.EVALS.SWEEP_RUNS (
                    run_id STRING, run_at TIMESTAMP_TZ, task STRING, model STRING, prompt STRING, world STRING,
                    score FLOAT, regret_pct FLOAT, n INT, seconds_per_call FLOAT, tokens INT, detail VARIANT)""")
    run_id, now = uuid.uuid4().hex[:12], datetime.now(timezone.utc).isoformat()
    rows = []
    for c in configs:
        traps = traps_for(c, base)
        for (w, seed), r in c.results.items():
            rows.append((run_id, now, "strategy", c.model, c.prompt, f"{w}#{seed}", None, r.regret_pct, c.stats.calls,
                         c.stats.seconds / max(1, c.stats.calls), c.stats.prompt_tokens + c.stats.completion_tokens,
                         json.dumps({"traps": traps, "violations": c.stats.violations, "parse_failures": c.stats.parse_failures,
                                     "weeks": a.weeks, "every": a.every, "seed": seed})))
    for m, by_task in tasks.items():
        for task, s in by_task.items():
            rows.append((run_id, now, task, m, None, None, s["ok"] / s["n"], None, s["n"], s["seconds"] / s["n"], s["tokens"], "{}"))
    values = ", ".join(["(" + ", ".join(["%s"] * 12) + ")"] * len(rows))
    sf.execute(f"""INSERT INTO CMO_DB.EVALS.SWEEP_RUNS SELECT column1, column2::TIMESTAMP_TZ, column3, column4, column5, column6,
                   column7, column8, column9, column10, column11, PARSE_JSON(column12) FROM VALUES {values}""",
               [v for r in rows for v in r])
    print(f"\nWrote {len(rows)} rows to CMO_DB.EVALS.SWEEP_RUNS (run {run_id})")


if __name__ == "__main__":
    main()
