// Pure helpers for "Where the money goes": verdict words, plain result names, one-line explanations.
import type { Action, Contribution, FunnelStage, Guardrails, Verdict } from "@/lib/types";
import type { GlossaryKey } from "@/lib/glossary";
import { money, round } from "@/lib/format";

export const FUNNEL_STAGES: FunnelStage[] = ["awareness", "consideration", "conversion", "retention"];

export const STAGE_LABEL: Record<FunnelStage, string> = {
  awareness: "Awareness",
  consideration: "Consideration",
  conversion: "Conversion",
  retention: "Retention",
};

export const STAGE_TONE: Record<FunnelStage, string> = {
  awareness: "bg-ink/75",
  consideration: "bg-ink/50",
  conversion: "bg-ink/30",
  retention: "bg-ink/15",
};

export const METHOD_LABEL: Record<Contribution["method"], string> = {
  mmm: "statistical model of all spend",
  markov: "customer-journey analysis",
  holdout: "controlled test (some people saw no ads)",
  last_touch: "last click before the sale",
  assumption: "our best guess, not yet measured",
};

export const LOW_CONFIDENCE_METHODS: Contribution["method"][] = ["assumption", "last_touch"];

export const isLessSure = (c: Contribution) => LOW_CONFIDENCE_METHODS.includes(c.method) || c.confidence < 0.5;

export const DEFAULT_MIN_TEST_WEEKS = 3;

export type Focus = { kind: "objective" | "action"; id: string } | null;

export const VERDICT: Record<Verdict, { word: string; text: string; dot: string }> = {
  scale: { word: "Spend more", text: "text-ok", dot: "bg-ok" },
  hold: { word: "Keep as is", text: "text-ink/80", dot: "bg-muted" },
  cut: { word: "Spend less", text: "text-bad", dot: "bg-bad" },
  test: { word: "Still testing", text: "text-info", dot: "bg-info" },
};

type ResultWords = { one: string; many: string; k?: GlossaryKey; explain?: string };

const RESULT_WORDS: Record<string, ResultWords> = {
  sql: { one: "qualified lead", many: "qualified leads", k: "sql" },
  mql: { one: "marketing lead", many: "marketing leads", k: "mql" },
  conversion: { one: "conversion", many: "conversions", k: "conversion" },
  "engaged view": {
    one: "engaged viewer",
    many: "engaged viewers",
    explain: "Someone who watched a real part of the video instead of scrolling past.",
  },
  "incremental household": {
    one: "extra household",
    many: "extra households",
    explain: "A household that bought from us because of this channel and otherwise would not have.",
  },
  "incremental unit": {
    one: "extra unit sold",
    many: "extra units sold",
    explain: "A sale that happened because of this channel and otherwise would not have.",
  },
  "new-to-brand household": {
    one: "first-time household",
    many: "first-time households",
    explain: "A household buying from us for the first time.",
  },
  "paid clinic": { one: "paying clinic", many: "paying clinics" },
  interview: { one: "customer interview", many: "customer interviews" },
  trial: { one: "free trial", many: "free trials" },
};

export function resultWords(label: string): ResultWords {
  return RESULT_WORDS[label.toLowerCase()] ?? { one: label, many: label.endsWith("s") ? label : `${label}s` };
}

// Unit costs need more precision than budgets: "$1,714" and "$1.10" rather than "$1.7k" and "$1".
export function perUnit(v: number): string {
  if (v < 10) return `$${v.toFixed(2)}`;
  if (v < 1e5) return `$${round(v, 0)}`;
  return money(v);
}

const nextCost = (a: Action) => a.marginalCostPerResult ?? a.costPerResult;

