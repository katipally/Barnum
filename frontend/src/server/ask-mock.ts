// Keyword-routed, case-aware CMO answers in plain language, streamed word by word. Numbers always cite metric sources.
import type { CaseData, CaseId, CompanyCase, Decision, Metric, Status, TreeNode, Verdict } from "@/lib/types";
import { fmt, money } from "@/lib/format";
import { buildBrief, buildStrategy } from "./brief";
import { forecastMetric, latest, unitCostOf } from "./heuristics";

const MAX_WORDS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Streams text in word-sized chunks with a 15–25 ms cadence. */
export async function* streamWords(text: string): AsyncGenerator<string> {
  for (const chunk of text.match(/\S+\s*/g) ?? []) {
    yield chunk;
    await sleep(15 + Math.random() * 10);
  }
}

export async function* askMock(_caseId: CaseId, question: string, data: CaseData): AsyncGenerator<string> {
  yield* streamWords(composeAnswer(question, data));
}

/** Picks a route from keywords and composes a ≤120-word plain-text answer. */
export function composeAnswer(question: string, data: CaseData): string {
  const q = question.toLowerCase();
  let text: string;
  if (data.case.dataStatus === "awaiting_data") text = awaitingData(q, data);
  else if (/\b(why|explain)\b/.test(q)) text = explainDecision(data);
  else if (/what if|\bcut\b|\bmove\b|\bshift\b|realloc/.test(q)) text = simulateShift(q, data);
  else if (/compet|\bwin\b|winning|rival|share/.test(q)) text = competition(data);
  else if (/brand|awareness/.test(q)) text = brand(data);
  else text = summary(data);
  return limitWords(text, MAX_WORDS);
}

function limitWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  if (words.length <= max) return text;
  const cut = words.slice(0, max).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".)"));
  return end > 0 ? cut.slice(0, end + 1) : `${cut}…`;
}

const stop = (t: string) => t.trim().replace(/[.\s]+$/, "");
const perUnit = (v: number) => (v < 10 ? `$${v.toFixed(2)}` : money(v));
const count = (v: number) => fmt(v, "count");

const STATUS_TEXT: Record<Status, string> = { on_track: "on track", at_risk: "needs attention", off_track: "off track" };
const STATUS_IS: Record<Status, string> = { on_track: "is on track", at_risk: "needs attention", off_track: "is off track" };
const VERDICT_TEXT: Record<Verdict, string> = { scale: "spend more", hold: "keep as is", cut: "spend less", test: "still testing" };

function cite(m: Metric, weeksInPeriod: number): string {
  const f = forecastMetric(m, weeksInPeriod);
  return `${m.label} is ${fmt(latest(m.series), m.unit)}; the target is ${fmt(m.target, m.unit)} and we are heading for ${fmt(f, m.unit)} by the end of the period (from ${m.source})`;
}

