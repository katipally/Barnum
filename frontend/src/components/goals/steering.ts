import { money } from "@/lib/format";
import type { Guardrails, MarketingObjective, Status, SteeringUpdate, Unit, WeeklyBrief } from "@/lib/types";

// Editable copy of the CEO's steering inputs. Goal targets stay strings so half-typed values can be validated.
export interface SteeringDraft {
  goals: Record<string, string>;
  budgetTotal: number;
  autonomyPct: number;
  brandFloorPct: number;
  priorities: Record<string, number>;
}

export type SteeringErrors = Record<string, string>;

// An objective whose priority can be steered; status is missing until its north star has data.
export interface PriorityRow {
  objective: MarketingObjective;
  status?: Status;
}

// Scored objectives when there is data, otherwise the bare objectives (e.g. a company awaiting data).
export function priorityRows(b: WeeklyBrief, fallback: MarketingObjective[]): PriorityRow[] {
  return b.scorecard.length ? b.scorecard.map((s) => ({ objective: s.objective, status: s.status })) : fallback.map((objective) => ({ objective }));
}

export const LIMITS = {
  autonomyPct: { min: 0, max: 20, step: 1 },
  brandFloorPct: { min: 0, max: 80, step: 1 },
  priority: { min: 0, max: 1, step: 0.05 },
} as const;

export const UNIT_HINT: Record<Unit, string> = {
  usd: "USD",
  pct: "%",
  count: "count",
  months: "months",
  ratio: "×",
  pts: "points",
  weeks: "weeks",
};

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function draftFromBrief(b: WeeklyBrief, rows: PriorityRow[]): SteeringDraft {
  return {
    goals: Object.fromEntries(b.goals.map((g) => [g.id, String(g.target)])),
    budgetTotal: b.guardrails.budgetTotal,
    autonomyPct: b.guardrails.autonomyPct,
    brandFloorPct: b.guardrails.brandFloorPct,
    priorities: Object.fromEntries(rows.map((r) => [r.objective.id, r.objective.priority])),
  };
}

// Slider range for the period budget: half to double today's figure, never below what is already spent.
export function budgetRange(g: Guardrails) {
  const base = g.budgetTotal;
  const steps = [100000, 50000, 25000, 10000, 5000, 2500, 1000, 500, 100, 1];
  const step = steps.find((s) => s <= base / 50 && base % s === 0) ?? 1;
  const low = Math.max(g.budgetSpent, base * 0.5);
  return {
    min: base - Math.floor((base - low) / step) * step,
    max: base * 2,
    step,
  };
}

export function validate(d: SteeringDraft, b: WeeklyBrief): SteeringErrors {
  const e: SteeringErrors = {};
  for (const g of b.goals) {
    if (g.setBy === "board") continue;
    const raw = d.goals[g.id]?.trim() ?? "";
    const v = Number(raw);
    if (raw === "") e[`goal:${g.id}`] = "Enter a target.";
    else if (!Number.isFinite(v)) e[`goal:${g.id}`] = "Enter a number.";
    else if (v < 0) e[`goal:${g.id}`] = "Targets cannot be negative.";
    else if (g.unit === "pct" && v > 100) e[`goal:${g.id}`] = "Percentages go up to 100.";
    else if (g.direction === "up" && v === 0) e[`goal:${g.id}`] = "A zero target gives me nothing to aim for.";
  }
  const spent = b.guardrails.budgetSpent;
  if (!(d.budgetTotal >= 0)) e.budgetTotal = "Budget cannot be negative.";
  else if (d.budgetTotal < spent) e.budgetTotal = `Budget cannot be lower than the ${money(spent)} already spent.`;
  if (d.autonomyPct < LIMITS.autonomyPct.min || d.autonomyPct > LIMITS.autonomyPct.max)
    e.autonomyPct = `Choose between 0 and ${LIMITS.autonomyPct.max}%.`;
  if (d.brandFloorPct < LIMITS.brandFloorPct.min || d.brandFloorPct > LIMITS.brandFloorPct.max)
    e.brandFloorPct = `Choose between 0 and ${LIMITS.brandFloorPct.max}%.`;
  const ps = Object.values(d.priorities);
  if (ps.length > 0 && ps.every((p) => p === 0)) e.priorities = "Give at least one aim some weight.";
  return e;
}

// Only the fields that differ from the saved brief.
export function buildUpdate(d: SteeringDraft, b: WeeklyBrief, rows: PriorityRow[]): SteeringUpdate {
  const u: SteeringUpdate = {};
  const goals = b.goals
    .filter((g) => g.setBy !== "board")
    .map((g) => ({ id: g.id, target: Number(d.goals[g.id]), was: g.target }))
    .filter((x) => Number.isFinite(x.target) && !same(x.target, x.was))
    .map(({ id, target }) => ({ id, target }));
  if (goals.length) u.goals = goals;

  const gr: NonNullable<SteeringUpdate["guardrails"]> = {};
  if (!same(d.budgetTotal, b.guardrails.budgetTotal)) gr.budgetTotal = d.budgetTotal;
  if (!same(d.autonomyPct, b.guardrails.autonomyPct)) gr.autonomyPct = d.autonomyPct;
  if (!same(d.brandFloorPct, b.guardrails.brandFloorPct)) gr.brandFloorPct = d.brandFloorPct;
  if (Object.keys(gr).length) u.guardrails = gr;

  const priorities = rows
    .filter(({ objective: o }) => !same(d.priorities[o.id] ?? o.priority, o.priority))
    .map(({ objective: o }) => ({ id: o.id, priority: d.priorities[o.id] }));
  if (priorities.length) u.objectivePriorities = priorities;
  return u;
}

export function countChanges(u: SteeringUpdate) {
  return (u.goals?.length ?? 0) + Object.keys(u.guardrails ?? {}).length + (u.objectivePriorities?.length ?? 0);
}
