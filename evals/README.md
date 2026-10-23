# Evals: does the CMO make better decisions, and does it avoid known traps?

Marketing has no answer key. So we build one: a synthetic world **fitted to the real data in `CMO_DB`**, where
the true response curves are known, and replay decisions week by week. Every policy, including the live CMO
agent, is scored on how many qualified leads (SQLs) its allocation loses against the best possible one.

## Run

```bash
uv run python -m evals.backtest                 # all deterministic policies × all worlds, 3 seeds, ~1 s
uv run python -m evals.backtest --refit         # refit the world from Snowflake (read-only) first
uv run python -m evals.backtest --write         # also store results in CMO_DB.EVALS.EVAL_RUNS
uv run python -m evals.backtest --agent --policies --decide-every 4 --weeks 12   # live CMO agent only (~15-30 s per decision)
uv run pytest evals                             # trap ledger against marginal_sql (mirrors PROPOSE_REALLOCATION)
uv run pytest evals --policy marginal_sql_v3    # ... or any other policy, incl. --policy agent (slow)
uv run python -m evals.sweep --write            # prompt sweep + model sweep via Cortex COMPLETE (~10 min cold, seconds cached)
```

## Prompt and model sweep (`evals/sweep.py`)

Three task levels, each with a known answer, run through `SNOWFLAKE.CORTEX.COMPLETE` at temperature 0
(responses cached in `evals/.llm_cache`; results in `CMO_DB.EVALS.SWEEP_RUNS`):

1. **Strategy**: an LLM decides next week's allocation from an as-of context pack (`prompts.py`), every 2 weeks for 16
   weeks, in all five worlds, seeds 1-3. Scored on regret, the trap ledger, and how often it asked to move more than the
   10% autonomy limit (the harness caps the move, as the backend does).
2. **Analysis**: 8 numeric questions over the channel data (cost per SQL, ranking, the MQL trap, the response curve).
3. **Triage**: 16 campaign names / CRM notes; flag prompt injection.

### Prompt sweep on claude-sonnet-4-5

v1 = generic "get as many leads as possible"; v2 = the CMO agent's current instructions (`templates/cmo_agent.sql.j2`);
v3 = v2 plus five rules learned from the trap ledger (lag, noise, shocks, cheap MQLs, small steps).

| Prompt | Mean regret | Billboard lag | Traps (all seeds) | Asked to exceed limit |
|---|---|---|---|---|
| v1 | 3.4% | 7.2% | 2/4 | 0/120 |
| v2 | 3.6% | 9.2% | 2/4 | 6/120 |
| v3 | 4.4% | 7.4% | 2/4 | 0/120 |

**The prompt did not make the LLM a better allocator.** Regret differences are within seed noise and every version
fails billboard-patience and react-to-competitor. The one measurable gain: v3 removed v2's autonomy-limit violations.

### Model sweep (prompt v3 for strategy)

| Model | Strategy regret | Traps | Exceeded limit | sec/decision | Analysis | sec/q | Triage | sec/q |
|---|---|---|---|---|---|---|---|---|
| claude-opus-4-5 | 4.9% | 2/4 | 0/120 | 13.7 | 8/8 | 7.1 | 16/16 | 2.6 |
| claude-sonnet-4-5 | 4.4% | 2/4 | 0/120 | 4.4 | 8/8 | 5.9 | 16/16 | 2.2 |
| claude-haiku-4-5 | 5.3% | 2/4 | 0/120 | 5.5 | 8/8 | 2.5 | 16/16 | 0.9 |
| llama3.3-70b | 4.5% | 3/4 | 0/120 | 4.5 | 6/8 | 17.4 | 15/16 | 1.1 |
| llama3.1-8b | 9.6% | 1/4 | 20/120 | 2.1 | 4/8 | 3.0 | 13/16 | 1.2 |

For comparison, the deterministic optimiser (`evals.backtest --weeks 16`) loses 0.5-4.5% (`marginal_sql`) and
1.7-3.0% (`marginal_sql_v3`, 3/4 traps).

### What we conclude (and what we can say on stage)

- **Allocation belongs in the optimiser, not the prompt.** No model/prompt beat the deterministic marginal-cost-per-SQL
  optimiser on regret, so numbers and allocations come from tools; the LLM explains, escalates and talks to the CEO.
- **Right-sized models per task**, measured, not guessed:
  - *Triage / injection screening* (high volume): **Haiku 4.5**: 16/16 like Opus and Sonnet, 2.5-3x faster. Llama 3.1 8B
    missed 3 of 16 injections: not safe for this job.
  - *Channel analysis* (many calls per review): **Haiku 4.5**: 8/8 like the larger models at 2-3x lower latency.
  - *CMO orchestration* (few calls, high stakes): **Sonnet 4.5**: Opus 4.5 was not better on this eval and 3x slower.
    Small models are disqualified: Llama 3.1 8B asked to break the autonomy limit 20 times in 120 decisions.
