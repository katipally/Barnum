// Sample-company 2027 plan: a simulated CMO run over the company's own channels. No model call, no network.
import type { Action, CampaignDraft, CaseData, CaseId, Plan2027Load, PlanChannel, PlanEvent, PlanInputs, PlanKind, PlanTargets, PlanTotals, PlanVerdict, SavedPlan } from "@/lib/types";
import { money } from "@/lib/format";
import { HttpError } from "./errors";
import type { Plan2027Provider } from "./provider";

export const DEFAULT_PLAN_INPUTS: PlanInputs = { budget_usd: 1_000_000, revenue_target_usd: 5_000_000, sqls_per_quarter: 60, brand_pct: 0.1 };

const SAMPLE_MODEL = "Sample planner (simulated, no AI model)";
const SQL_RATE = 0.08;
const WIN_RATE = 0.2;
const ACV_USD = 25_000;
const TEST_SHARE = 0.02;
const STEP_MS = 450;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// One entry per channel; the sample data lists several actions per channel.
interface Group {
  id: string;
  name: string;
  kind: PlanKind;
  annualSpend: number;
  cost: number | null;
  label: string;
}

function groupChannels(data: CaseData): Group[] {
  const annual = 52 / Math.max(1, data.case.weeksInPeriod);
  const byName = new Map<string, Action[]>();
  for (const a of data.actions) byName.set(a.channel, [...(byName.get(a.channel) ?? []), a]);
  return [...byName].map(([name, acts]) => {
    const spent = acts.reduce((s, a) => s + (a.spent ?? 0), 0);
    const results = acts.reduce((s, a) => s + (a.results ?? 0), 0);
    const planned = acts.every((a) => a.status === "planned") || spent === 0;
    const kind: PlanKind = planned ? "unpriced" : acts.some((a) => a.funnelStage === "awareness") ? "brand" : "performance";
    return {
      id: slug(name),
      name,
      kind,
      annualSpend: acts.reduce((s, a) => s + a.budget, 0) * annual,
      cost: results > 0 ? spent / results : null,
      label: acts[0].resultLabel,
    };
  });
}

function planChannels(groups: Group[], inputs: PlanInputs): PlanChannel[] {
  const tests = groups.filter((g) => g.kind === "unpriced");
  const brand = groups.filter((g) => g.kind === "brand");
  const perf = groups.filter((g) => g.kind === "performance");
  const testEach = inputs.budget_usd * TEST_SHARE;
  const brandPool = brand.length ? inputs.budget_usd * inputs.brand_pct : 0;
  const perfPool = Math.max(0, inputs.budget_usd - brandPool - testEach * tests.length);
  const costs = perf.flatMap((g) => (g.cost ? [g.cost] : []));
  const avgCost = costs.length ? costs.reduce((s, c) => s + c, 0) / costs.length : 1;
  const weight = (g: Group) => g.annualSpend * (g.cost ? Math.sqrt(avgCost / g.cost) : 1);
  const weights = (set: Group[]) => {
    const total = set.reduce((s, g) => s + weight(g), 0) || 1;
    return (g: Group) => weight(g) / total;
  };
  const perfW = weights(perf);
  const brandW = weights(brand);
  return groups.map((g) => {
    const budget = g.kind === "unpriced" ? testEach : g.kind === "brand" ? brandPool * brandW(g) : perfPool * perfW(g);
    const saturation = g.annualSpend > 0 && budget > g.annualSpend ? (g.annualSpend / budget) ** 0.35 : 1;
    const units = g.cost ? (budget / g.cost) * saturation : null; // leads (or brand units) per year
    const sqlsYear = g.kind === "performance" && units !== null ? units * SQL_RATE : null;
    return {
      channel_id: g.id,
      display_name: g.name,
      kind: g.kind,
      budget_usd: budget,
      share: budget / inputs.budget_usd,
      current_annual_spend_usd: Math.round(g.annualSpend),
      current_cost_per_sql: g.kind === "performance" && g.cost ? g.cost / SQL_RATE : null,
      projected_sqls_per_quarter: sqlsYear === null ? null : sqlsYear / 4,
      projected_customers: sqlsYear === null ? null : sqlsYear * WIN_RATE,
      plan_cost_per_sql: sqlsYear ? budget / sqlsYear : null,
      projected_native: g.kind === "brand" && units !== null ? { [g.label]: Math.round(units) } : null,
      estimated: true,
      basis_note: g.cost ? `Sample estimate from the sample data, ${money(g.cost)} per ${g.label}.` : "Sample estimate. No results measured yet.",
    };
  });
}

