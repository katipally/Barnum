# 2027 Plan API contract

Backend: `backend/app/main.py`, `orchestrator.py`, `plan.py`, `sql/25_plan_2027.sql`. All money is USD. `null` means not measured or not projectable, never zero.

## POST /plan/2027 (SSE)

Body: `{budget_usd, revenue_target_usd, sqls_per_quarter, brand_pct}`. `budget_usd > 0`, targets `>= 0`, `brand_pct` in `[0, 1]`. Anything else is 422.

Events, in order of arrival:

| Event | Data |
|---|---|
| `meta` | `{model}` |
| `plan` | PLAN_2027 JSON (below), sent as soon as the procedure returns |
| `status` | `{stage, message}` |
| `tool` | `{name, input, tool_use_id}` (CMO agent tool call started; `ask_channel` calls overlap) |
| `tool_done` | `{name, tool_use_id, seconds, ok}` |
| `channel_plan` | one per channel, final: `{channel_id, display_name, kind, budget_usd, share, current_annual_spend_usd, current_cost_per_sql, projected_sqls_per_quarter, projected_customers, projected_native, estimated, beyond_proven_range_usd, exploratory_overflow_usd, basis_note, plan_cost_per_sql, verdict, agent_recommends_cut, rationale, actions: [{title, detail}], risk, source}` |
| `targets` | `targets` block of the plan |
| `cmo_delta` | `{text}` the plan summary |
| `error` | `{message}` (an agent failure still ends in fallback `channel_plan`s and `done`) |
| `done` | `{seconds, model, plan_id}` (`plan_id` is null if saving failed; an `error` precedes it) |

`verdict` is `start|scale|optimize|maintain|cut`. `plan_cost_per_sql` is `budget_usd / (projected_sqls_per_quarter * 4)`, null without SQLs. `agent_recommends_cut` is true when the agent's verdict is `cut` while `budget_usd > 0`; the allocation is not changed. `source` is `agent` or `fallback`. `kind` is `performance|brand|unpriced`.

### PLAN_2027 JSON

```
{inputs: {budget_usd, revenue_target_usd, sqls_per_quarter, brand_pct},
 assumptions_used: {acv_usd, sql_to_won, mql_to_sql_rate, mql_to_sql_source, scale_cap_x, test_budget_usd, test_pct},
 channels: [{channel_id, display_name, kind, budget_usd, share, current_annual_spend_usd,
             current_cost_per_sql | null, projected_sqls_per_quarter, projected_customers, projected_native: {metric: n} | null,
             estimated, beyond_proven_range_usd | null, exploratory_overflow_usd, basis_note}],
 totals: {budget_usd, allocated_usd, unallocated_usd, projected_sqls_per_quarter, projected_customers, projected_new_arr_usd,
          beyond_proven_range_usd, exploratory_overflow_usd},
 targets: {revenue: {target_usd, projected_usd, gap_usd, met, needed_customers, needed_sqls_per_year},
           sqls_per_quarter: {target, projected, gap, met},
           budget_needed_for_targets_usd: number | null,
           limited_by: null | "budget" | "diminishing_returns" | "no_cost_curve",
           notes: [str]}}
```

`projected_native` is `{metric: value}` with numeric values (for example `{"impressions": 4106667}`) for brand channels with a cost curve, else `null`. `gap` and `gap_usd` are positive for a shortfall and `0` when the target is met, never negative.

`budget_needed_for_targets_usd` is null when no budget reaches the targets (`limited_by` says why). `needed_customers` and `needed_sqls_per_year` are additive fields inside `targets.revenue`.

## Allocation rule

The budget `B` drives every channel, and `allocated_usd` equals `B` (to the cent) unless there are no channels. `unallocated_usd` is rounding only.

1. Brand pool: `brand_pct * B`, shared by brand channels pro rata to current annual spend (a channel without spend counts as the average spend-bearing one).
2. Unpriced channels (outcomes, no spend data): `max(PLAN_TEST_BUDGET_USD, PLAN_TEST_PCT * B)` each, together at most half of what is left after brand when performance channels exist. Their SQLs stay at the current run rate; the test buys cost data, not SQLs.
3. Performance channels: the rest, one `PLANNING_STEP_USD` at a time to the channel with the highest marginal SQLs per dollar on `SQLs(y) = S * (y / X)^b`. O((B / step) log C).
4. Beyond `SCALE_CAP_X * X` of a channel's own run rate `X` the curve is extrapolated, not capped. That part is `beyond_proven_range_usd` (null for a channel without a cost curve, 0 inside the proven range).
5. Floor: when the next performance dollar returns fewer than `1 / (ACV_USD * SQL_TO_WON)` SQLs, it returns less than a dollar of ARR. If unpriced channels exist, the remainder of the budget is split evenly among them as `exploratory_overflow_usd` (more tests buy cost data). With no unpriced channels the floor is ignored and performance keeps absorbing spend. With neither performance nor unpriced channels the remainder goes to brand channels.

Monotonic: a larger `B` never lowers the projected SQLs. Totals, targets and `budget_needed_for_targets_usd` are recomputed from the same allocation for every run.

## GET /plan/2027/latest

`{data: {plan_id, created_at, inputs, totals, targets, channels: [channel_plan], summary, model} | null, sql}`. `data` is `null` when no plan is saved or the plan tables are not deployed yet; `GET /campaigns` returns `[]` in the same case.

## POST /campaigns/draft

Body `{plan_id, channel_id}`. Returns `{data: {campaign_id, plan_id, channel_id, created_at, status: "draft", stub: true, brief: {name, objective, budget_usd, kpis: [str], steps: [{title, detail}]}}}`. 404 for an unknown plan or channel. Nothing is sent to an ad platform.

## GET /campaigns?channel_id=

`{data: [draft, ...], sql}`, newest first; `channel_id` is optional.

## Inputs

Seeded in `ASSUMPTIONS` (insert only, editable with `PUT /assumptions/{key}`): `PLAN_2027_BUDGET_USD` 1000000, `REVENUE_TARGET_USD` 5000000, `SQL_TARGET_PER_QUARTER` 60, `BRAND_PCT` 0.1. Also `PLAN_TEST_BUDGET_USD` 20000 (minimum per unpriced channel), `PLAN_TEST_PCT` 0.03 and `PLAN_AWARENESS_METRICS` (text list).
