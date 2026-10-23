// Pure evaluation heuristics: forecasts, status, verdicts, scores. No I/O.
import type {
  Action,
  BusinessGoal,
  CaseData,
  CompanyCase,
  Contribution,
  GoalScore,
  Guardrails,
  MarketingObjective,
  Metric,
  MetricPoint,
  ObjectiveScore,
  Status,
  TreeNode,
  Unit,
  Verdict,
} from "@/lib/types";

const STATUS_RANK: Record<Status, number> = { on_track: 0, at_risk: 1, off_track: 2 };
const MAX_RATIO = 9.99; // keeps attainment finite (JSON-safe) when dividing by ~0

/** Worst (most severe) status of a list; on_track when empty. */
export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), "on_track");
}

/** True when a series never decreases (i.e. it is a running total). */
export function isCumulative(series: MetricPoint[]): boolean {
  if (series.length < 2) return false;
  for (let i = 1; i < series.length; i++) if (series[i].value < series[i - 1].value) return false;
  return true;
}

/** Least-squares slope per week over the last `n` points (0 when fewer than 2). */
export function slope(series: MetricPoint[], n = 4): number {
  const pts = series.slice(-n);
  if (pts.length < 2) return 0;
  const mx = pts.reduce((s, p) => s + p.week, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.week - mx) * (p.value - my);
    den += (p.week - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Latest value of a series (0 when empty). */
export function latest(series: MetricPoint[]): number {
  return series.length ? series[series.length - 1].value : 0;
}

function clampForUnit(v: number, unit: Unit): number {
  if (unit === "pct") return Math.min(100, Math.max(0, v));
  if (unit === "pts") return v; // pts may legitimately go negative (e.g. share change)
  return Math.max(0, v);
}

/** True for metrics forecast by run-rate: lagging usd/count totals with a non-decreasing series. */
export function isRunRateMetric(m: Pick<Metric, "unit" | "lagging" | "series">): boolean {
  return (m.unit === "usd" || m.unit === "count") && m.lagging && isCumulative(m.series);
}

/**
 * End-of-period forecast for a metric. Cumulative lagging totals use run-rate
 * (latest / week × weeksInPeriod); everything else uses latest + half the 4-point slope × remaining
 * weeks, since rates rarely keep improving linearly.
 */
export function forecastMetric(m: Metric, weeksInPeriod: number): number {
  if (!m.series.length) return 0;
  const last = m.series[m.series.length - 1];
  if (isRunRateMetric(m) && last.week > 0) return (last.value / last.week) * weeksInPeriod;
  const remaining = Math.max(0, weeksInPeriod - last.week);
  return clampForUnit(last.value + 0.5 * slope(m.series) * remaining, m.unit);
}

/** Direction-aware ratio: value/target when higher is better, target/value when lower is better. */
export function attainment(value: number, target: number, direction: "up" | "down"): number {
  let r: number;
  if (direction === "up") r = target === 0 ? (value >= 0 ? 1 : 0) : value / target;
  else r = value <= 0 ? (target > 0 ? MAX_RATIO : 1) : target / value;
  return Math.min(MAX_RATIO, Math.max(0, r));
}

/** Status from a direction-aware ratio: ≥1 on track, ≥0.9 at risk, else off track. */
export function statusFromRatio(r: number): Status {
  if (r >= 1) return "on_track";
  if (r >= 0.9) return "at_risk";
  return "off_track";
}

/** Raw direction of travel over the last 4 points (|slope| < 1% of latest per week is flat). */
export function trendOf(series: MetricPoint[]): "up" | "down" | "flat" {
  const s = slope(series);
  const scale = Math.max(Math.abs(latest(series)), 1e-9);
  if (Math.abs(s) / scale < 0.01) return "flat";
  return s > 0 ? "up" : "down";
}

/** Guess whether lower is better for a tree node: months, churn, cost, CAC, burn, payback (runway is up). */
export function treeDirection(node: Pick<TreeNode, "label" | "unit">): "up" | "down" {
  const l = node.label.toLowerCase();
  if (l.includes("runway")) return "up";
  if (node.unit === "months" || /churn|cost|cac|burn|payback|discount/.test(l)) return "down";
  return "up";
}

/** Copy of the tree with `status` from forecast vs target; nodes with target 0 (not set yet) get no status. */
export function scoreTree(node: TreeNode): TreeNode {
  const { status: _drop, ...rest } = node;
  void _drop;
  return {
    ...rest,
    ...(node.target === 0 ? {} : { status: statusFromRatio(attainment(node.forecast, node.target, treeDirection(node))) }),
    children: node.children?.map(scoreTree),
  };
}

/** Finds a tree node by id (depth-first). */
export function findNode(node: TreeNode, id: string): TreeNode | undefined {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Revenue-like goals accumulate over the period, so they are judged against time elapsed (ARR/MRR levels are not). */
export function isPacedGoal(g: BusinessGoal): boolean {
  const l = g.label.toLowerCase();
  const accumulates = g.kind === "revenue" || /this (period|quarter)|to date/.test(l);
  if (!accumulates || g.direction !== "up" || (g.unit !== "usd" && g.unit !== "count")) return false;
  const isLevel = /\b(arr|mrr)\b|run.?rate/.test(l) && !/new|quarter|\bq[1-4]\b|period|to date|ytd/.test(l);
  return !isLevel;
}

/**
 * Goal status. Paced goals compare (current/target) with (week/weeksInPeriod);
 * others compare current with target directly. `attainment` is the raw direction-aware ratio.
 */
export function scoreGoal(g: BusinessGoal, c: Pick<CompanyCase, "week" | "weeksInPeriod">): GoalScore {
  const att = attainment(g.current, g.target, g.direction);
  if (g.target === 0) return { ...g, status: "at_risk", attainment: 0 }; // target not set yet
  const elapsed = c.weeksInPeriod > 0 ? Math.min(1, Math.max(c.week / c.weeksInPeriod, 1e-9)) : 1;
  const judged = isPacedGoal(g) ? att / elapsed : att;
  return { ...g, status: statusFromRatio(judged), attainment: round(att, 3) };
}

/** Objective scorecard row: status from forecast vs target of its north-star metric. */
export function scoreObjective(
  o: MarketingObjective,
  metrics: Metric[],
  weeksInPeriod: number,
): ObjectiveScore | null {
  const ns = metrics.find((m) => m.id === o.northStarMetricId);
  if (!ns) return null;
  const forecast = forecastMetric(ns, weeksInPeriod);
  return {
    objective: o,
    northStar: ns,
    status: ns.target === 0 ? "on_track" : statusFromRatio(attainment(forecast, ns.target, ns.direction)), // no target yet is not a miss
    attainment: round(attainment(latest(ns.series), ns.target, ns.direction), 3),
    forecast: round(forecast, 2),
    trend: trendOf(ns.series),
  };
}

/** Forecast-based attainment of an objective's north star (used to weight under-delivering objectives). */
export function objectiveForecastAttainment(o: MarketingObjective, metrics: Metric[], weeksInPeriod: number): number {
  const ns = metrics.find((m) => m.id === o.northStarMetricId);
  if (!ns) return 1;
  return attainment(forecastMetric(ns, weeksInPeriod), ns.target, ns.direction);
}

/** Median of a list (NaN when empty). */
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Verdict: planned or younger than minTestWeeks → test; no results, or marginal cost > 1.5×
 * the peers' median marginal cost (live actions, same resultLabel) → cut; < 0.9× → scale; else hold.
 * Marginal is compared with marginal: it always sits above the average on a diminishing-returns curve.
 */
export function verdictFor(a: Action, all: Action[], g: Pick<Guardrails, "minTestWeeks">): Verdict {
  if (a.status === "planned" || a.weeksRunning < g.minTestWeeks) return "test";
  if (a.results === 0) return "cut";
  const peers = all
    .filter((p) => p.status === "live" && p.resultLabel === a.resultLabel && (p.marginalCostPerResult ?? p.costPerResult) != null)
    .map((p) => (p.marginalCostPerResult ?? p.costPerResult) as number);
  const med = median(peers.length ? peers : a.costPerResult != null ? [a.costPerResult] : []);
  const marginal = a.marginalCostPerResult ?? a.costPerResult;
  if (marginal == null || !Number.isFinite(med) || med <= 0) return "hold";
  if (marginal > 1.5 * med) return "cut";
  if (marginal < 0.9 * med) return "scale";
  return "hold";
}

/** Cost per result, falling back to spent / results; null when there are no results. */
export function unitCostOf(a: Pick<Action, "costPerResult" | "spent" | "results">): number | null {
  if (a.costPerResult != null && a.costPerResult > 0) return a.costPerResult;
  return a.results && a.spent != null ? a.spent / a.results : null;
}

/**
 * Efficiency vs peers: median cost per result of live actions with the same resultLabel ÷ this
 * action's cost per result (1 = typical, >1 better). Planned or zero-result actions → 0.
 */
export function efficiencyOf(a: Action, all: Action[]): number {
  const own = unitCostOf(a);
  if (a.status === "planned" || !a.results || own == null || own <= 0) return 0;
  const peers = all
    .filter((p) => p.status === "live" && p.resultLabel === a.resultLabel)
    .map(unitCostOf)
    .filter((c): c is number => c != null);
  const med = median(peers.length ? peers : [own]);
  return Number.isFinite(med) ? med / own : 0;
}

/**
 * Value score: round(100 × efficiency × Σ(weight × objective priority × (1 + gap))), where
 * gap = max(0, 1 − objective forecast attainment), so under-delivering objectives count more.
 */
export function scoreAction(
  a: Action,
  all: Action[],
  contributions: Contribution[],
  objectives: MarketingObjective[],
  objectiveAttainment: Record<string, number>,
): number {
  let w = 0;
  for (const c of contributions) {
    if (c.actionId !== a.id) continue;
    const o = objectives.find((x) => x.id === c.objectiveId);
    if (!o) continue;
    const att = objectiveAttainment[o.id] ?? 1;
    w += c.weight * o.priority * (1 + Math.max(0, 1 - att));
  }
  return Math.round(100 * efficiencyOf(a, all) * w);
}

/** Actions with verdict and score filled. */
export function evaluateActions(data: CaseData): Action[] {
  const att: Record<string, number> = {};
  for (const o of data.objectives) att[o.id] = objectiveForecastAttainment(o, data.metrics, data.case.weeksInPeriod);
  return data.actions.map((a) => ({
    ...a,
    verdict: verdictFor(a, data.actions, data.guardrails),
    score: scoreAction(a, data.actions, data.contributions, data.objectives, att),
  }));
}

/** Overall status: worst goal status; an all-green goal set drops to at_risk if any objective slips. */
export function overallStatus(goals: Status[], objectives: Status[]): Status {
  const g = worstStatus(goals);
  if (g !== "on_track") return g;
  return worstStatus(objectives) === "on_track" ? "on_track" : "at_risk";
}

/** Budget pacing: spent / (total × week / weeksInPeriod); 1 = exactly on plan. */
export function budgetPacing(g: Pick<Guardrails, "budgetTotal" | "budgetSpent">, c: Pick<CompanyCase, "week" | "weeksInPeriod">): number {
  const planned = c.weeksInPeriod > 0 ? g.budgetTotal * (c.week / c.weeksInPeriod) : 0;
  return planned > 0 ? round(g.budgetSpent / planned, 3) : 0;
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