function totalsAndTargets(channels: PlanChannel[], inputs: PlanInputs): { totals: PlanTotals; targets: PlanTargets } {
  const allocated = channels.reduce((s, c) => s + c.budget_usd, 0);
  const sqls = channels.reduce((s, c) => s + (c.projected_sqls_per_quarter ?? 0), 0);
  const customers = channels.reduce((s, c) => s + (c.projected_customers ?? 0), 0);
  const arr = customers * ACV_USD;
  const ratio = Math.max(inputs.revenue_target_usd / (arr || 1), inputs.sqls_per_quarter / (sqls || 1));
  const met = ratio <= 1;
  const needed = sqls > 0 && ratio < 8 ? Math.round(inputs.budget_usd * ratio ** 1.5) : null;
  return {
    totals: {
      budget_usd: inputs.budget_usd,
      allocated_usd: allocated,
      unallocated_usd: Math.max(0, Math.round(inputs.budget_usd - allocated)),
      projected_sqls_per_quarter: sqls,
      projected_customers: customers,
      projected_new_arr_usd: arr,
    },
    targets: {
      revenue: { target_usd: inputs.revenue_target_usd, projected_usd: arr, gap_usd: arr - inputs.revenue_target_usd, met: arr >= inputs.revenue_target_usd },
      sqls_per_quarter: { target: inputs.sqls_per_quarter, projected: sqls, gap: sqls - inputs.sqls_per_quarter, met: sqls >= inputs.sqls_per_quarter },
      budget_needed_for_targets_usd: met ? inputs.budget_usd : needed,
      limited_by: !met && needed === null ? "channel capacity in the sample data" : null,
      notes: ["Sample plan: simulated from the sample company's data, not a real forecast."],
    },
  };
}

function judge(c: PlanChannel, g: Group, avgCost: number): { verdict: PlanVerdict; rationale: string; actions: { title: string; detail: string }[]; risk: string } {
  const cur = c.current_annual_spend_usd ?? 0;
  const ratio = cur > 0 ? c.budget_usd / cur : Infinity;
  const verdict: PlanVerdict = c.kind === "unpriced" ? "start" : ratio > 1.15 ? "scale" : ratio < 0.85 ? "cut" : g.cost && g.cost > avgCost * 1.3 ? "optimize" : "maintain";
  const name = c.display_name;
  const rationale = {
    start: `${name} has no measured results yet. A small test budget finds out whether it earns a bigger share.`,
    scale: `${name} returns more per dollar than the average, so it gets more of the 2027 budget (${money(c.budget_usd)} vs ${money(cur)} now).`,
    cut: `${name} costs more per result than the budget can justify, so its share shrinks (${money(c.budget_usd)} vs ${money(cur)} now).`,
    optimize: `${name} costs more per result than the other channels. Keep the spend and fix efficiency first.`,
    maintain: `${name} performs close to plan. Keep the spend steady and watch cost per result.`,
  }[verdict];
  const actions = {
    start: [
      { title: `Launch a 6-week ${name} test`, detail: `Spend up to ${money(c.budget_usd)} on two audiences and one offer each.` },
      { title: "Set a stop rule", detail: "Pause if cost per result stays above the best channel after week 4." },
    ],
    scale: [
      { title: `Raise ${name} spend in steps`, detail: "Add 20% per month and check that cost per result holds." },
      { title: "Add one new audience", detail: "Fresh targeting keeps returns from fading as spend grows." },
    ],
    cut: [
      { title: `Trim ${name} to the strongest campaigns`, detail: "Pause the bottom third by cost per result first." },
      { title: "Move the freed budget", detail: "Shift it to the channels marked scale." },
    ],
    optimize: [
      { title: "Rework the weakest ads", detail: "Replace the bottom quartile by cost per result with new creative." },
      { title: "Tighten targeting", detail: "Drop audiences that bring leads that never become qualified." },
    ],
    maintain: [{ title: "Keep current campaigns running", detail: "Review cost per result monthly." }],
  }[verdict];
  return { verdict, rationale, actions, risk: "Sample risk note: results come from simulated numbers." };
}

// Kept on globalThis so dev reloads do not drop a plan that campaign drafts point at. Drafts are keyed `${caseId}:${channelId}`.
interface Memory {
  plans: Map<CaseId, SavedPlan>;
  drafts: Map<string, CampaignDraft[]>;
}
const memory: Memory = ((globalThis as { __samplePlans?: Memory }).__samplePlans ??= { plans: new Map(), drafts: new Map() });
const { plans, drafts } = memory;

