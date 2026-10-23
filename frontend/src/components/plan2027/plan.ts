import type { PlanChannel, PlanEvent, PlanInputs, PlanKind, PlanTargets, PlanTotals, PlanVerdict, SavedPlan } from "@/lib/types";

export const BUDGET_RANGE = { min: 100_000, max: 10_000_000, step: 50_000 };
export const BRAND_MAX_PCT = 50;
const MIN_BUDGET = 10_000;
const MAX_AMOUNT = 100_000_000_000;

// Text fields stay strings so people can type "1.5M" or "250,000" freely.
export interface InputsDraft {
  budget: string;
  revenue: string;
  sqls: string;
  brandPct: number; // whole percent, 0..BRAND_MAX_PCT
}

export const groupDigits = (n: number) => Math.round(n).toLocaleString("en-US");

export function parseMoney(s: string): number {
  const m = s.replace(/[$,\s]/g, "").match(/^(\d*\.?\d+)([kmb])?$/i);
  if (!m) return NaN;
  return Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1);
}

export const draftFrom = (i: PlanInputs): InputsDraft => ({
  budget: groupDigits(i.budget_usd),
  revenue: groupDigits(i.revenue_target_usd),
  sqls: groupDigits(i.sqls_per_quarter),
  brandPct: Math.min(BRAND_MAX_PCT, Math.round(i.brand_pct * 100)),
});

export const inputsFrom = (d: InputsDraft): PlanInputs => ({
  budget_usd: parseMoney(d.budget),
  revenue_target_usd: parseMoney(d.revenue),
  sqls_per_quarter: Number(d.sqls.replace(/,/g, "")),
  brand_pct: d.brandPct / 100,
});

export function validate(d: InputsDraft): Partial<Record<"budget" | "revenue" | "sqls", string>> {
  const i = inputsFrom(d);
  const e: Partial<Record<"budget" | "revenue" | "sqls", string>> = {};
  if (!(i.budget_usd >= MIN_BUDGET && i.budget_usd <= MAX_AMOUNT)) e.budget = "Enter a budget from $10k up, like 1,000,000 or 1.5M.";
  if (!(i.revenue_target_usd > 0 && i.revenue_target_usd <= MAX_AMOUNT)) e.revenue = "Enter a revenue target above $0, like 5,000,000 or 5M.";
  if (!(Number.isInteger(i.sqls_per_quarter) && i.sqls_per_quarter >= 1)) e.sqls = "Enter a whole number of at least 1.";
  return e;
}

// What the screen shows: the saved plan, or the pieces of a run as they arrive.
export interface PlanView {
  planId?: string;
  createdAt?: string;
  totals?: PlanTotals;
  targets?: PlanTargets;
  channels: PlanChannel[];
  summary: string;
}

export const emptyView: PlanView = { channels: [], summary: "" };

export const fromSaved = (p: SavedPlan): PlanView => ({
  planId: p.plan_id,
  createdAt: p.created_at,
  totals: p.totals,
  targets: p.targets,
  channels: p.channels,
  summary: p.summary,
});

export function applyEvent(v: PlanView, e: PlanEvent): PlanView {
  switch (e.type) {
    case "plan":
      return { ...v, totals: e.totals, targets: e.targets, channels: [...e.channels].sort((a, b) => b.budget_usd - a.budget_usd) };
    case "channel_plan":
      return { ...v, channels: v.channels.some((c) => c.channel_id === e.channel_id) ? v.channels.map((c) => (c.channel_id === e.channel_id ? { ...c, ...e } : c)) : [...v.channels, e] };
    case "targets":
      return { ...v, targets: e };
    case "text":
      return { ...v, summary: v.summary + e.text };
    case "done":
      return e.planId ? { ...v, planId: e.planId, createdAt: new Date().toISOString() } : v;
    default:
      return v;
  }
}

export const KIND_LABEL: Record<PlanKind, string> = { performance: "Performance", brand: "Brand", unpriced: "Test" };

export const VERDICT_STYLE: Record<PlanVerdict, string> = {
  start: "text-accent border-accent/40",
  scale: "text-ok border-ok/40",
  optimize: "text-warn border-warn/40",
  maintain: "text-muted border-line",
  cut: "text-bad border-bad/40",
};

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const pick = (r: Record<string, unknown>, keys: string[], type: "string" | "number") => keys.map((k) => r[k]).find((x) => typeof x === type);

// The contract leaves the brand KPI's shape open: accept a number, a string or {value, label}.
export function nativeText(v: unknown): string | null {
  if (typeof v === "number") return groupDigits(v);
  if (typeof v === "string") return v.trim() || null;
  if (!isRec(v)) return null;
  const value = pick(v, ["value", "projected", "amount"], "number") ?? pick(v, ["value", "projected", "amount"], "string");
  const label = pick(v, ["kpi", "label", "metric", "name", "unit"], "string");
  if (value === undefined) return null;
  return `${typeof value === "number" ? groupDigits(value) : value}${label ? ` ${label}` : ""}`;
}
