import type { CompanyCase, CompanyInput } from "@/lib/types";

// Form state, defaults and validation for adding a company. Inputs stay strings until submit.

export type Stage = CompanyCase["stage"];
export type GoalUnit = "usd" | "count" | "pct";

export interface FormValues {
  name: string;
  website: string;
  tagline: string;
  industry: string;
  stage: Stage | "";
  goalLabel: string;
  unit: GoalUnit;
  current: string;
  target: string;
  deadline: string; // yyyy-mm-dd
  periodLabel: string;
  weeksInPeriod: string;
  week: string;
  budget: string;
  autonomyPct: number;
}

export type FieldName = keyof FormValues;
export type FormErrors = Partial<Record<FieldName, string>>;

export const STAGES: { id: Stage; label: string; promise: string; goalLabel: string }[] = [
  {
    id: "pre_pmf",
    label: "Early startup",
    promise: "Still finding the customers who love the product. I spend small amounts to learn what works.",
    goalLabel: "Monthly recurring revenue (MRR)",
  },
  {
    id: "scale_up",
    label: "Growing company",
    promise: "Customers love it. I help you win the market without burning cash.",
    goalLabel: "New yearly revenue (net new ARR)",
  },
  {
    id: "enterprise",
    label: "Established brand",
    promise: "Already well known. I grow sales by reaching new buyers, not by discounting.",
    goalLabel: "Net revenue",
  },
];

export const UNITS: { id: GoalUnit; label: string }[] = [
  { id: "usd", label: "Dollars" },
  { id: "count", label: "A number (e.g. customers)" },
  { id: "pct", label: "Percent" },
];

export const INDUSTRIES = ["B2B software", "Consumer goods", "E-commerce", "Fintech", "Healthcare", "Marketplace", "Media"];

export const AUTONOMY_MAX = 20;

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return isoDate(new Date());
}

// Defaults to the current quarter: label, current week and the quarter's last day as deadline.
export function initialValues(now = new Date()): FormValues {
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  const week = Math.min(13, Math.floor((now.getTime() - start.getTime()) / (7 * 864e5)) + 1);
  return {
    name: "",
    website: "",
    tagline: "",
    industry: "",
    stage: "",
    goalLabel: "",
    unit: "usd",
    current: "",
    target: "",
    deadline: isoDate(end),
    periodLabel: `Q${q + 1} ${now.getFullYear()}`,
    weeksInPeriod: "13",
    week: String(week),
    budget: "",
    autonomyPct: 5,
  };
}

// Accepts plain numbers with separators ("50,000", "$1,200"); NaN when not a number.
export function parseNumber(s: string): number {
  const t = s.replace(/[\s,$%]/g, "");
  return t === "" ? NaN : Number(t);
}

function numberError(s: string, label: string): string | undefined {
  if (s.trim() === "") return `Enter ${label}`;
  const n = parseNumber(s);
  if (!Number.isFinite(n)) return "Enter a number";
  if (n < 0) return "Must be 0 or more";
}

function intError(s: string, min: number, max: number): string | undefined {
  const n = parseNumber(s);
  if (!Number.isInteger(n)) return "Enter a whole number";
  if (n < min || n > max) return `Between ${min} and ${max}`;
}

export function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) e.name = "Enter the company name";
  if (v.website.trim() && !/^(https?:\/\/)?[^\s.]+\.[^\s]+$/.test(v.website.trim())) e.website = "Enter a web address like example.com";
  if (!v.tagline.trim()) e.tagline = "Describe what you sell in one line";
  if (!v.industry.trim()) e.industry = "Enter an industry";
  if (!v.stage) e.stage = "Pick the one that fits best";
  if (!v.goalLabel.trim()) e.goalLabel = "Name the goal";
  e.current = numberError(v.current, "the current value");
  e.target = numberError(v.target, "a target");
  if (!e.current && !e.target && parseNumber(v.current) === parseNumber(v.target)) e.target = "Target must differ from the current value";
  if (!v.deadline) e.deadline = "Pick a deadline";
  else if (v.deadline <= todayIso()) e.deadline = "Deadline must be in the future";
  if (!v.periodLabel.trim()) e.periodLabel = "Name the period";
  e.weeksInPeriod = intError(v.weeksInPeriod, 1, 104);
  if (!e.weeksInPeriod) e.week = intError(v.week, 1, parseNumber(v.weeksInPeriod));
  e.budget = numberError(v.budget, "a budget");
  if (v.autonomyPct < 0 || v.autonomyPct > AUTONOMY_MAX) e.autonomyPct = `Between 0 and ${AUTONOMY_MAX}%`;
  for (const k of Object.keys(e) as FieldName[]) if (!e[k]) delete e[k];
  return e;
}

export function toInput(v: FormValues): CompanyInput {
  const website = v.website.trim();
  return {
    name: v.name.trim(),
    ...(website ? { website } : {}),
    tagline: v.tagline.trim(),
    industry: v.industry.trim(),
    stage: v.stage as Stage,
    periodLabel: v.periodLabel.trim(),
    weeksInPeriod: parseNumber(v.weeksInPeriod),
    week: parseNumber(v.week),
    topGoal: {
      label: v.goalLabel.trim(),
      unit: v.unit,
      current: parseNumber(v.current),
      target: parseNumber(v.target),
      deadline: v.deadline,
    },
    budgetTotal: parseNumber(v.budget),
    autonomyPct: v.autonomyPct,
  };
}

// api.ts throws "<status> <body>"; show the server's { error } text when there is one.
export function apiErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const body = raw.replace(/^\d{3}\s*/, "");
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {}
  return body && body.length < 200 ? body : "Something went wrong. Please try again.";
}