async function* run(caseId: CaseId, inputs: PlanInputs, getData: () => Promise<CaseData>): AsyncGenerator<PlanEvent> {
  const data = await getData();
  yield { type: "meta", model: SAMPLE_MODEL };
  yield { type: "status", message: "Reading sample channel data" };
  await sleep(STEP_MS);
  const groups = groupChannels(data);
  const channels = planChannels(groups, inputs);
  const { totals, targets } = totalsAndTargets(channels, inputs);
  yield { type: "tool", name: "plan_2027", toolUseId: "plan" };
  await sleep(STEP_MS);
  yield { type: "tool_done", toolUseId: "plan", seconds: 0.4, ok: true };
  yield { type: "plan", inputs, assumptions_used: { acv_usd: ACV_USD, sql_to_won: WIN_RATE, mql_to_sql_rate: SQL_RATE, mql_to_sql_source: "sample", test_budget_usd: inputs.budget_usd * TEST_SHARE }, channels, totals, targets };
  yield { type: "status", message: "Asking each channel agent for its 2027 actions" };

  const costs = groups.flatMap((g) => (g.kind === "performance" && g.cost ? [g.cost] : []));
  const avgCost = costs.length ? costs.reduce((s, c) => s + c, 0) / costs.length : 1;
  const judged: PlanChannel[] = [];
  for (const [i, c] of channels.entries()) {
    const id = `ask-${c.channel_id}`;
    yield { type: "tool", name: "ask_channel", input: { channel_id: c.channel_id }, toolUseId: id };
    await sleep(STEP_MS + (i % 3) * 200);
    const judgment = judge(c, groups[i], avgCost);
    const call = { ...c, ...judgment, agent_recommends_cut: judgment.verdict === "cut" && c.budget_usd > 0, source: "agent" as const };
    judged.push(call);
    yield { type: "tool_done", toolUseId: id, seconds: 0.5 + (i % 3) * 0.2, ok: true };
    yield { type: "channel_plan", ...call };
  }
  yield { type: "targets", ...targets };

  const top = [...judged].sort((a, b) => b.budget_usd - a.budget_usd)[0];
  const text = top
    ? `**Sample plan, not a real forecast.** Of ${money(inputs.budget_usd)}, ${money(totals.allocated_usd)} is allocated across ${judged.length} channels. ${top.display_name} gets the largest share (${money(top.budget_usd)}).\n\nProjected ${Math.round(totals.projected_sqls_per_quarter ?? 0)} SQLs per quarter against a target of ${inputs.sqls_per_quarter}, and ${money(totals.projected_new_arr_usd ?? 0)} of new ARR against ${money(inputs.revenue_target_usd)}.`
    : "No channels to plan.";
  for (const w of text.match(/\S+\s*/g) ?? []) {
    yield { type: "text", text: w };
    await sleep(15);
  }
  const planId = `sample-${Date.now().toString(36)}`;
  plans.set(caseId, { plan_id: planId, created_at: new Date().toISOString(), inputs, totals, targets, channels: judged, summary: text, model: SAMPLE_MODEL });
  yield { type: "done", planId };
}

export const mockPlan2027: Plan2027Provider = {
  async load(caseId): Promise<Plan2027Load> {
    const saved = plans.get(caseId) ?? null;
    return { inputs: saved?.inputs ?? DEFAULT_PLAN_INPUTS, saved, live: false };
  },
  run,
  async draft(caseId, planId, channelId): Promise<CampaignDraft> {
    const plan = plans.get(caseId);
    const channel = plan?.plan_id === planId ? plan.channels.find((c) => c.channel_id === channelId) : undefined;
    if (!plan || !channel) throw new HttpError(404, "Unknown plan or channel");
    const key = `${caseId}:${channelId}`;
    const draft: CampaignDraft = {
      campaign_id: `sample-${Date.now().toString(36)}`,
      plan_id: planId,
      channel_id: channelId,
      status: "draft",
      stub: true,
      created_at: new Date().toISOString(),
      brief: {
        name: `${channel.display_name} 2027 ${channel.verdict === "start" ? "launch" : "optimization"}`,
        objective: channel.rationale ?? `Plan 2027 spend for ${channel.display_name}.`,
        budget_usd: channel.budget_usd,
        kpis: [channel.kind === "brand" ? "Brand reach" : "SQLs per quarter", "Cost per result"],
        steps: channel.actions ?? [],
      },
    };
    drafts.set(key, [draft, ...(drafts.get(key) ?? [])]);
    return draft;
  },
  async campaigns(caseId, channelId) {
    return drafts.get(`${caseId}:${channelId}`) ?? [];
  },
};