export function avgCost(a: Action): number | null {
  if (a.costPerResult != null && a.costPerResult > 0) return a.costPerResult;
  return a.results > 0 ? a.spent / a.results : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function verdictOf(a: Action, minTestWeeks = DEFAULT_MIN_TEST_WEEKS): Verdict {
  if (a.verdict) return a.verdict;
  if (a.status === "planned" || a.weeksRunning < minTestWeeks) return "test";
  return a.results === 0 ? "cut" : "hold";
}

// Live channels that buy the same kind of result, so their costs can be compared fairly.
function peersOf(a: Action, all: Action[]) {
  return all.filter((p) => p.id !== a.id && p.status === "live" && p.resultLabel === a.resultLabel && nextCost(p) != null);
}

function comparison(a: Action, all: Action[]): { r: number; where: string } | null {
  const own = nextCost(a);
  const peers = peersOf(a, all);
  const med = median(peers.map((p) => nextCost(p) as number));
  if (own == null || med == null || med <= 0) return null;
  return { r: own / med, where: peers.length === 1 ? peers[0].label : "similar channels" };
}

function costsSentence(one: string, r: number, where: string): string {
  const head = `The next ${one} here costs`;
  if (r < 0.55) return `${head} less than half what it costs in ${where}.`;
  if (r < 0.9) return `${head} ${Math.round((1 - r) * 100)}% less than in ${where}.`;
  if (r <= 1.1) return `${head} about the same as in ${where}.`;
  if (r < 1.8) return `${head} ${Math.round((r - 1) * 100)}% more than in ${where}.`;
  if (r < 2.5) return `${head} about twice what it costs in ${where}.`;
  return `${head} about ${Math.round(r)} times what it costs in ${where}.`;
}

// One plain line explaining the verdict, built from the channel's own numbers.
export function whySentence(a: Action, all: Action[], minTestWeeks = DEFAULT_MIN_TEST_WEEKS): string {
  const w = resultWords(a.resultLabel);
  const v = verdictOf(a, minTestWeeks);
  if (a.status === "planned") return "Not started yet. I'll judge it once results come in.";
  if (v === "test") return `Only ${a.weeksRunning} week${a.weeksRunning === 1 ? "" : "s"} of data, too early to judge.`;
  if (a.results === 0) return "Money is going out and nothing is coming back yet.";
  const c = comparison(a, all);
  switch (v) {
    case "scale":
      return c && c.r < 0.95 ? costsSentence(w.one, c.r, c.where) : "Results come in cheaper than average, so more money should buy more.";
    case "cut":
      return c && c.r > 1.1 ? costsSentence(w.one, c.r, c.where) : "Each extra dollar here buys less than it would elsewhere.";
    default:
      if (!c) return "Nothing similar to compare it with yet, so I'm keeping it steady.";
      if (c.r > 1.1) return `Costs more per ${w.one} than ${c.where}, but not enough to pull money yet.`;
      if (c.r < 0.9) return `Cheaper per ${w.one} than ${c.where}, but not by enough to move money yet.`;
      return `Costs about the same per ${w.one} as ${c.where}. No reason to change.`;
  }
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const say = (n: number) => NUMBER_WORDS[n] ?? String(n);

// The page's one-sentence answer: spend so far, then which channels deserve more or less.
export function moneyAnswer(actions: Action[], g: Guardrails, minTestWeeks: number): string {
  const spent = g.budgetSpent || actions.reduce((s, a) => s + a.spent, 0);
  const total = g.budgetTotal || actions.reduce((s, a) => s + a.budget, 0);
  const more = actions.filter((a) => verdictOf(a, minTestWeeks) === "scale").length;
  const less = actions.filter((a) => verdictOf(a, minTestWeeks) === "cut").length;
  const head = `${money(spent)} of ${money(total)} spent so far.`;
  if (!more && !less) return `${head} Every channel is earning its keep, so no big moves are needed.`;
  const moreText = more
    ? `${say(more)} channel${more === 1 ? " is" : "s are"} clearly worth more money`
    : "None stands out as worth more money";
  const lessText = less ? `${say(less).toLowerCase()} ${less === 1 ? "is" : "are"} wasting it` : "none is wasting it";
  return `${head} ${moreText}; ${lessText}.`;
}

export function pacingNote(g: Guardrails, week: number, weeks: number): string | null {
  if (!g.budgetTotal || !weeks) return null;
  const pace = g.budgetSpent / (g.budgetTotal * (week / weeks));
  if (!Number.isFinite(pace)) return null;
  if (pace > 1.1) return "Spending faster than planned for this point in the period.";
  if (pace < 0.9) return "Spending slower than planned for this point in the period.";
  return "Spending is on pace for this point in the period.";
}

export function byBudget(actions: Action[]): Action[] {
  return [...actions].sort((x, y) => y.budget - x.budget);
}

// Fallback ranking when the server omits a score: cheaper next results rank higher.
export function scoreOf(a: Action): number {
  if (a.score != null) return a.score;
  const n = nextCost(a);
  return n ? 1 / n : 0;
}

// The single best opportunity and the single biggest leak, for the "where I'd look first" panel.
export function firstLook(actions: Action[], minTestWeeks: number) {
  const ranked = [...actions].sort((x, y) => scoreOf(y) - scoreOf(x));
  return {
    more: ranked.find((a) => verdictOf(a, minTestWeeks) === "scale"),
    less: [...ranked].reverse().find((a) => verdictOf(a, minTestWeeks) === "cut"),
  };
}

export function creditWords(weight: number): string {
  if (weight >= 0.65) return "most of the credit";
  if (weight >= 0.45) return "about half the credit";
  if (weight >= 0.25) return "some of the credit";
  return "a little of the credit";
}