- **Prompts are gated by evals.** v3 is kept for its compliance gain, but the claim is "zero limit violations", not
  "better decisions".

## How it works

| Piece | What it does |
|---|---|
| `world.py` | Fits each channel to the repo's own curve `SQLs = S × (spend/X)^b` from `CORE.CHANNEL_SUMMARY`. Noise is resampled from real weekly SQL series in `FUNNEL_FACT`; billboard lag (8 weeks) is measured from its first spend to its first SQL. Cached to `world_cache.json`. |
| Scenarios | `baseline`, `competitor_shock` (Google 40% worse from week 6), `linkedin_trap` (cheapest MQLs, 1% become SQLs), `billboard_lag` (best channel, results 8 weeks late, launched at the start), `creative_fatigue` (Google decays 4% a week). |
| `backtest.py` | Walk-forward: 8 weeks of status-quo history, then each week the policy sees only the past and decides; the world plays it forward with lag, carryover and noise. Regret = oracle's expected SQLs − the policy's expected SQLs (true curves, no noise). |
| Policies | `status_quo`, `equal`, `cheap_mqls` (the dashboard trap), `marginal_sql` (v1: mirrors `PROPOSE_REALLOCATION`), `marginal_sql_v2` (6-week window, lag-aware), `marginal_sql_v3` (smoothed, lag-aware, deadband), `agent` (live `CORE.CMO_AGENT` with an as-of context pack, JSON allocation). All but `equal` respect the 10%/week autonomy limit. |
| `traps.py` | The trap ledger: four mistakes, each a world plus a check on the weekly trace. Passes only on every seed. Add one for every failure you find. |
| `store.py` | Writes runs to `CMO_DB.EVALS.EVAL_RUNS` (creates only the `EVALS` schema). |

## Results (`harness-v1`, 26 weeks, seeds 1-3)

Decision regret vs the oracle (lower is better); traps must pass on all seeds.

| Policy | baseline | competitor | linkedin trap | billboard lag | fatigue | linkedin-mql | patience | competitor | overreaction |
|---|---|---|---|---|---|---|---|---|---|
| status_quo | 5.0% | 2.8% | 5.0% | 5.9% | 2.8% | PASS | PASS | FAIL | PASS |
| equal | 29.4% | 23.1% | 29.4% | 21.2% | 21.8% | FAIL | PASS | FAIL | FAIL |
| cheap_mqls | 0.6% | 0.5% | 4.1% | 3.4% | 1.0% | FAIL | FAIL | PASS | FAIL |
| marginal_sql (v1) | 0.6% | 0.5% | 0.6% | 3.4% | 1.0% | PASS | FAIL | PASS | FAIL |
| marginal_sql_v2 | 2.1% | 2.4% | 2.1% | 2.9% | 2.4% | PASS | PASS | FAIL | FAIL |
| marginal_sql_v3 | 2.4% | 1.5% | 2.4% | 1.6% | 1.5% | PASS | PASS | FAIL | PASS |

What this says:
- **The repo's logic (v1) avoids the LinkedIn trap but kills billboards before their results can arrive** (a channel with no SQLs yet gets no money) and chases noise: up to 8 direction reversals per channel when nothing has changed.
- **No policy passes all four traps.** Reacting fast to a competitor and ignoring noise pull in opposite directions; v2 reacts but overreacts, v3 is calm and patient but too slow for the shock. That tension is the real problem, and the ledger makes it measurable.
- The cheap-MQL trap only costs money when channels convert MQLs differently; in the live data they all use the same 15% estimate, so `cheap_mqls` equals v1 outside `linkedin_trap`.

## For the pitch

> "Marketing has no answer key, so we built one from our own Snowflake data: a world where we know the right
> answer, replayed week by week. Every version of the CMO is scored on how many qualified leads it leaves on the
> table, and on a ledger of traps it must never fall into again. Today the shipped logic passes two of four.
> We know exactly which two it fails, and why."

## Limits (say them before a judge does)

- The live export has no weekly spend history for Google or LinkedIn and estimates SQLs as MQLs × 15%, so curves are fitted at one operating point per channel with the repo's assumed exponent (0.52), not estimated per channel.
- Conferences have SQLs but no spend; their cost is imputed at $1,714/SQL from the seed's PRD table (flagged `imputed` in the cache).
- Weekly noise comes from only 15 real weeks (Outbound, Billboards) and is large (CV 0.73).
- Regret is steady-state: it judges the allocation, not the timing of lagged results; realised SQLs show the timing.
- The live agent ran one smoke decision (13 s, valid allocation, moved exactly the 10% limit); a full agent backtest has not been run.
- The sweep evaluates the decision step through `COMPLETE`, not the full Cortex Agent with tools; 3 seeds, 8 decisions per
  world, so differences under ~1-2 points of regret are noise. Latency is from one account at one time of day.
- The analysis and triage sets are small (8 and 16 cases); they separate tiers, they don't rank close models.