function pending(data: CaseData): Decision[] {
  return data.decisions
    .filter((d) => d.status === "pending")
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

const REASON_TEXT: Record<Decision["reason"], string> = {
  above_autonomy: "it moves more money than I may shift on my own in a week",
  new_channel: "it starts spending in a new channel",
  brand_floor: "it touches the budget set aside for brand building",
  objective_change: "it changes a goal you set",
  messaging: "it changes how we talk about the company in public",
};

function explainDecision(data: CaseData): string {
  const top = pending(data)[0];
  if (!top) {
    const worst = buildBrief(data).scorecard.find((s) => s.status === "off_track");
    if (!worst) return `Nothing is waiting for you this week. ${summary(data)}`;
    return `No decision is waiting for you. The goal furthest behind is “${worst.objective.label}”: ${cite(worst.northStar, data.case.weeksInPeriod)}. ${worst.objective.rationale}`;
  }
  const ev = top.evidence.slice(0, 3).map((e) => `${e.label}: ${e.value} (from ${e.source})`).join("; ");
  return [
    `The decision I need from you is “${top.title}”${top.amount ? ` (${money(top.amount)})` : ""}.`,
    `${stop(top.rationale)}.`,
    ev ? `What I based it on: ${ev}.` : "",
    `What we gain: ${stop(top.impact)}. The risk: ${stop(top.risk)}.`,
    `I need your OK because ${REASON_TEXT[top.reason]}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function parseAmount(q: string): number | null {
  const m = q.match(/\$\s?(\d+(?:[.,]\d+)?)\s?(k|m)?\b|\b(\d+(?:[.,]\d+)?)\s?(k|m)\b/);
  if (!m) return null;
  const n = parseFloat((m[1] ?? m[3]).replace(",", "."));
  const unit = m[2] ?? m[4];
  return unit === "m" ? n * 1e6 : unit === "k" ? n * 1e3 : n;
}

function simulateShift(q: string, data: CaseData): string {
  const live = buildStrategy(data).actions.filter((a) => a.status === "live");
  const named = live.filter((a) => q.includes(a.channel.toLowerCase()) || q.includes(a.label.toLowerCase()));
  const byScore = [...live].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  // Source: named action, else the worst-scoring "cut", else the worst score overall.
  const from = named[0] ?? byScore.find((a) => a.verdict === "cut") ?? byScore[0];
  // Target: named, else a "scale" action counting the same result, else any "scale", else best score.
  const others = [...byScore].reverse().filter((a) => a.id !== from?.id && unitCostOf(a));
  const to =
    named[1] ??
    others.find((a) => a.verdict === "scale" && a.resultLabel === from?.resultLabel) ??
    others.find((a) => a.verdict === "scale") ??
    others[0];
  if (!from || !to) return `I don't have enough channels with cost data yet to work out what moving money would do. ${summary(data)}`;

  const g = data.guardrails;
  const autonomy = (g.budgetTotal * g.autonomyPct) / 100;
  const remaining = Math.max(0, from.budget - from.spent);
  // Default: the larger of one week's autonomy or a quarter of what the source has left, capped at that remainder.
  const wanted = parseAmount(q) ?? Math.max(autonomy, remaining * 0.25);
  const amount = Math.round(remaining > 0 ? Math.min(wanted, remaining) : wanted);
  const fromCost = from.marginalCostPerResult || unitCostOf(from);
  const toCost = (to.marginalCostPerResult || unitCostOf(to))!;
  const lost = fromCost ? amount / fromCost : 0;
  const gained = amount / toCost;
  const sameUnit = from.resultLabel === to.resultLabel;

  const verdict = (v?: Verdict) => (v ? `${VERDICT_TEXT[v]}, ` : "");
  return [
    `Moving ${money(amount)} from ${from.label} (${verdict(from.verdict)}${fromCost ? `${perUnit(fromCost)} per ${from.resultLabel}` : `no ${from.resultLabel}s yet`})`,
    `to ${to.label} (${verdict(to.verdict)}${perUnit(toCost)} per ${to.resultLabel})`,
    `would lose about ${count(lost)} ${from.resultLabel}s and win about ${count(gained)} ${to.resultLabel}s.`,
    sameUnit
      ? `Overall: ${gained - lost >= 0 ? "+" : ""}${count(gained - lost)} ${to.resultLabel}s.`
      : "The two count different things, so compare each against the goal it serves.",
    "Source: each channel's spend and results, using what the next result costs where we know it.",
    "Assumption: the next results cost about the same as the last ones across this amount.",
    amount > autonomy
      ? `That is more than the ${money(autonomy)} a week (${g.autonomyPct}% of budget) I may move on my own, so it needs your OK.`
      : `That is within the ${money(autonomy)} a week (${g.autonomyPct}% of budget) I may move on my own, so I can do it without you.`,
  ].join(" ");
}

function competition(data: CaseData): string {
  const re = /compet|market share|win rate|\bwin\b|rival|share of search|\bvs\b/i;
  const wk = data.case.weeksInPeriod;
  const card = buildBrief(data).scorecard;
  const objs = card.filter((s) => re.test(s.objective.label));
  const rows = (objs.length ? objs : [...card].sort((a, b) => b.objective.priority - a.objective.priority)).slice(0, 2);
  const metrics = data.metrics.filter((m) => re.test(m.label) && !rows.some((r) => r.northStar.id === m.id)).slice(0, 1);
  const parts = rows.map((r) => `“${r.objective.label}” ${STATUS_IS[r.status]}: ${cite(r.northStar, wk)}.`);
  for (const m of metrics) parts.push(`${cite(m, wk)}.`);
  const lead = objs.length ? "How we are doing against competitors:" : "None of our goals targets competitors directly, so here are the closest ones.";
  return `${lead} ${parts.join(" ")} ${rows[0] ? `${stop(rows[0].objective.rationale)}.` : ""}`.trim();
}

function brand(data: CaseData): string {
  const g = data.guardrails;
  const brandBudget = data.actions.filter((a) => a.funnelStage === "awareness" && a.status !== "planned").reduce((s, a) => s + a.budget, 0);
  const share = g.budgetTotal ? (brandBudget / g.budgetTotal) * 100 : 0;
  const rank = (l: string) => (/aware|top-of-mind|recall/i.test(l) ? 0 : /share of search|voice|reach/i.test(l) ? 1 : 2);
  const metrics = data.metrics
    .filter((m) => /brand|aware|top-of-mind|reach|recall|share of search|voice/i.test(m.label))
    .sort((a, b) => rank(a.label) - rank(b.label))
    .slice(0, 2);
  const parts = [
    `You have set aside ${g.brandFloorPct}% of the budget for long-term brand building, and only you can change that.`,
    `Channels that make people aware of us hold ${money(brandBudget)}, ${share.toFixed(1)}% of the ${money(g.budgetTotal)} budget (from channel budgets).`,
    `Assumption: I count only those awareness channels as brand building here, so treat the comparison as rough.`,
    ...metrics.map((m) => `${cite(m, data.case.weeksInPeriod)}.`),
  ];
  if (!metrics.length) parts.push("We do not track a brand measure yet; assumption: more people know us as our reach grows.");
  return parts.join(" ");
}

function summary(data: CaseData): string {
  const brief = buildBrief(data);
  const off = [
    ...brief.goals.filter((g) => g.status !== "on_track").map((g) => `${g.label} (${fmt(g.current, g.unit)} of ${fmt(g.target, g.unit)}, ${STATUS_TEXT[g.status]})`),
    ...brief.scorecard
      .filter((s) => s.status === "off_track")
      .map((s) => `${s.objective.label} (${fmt(latest(s.northStar.series), s.northStar.unit)} against ${fmt(s.northStar.target, s.northStar.unit)}, from ${s.northStar.source})`),
  ].slice(0, 3);
  const dec = pending(data);
  const p = brief.budgetPacing;
  const pace = p > 1.05 ? "faster than planned" : p < 0.95 ? "slower than planned" : "on plan";
  return [
    `Week ${data.case.week} of ${data.case.weeksInPeriod} at ${data.case.name}: ${brief.headline}`,
    off.length ? `Needs attention: ${off.join("; ")}.` : "All goals are on track.",
    `We are spending ${pace}: ${money(data.guardrails.budgetSpent)} of ${money(data.guardrails.budgetTotal)} so far (${p.toFixed(2)}× the planned pace).`,
    dec.length ? `${dec.length} decision${dec.length > 1 ? "s are" : " is"} waiting for you, starting with “${dec[0].title}”.` : "No decisions are waiting for you.",
  ].join(" ");
}

const DATA_NEEDS: Record<CompanyCase["stage"], { sources: string; numbers: string }> = {
  pre_pmf: {
    sources: "product usage, billing, and ad or outreach data",
    numbers: "free trials per week, how many become paying, paying customers, revenue per customer, how many are still active after 60 days by customer type, and spend and sign-ups per channel",
  },
  scale_up: {
    sources: "your sales system (CRM), billing and ad account data",
    numbers: "qualified sales leads per week by source, win rate, average deal size, upsell revenue and revenue lost to cancellations, and spend and leads per channel",
  },
  enterprise: {
    sources: "store sales data, media plans and discount calendars",
    numbers: "households buying us, our share of all households, purchases per buyer, average price, discount depth, and spend and reach per channel",
  },
};

// Lowercases a sentence-case label for mid-sentence use, keeping acronyms ("ARR", "ACV").
const lower = (l: string) => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

function unsetDrivers(node: TreeNode): string[] {
  return (node.children ?? []).flatMap((c) => [...(c.target === 0 ? [c.label] : []), ...unsetDrivers(c)]);
}

/** Answer for a company that has goals and a template tree but no marketing data yet. */
function awaitingData(q: string, data: CaseData): string {
  const c = data.case;
  const need = DATA_NEEDS[c.stage];
  const goal = data.goals[0];
  const g = data.guardrails;
  const children = (data.tree.children ?? []).map((n) => lower(n.label));
  const unset = unsetDrivers(data.tree);
  const known = [
    goal ? `I know your goal: ${goal.label}, ${fmt(goal.current, goal.unit)} today against ${fmt(goal.target, goal.unit)} by ${goal.deadline}.` : "",
    children.length ? `I have broken it down into ${list(children)}${unset.length ? `, but ${unset.length} of these parts have no target yet` : ""}.` : "",
    `Your budget is ${money(g.budgetTotal)} for ${c.periodLabel}, and I may move up to ${g.autonomyPct}% of it a week without asking.`,
  ];
  const needs = [
    `To recommend anything I need ${need.sources}: specifically ${need.numbers}.`,
    "Once that is connected I will set a target for each part, judge each channel and bring you my first decisions.",
  ];
  const asksAboutData = /data|connect|need|source|snowflake|integrat|start|set ?up/.test(q);
  const parts = asksAboutData ? [...needs, ...known] : [...known, ...needs];
  return [`I have no marketing data for ${c.name} yet, so I won't guess at numbers.`, ...parts].filter(Boolean).join(" ");
}
