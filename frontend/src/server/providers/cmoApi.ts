// Live company backed by the CMO-Agent FastAPI (Snowflake CMO_DB). Samples still come from seeds.
// Env: CMO_API_URL (e.g. http://localhost:8000), CMO_API_COMPANY_ID, CMO_API_COMPANY_NAME.
import type {
  Action,
  AgentLogEntry,
  AskEvent,
  CaseData,
  CaseId,
  CaseSummary,
  Change,
  Contribution,
  Decision,
  Metric,
  TreeNode,
} from "@/lib/types";
import { money } from "@/lib/format";
import type { CmoProvider } from "../provider";
import { mockProvider } from "./mock";

const base = () => (process.env.CMO_API_URL ?? "").replace(/\/$/, "");
export const LIVE_ID = process.env.CMO_API_COMPANY_ID ?? "snowflake";
const LIVE_NAME = process.env.CMO_API_COMPANY_NAME ?? "Your company";
const SOURCE = "Snowflake: CMO_DB.CORE";

type Num = number | null;
interface Strip {
  measured_spend_usd: Num; annual_run_rate_usd: Num; plan_budget_usd: Num; plan_projected_sqls: Num;
  mqls: Num; sqls: Num; cost_per_mql: Num; cost_per_sql: Num; cac_full_usd: Num; payback_months: Num;
  mql_to_sql_rate: Num; sqls_estimated: boolean | null; channels_without_spend: string[] | null;
}
interface Channel {
  channel_id: string; display_name: string; spend_usd: Num; plan_usd: Num; mqls: Num; sqls: Num;
  sqls_estimated: boolean | null; cost_per_mql: Num; cost_per_sql: Num; mql_to_sql: Num; marginal_cost_per_sql: Num;
}
interface Memo {
  memo_id: string; created_at: string; title: string; finding: string; recommendation: string; status: string;
  decided_at?: string | null;
  deltas: Record<string, { current_usd: number; recommended_usd: number; delta_usd: number; sqls_before: number; sqls_after: number }>;
  impact: { budget_usd?: number | null; run_rate_usd?: number | null; moved_usd?: number; sqls_before?: number; sqls_after?: number; sql_gain?: number; autonomy_limit_usd?: number; estimated_channels?: string[] | null };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`CMO API ${path}: ${res.status} ${await res.text()}`);
  const body = await res.json();
  // Deterministic routes wrap their result as { data, sql }.
  return (body && typeof body === "object" && !Array.isArray(body) && "data" in body && "sql" in body ? body.data : body) as T;
}

type AssumptionRow = { key: string; num: number | null; txt: string | null };
const assumptionMap = (rows: AssumptionRow[]): Record<string, unknown> =>
  Object.fromEntries(rows.map((r) => [r.key, r.num ?? r.txt]));

const n = (v: Num | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const num = (a: Record<string, unknown>, k: string, d = 0) => (typeof a[k] === "number" ? (a[k] as number) : d);

// Funnel stage by channel kind; unknown channels count as consideration.
function stageOf(id: string): Action["funnelStage"] {
  if (/billboard|ooh|tv|radio|podcast|display|youtube|seo|geo/.test(id)) return "awareness";
  if (/google|search|retarget|outbound/.test(id)) return "conversion";
  return "consideration";
}

function period(a: Record<string, unknown>) {
  const text = String(a.PERIOD ?? "").trim();
  const months = Number(/^NEXT_(\d+)M$/i.exec(text)?.[1]);
  const readable = text.replace(/_/g, " ").toLowerCase();
  const label = months ? `Next ${months} month${months === 1 ? "" : "s"}` : readable ? readable[0].toUpperCase() + readable.slice(1) : "Current plan";
  const start = new Date(String(a.PERIOD_START));
  const end = new Date(String(a.PERIOD_END));
  if (end > start) {
    const weeksInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 6048e5));
    const week = Math.min(weeksInPeriod, Math.max(1, Math.ceil((Date.now() - start.getTime()) / 6048e5)));
    return { label, end: end.toISOString().slice(0, 10), weeksInPeriod, week };
  }
  // Forward-looking plan with measured-to-date data: view it as the full period, so run-rate forecasts do not extrapolate.
  const weeksInPeriod = months ? Math.max(1, Math.round((months * 52) / 12)) : 52;
  return { label, end: new Date(Date.now() + weeksInPeriod * 6048e5).toISOString().slice(0, 10), weeksInPeriod, week: weeksInPeriod };
}

function hypothesisOf(c: Channel) {
  if (c.mqls == null || c.sqls == null) return "No lead data for this channel yet, so I cannot judge it.";
  const rate = c.mql_to_sql == null ? "" : ` (${Math.round(c.mql_to_sql * 100)}%${c.sqls_estimated ? ", estimated" : ""})`;
  const spend = c.spend_usd == null ? " No spend is tracked for it." : "";
  return `${Math.round(c.mqls)} marketing leads became ${c.sqls_estimated ? "about " : ""}${Math.round(c.sqls)} qualified leads${rate}.${spend} I judge it on qualified leads, because those turn into revenue.`;
}

export async function fetchLive(): Promise<CaseData> {
  const [a, s, chans, memos] = await Promise.all([
    get<AssumptionRow[]>("/assumptions").then(assumptionMap),
    get<Strip>("/now/strip"),
    get<Channel[]>("/now/channels"),
    get<Memo[]>("/memos"),
  ]);
  const p = period(a);
  const win = num(a, "SQL_TO_WON", 0.15);
  const acv = num(a, "ACV_USD", 120000);
  const sqlTarget = num(a, "SQL_TARGET"); // 0 = not set; add it to ASSUMPTIONS to get a pace
  const paybackTarget = num(a, "PAYBACK_TARGET_MONTHS", 14);
  const sqls = n(s.sqls);
  const sqlsFc = s.plan_projected_sqls ?? sqls;
  const mqls = n(s.mqls);
  const mqlToSql = s.mql_to_sql_rate ?? (mqls ? sqls / mqls : 0);
  const series = (v: Num) => (v == null ? [] : [{ week: p.week, value: v }]);
  const sqlSource = `${SOURCE}.EXEC_STRIP${s.sqls_estimated ? " (partly estimated)" : ""}`;

  const metrics: Metric[] = [
    { id: "m-sqls", label: "Qualified sales leads", unit: "count", target: sqlTarget, direction: "up", lagging: true, source: sqlSource, objectiveId: "o-sqls", series: series(sqls) },
    { id: "m-cps", label: "Cost per qualified lead", unit: "usd", target: num(a, "CPS_TARGET_USD"), direction: "down", lagging: false, source: sqlSource, objectiveId: "o-cps", series: series(s.cost_per_sql) },
    { id: "m-cpm", label: "Cost per marketing lead", unit: "usd", target: 0, direction: "down", lagging: false, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-cps", series: series(s.cost_per_mql) },
    { id: "m-mql2sql", label: "Marketing leads that become qualified", unit: "pct", target: 0, direction: "up", lagging: false, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-sqls", series: series(mqlToSql * 100) },
    { id: "m-payback", label: "Months to earn back a customer's cost", unit: "months", target: paybackTarget, direction: "down", lagging: true, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-payback", series: series(s.payback_months) },
  ];

  const tree: TreeNode = {
    id: "t-arr", label: "Expected new yearly revenue", op: "product", unit: "usd", owner: "ceo",
    target: sqlTarget * win * acv, actual: sqls * win * acv, forecast: sqlsFc * win * acv,
    children: [
      {
        id: "t-sqls", label: "Qualified sales leads (SQLs)", op: "product", unit: "count", owner: "cmo", metricId: "m-sqls",
        target: sqlTarget, actual: sqls, forecast: sqlsFc,
        children: [
          { id: "t-mqls", label: "Marketing leads (MQLs)", unit: "count", owner: "cmo", target: mqlToSql ? sqlTarget / mqlToSql : 0, actual: mqls, forecast: sqls ? mqls * (sqlsFc / sqls) : mqls },
          { id: "t-rate", label: "Share that become qualified", unit: "pct", owner: "sales", metricId: "m-mql2sql", target: 0, actual: mqlToSql * 100, forecast: mqlToSql * 100 },
        ],
      },
      { id: "t-win", label: "Win rate", unit: "pct", owner: "sales", target: win * 100, actual: win * 100, forecast: win * 100 },
      { id: "t-acv", label: "Average deal size", unit: "usd", owner: "sales", target: acv, actual: acv, forecast: acv },
    ],
  };

  const actions: Action[] = chans.map((c) => ({
    id: `ch-${c.channel_id}`,
    label: c.display_name,
    channel: c.display_name,
    funnelStage: stageOf(c.channel_id),
    budget: c.plan_usd ?? c.spend_usd ?? 0,
    spent: c.spend_usd,
    resultLabel: "qualified lead",
    results: c.sqls,
    costPerResult: c.cost_per_sql ?? null,
    marginalCostPerResult: c.marginal_cost_per_sql ?? null,
    weeksRunning: p.week,
    hypothesis: hypothesisOf(c),
    status: "live",
  }));
  const contributions: Contribution[] = actions.flatMap((x) => [
    { actionId: x.id, objectiveId: "o-sqls", weight: 0.6, method: "last_touch" as const, confidence: 0.7 },
    { actionId: x.id, objectiveId: "o-cps", weight: 0.4, method: "last_touch" as const, confidence: 0.7 },
  ]);

  const label = (cid: string) => chans.find((c) => c.channel_id === cid)?.display_name ?? cid;
  const decisions: Decision[] = memos
    .filter((m) => ["pending", "approved", "rejected"].includes(m.status)) // superseded and auto-applied memos are not decisions
    .map((m) => {
      const ds = Object.entries(m.deltas ?? {}).sort((x, y) => x[1].delta_usd - y[1].delta_usd);
      const imp = m.impact ?? {};
      return {
        id: m.memo_id,
        title: m.title,
        rationale: m.finding,
        impact: `About ${imp.sql_gain ?? 0} more qualified leads a year (${imp.sqls_before ?? "?"} → ${imp.sqls_after ?? "?"}) from a ${money(imp.budget_usd ?? imp.run_rate_usd ?? 0)} yearly budget.`,
        risk: `Assumes each channel keeps getting less effective as we spend more, at the rate we have seen so far.${imp.estimated_channels?.length ? ` Qualified leads for ${imp.estimated_channels.join(", ")} are estimated, not measured.` : ""}`,
        reason: "above_autonomy",
        amount: imp.moved_usd,
        fromActionId: ds[0] ? `ch-${ds[0][0]}` : undefined,
        toActionId: ds.at(-1) ? `ch-${ds.at(-1)![0]}` : undefined,
        evidence: [
          ...ds.filter(([, d]) => d.delta_usd !== 0).map(([cid, d]) => ({
            label: label(cid),
            value: `${money(d.current_usd)} → ${money(d.recommended_usd)}`,
            source: `${SOURCE}.PLAN_PROJECTION`,
          })),
          { label: "My weekly limit", value: `${money(imp.autonomy_limit_usd ?? 0)} per week`, source: `${SOURCE}.ASSUMPTIONS` },
        ],
        status: m.status === "approved" || m.status === "rejected" ? m.status : "pending",
        decidedAt: m.decided_at ?? undefined,
      };
    });
  const log: AgentLogEntry[] = memos
    .filter((m) => m.status === "auto_applied")
    .map((m) => ({ id: `log-${m.memo_id}`, week: p.week, kind: "shift", text: `I did this on my own: ${m.title}`, amount: m.impact?.moved_usd ?? undefined }));

  const ranked = [...chans].filter((c) => c.cost_per_sql).sort((x, y) => n(x.cost_per_sql) - n(y.cost_per_sql));
  const changes: Change[] = [];
  if (ranked[0]) changes.push({ id: "c-best", title: `${ranked[0].display_name}: our cheapest qualified leads`, detail: `${money(n(ranked[0].cost_per_sql))} each${ranked[0].sqls_estimated ? " (estimated)" : ""}${ranked[0].marginal_cost_per_sql == null ? "" : `; the next one would cost about ${money(ranked[0].marginal_cost_per_sql)}`}.`, impact: "positive", metricId: "m-cps", source: `${SOURCE}.PLAN_PROJECTION` });
  const worst = ranked.at(-1);
  if (worst && worst !== ranked[0]) changes.push({ id: "c-worst", title: `${worst.display_name}: our most expensive qualified leads`, detail: `${money(n(worst.cost_per_sql))} each${worst.sqls_estimated ? " (estimated)" : `; only ${Math.round(n(worst.mql_to_sql) * 100)}% of its marketing leads become qualified`}.`, impact: "negative", metricId: "m-cps", source: `${SOURCE}.PLAN_PROJECTION` });

  const noSpend = (s.channels_without_spend ?? []).map(label);
  if (noSpend.length) changes.push({ id: "c-nospend", title: `No spend is tracked for ${noSpend.join(", ")}`, detail: "Their cost per lead is not measured, so I leave them out of budget moves.", impact: "neutral", source: `${SOURCE}.EXEC_STRIP` });

  const pending = decisions.filter((d) => d.status === "pending");
  const leads = `${s.sqls_estimated ? "About " : ""}${Math.round(sqls).toLocaleString("en-US")}`;
  const each = s.cost_per_sql == null ? "" : `, at ${money(s.cost_per_sql)} each`;
  const budget = n(s.plan_budget_usd ?? s.annual_run_rate_usd);
  return {
    case: {
      id: LIVE_ID,
      name: LIVE_NAME,
      tagline: "Live from Snowflake",
      stage: "scale_up",
      stageLabel: "Scaling company",
      industry: "B2B software",
      week: p.week,
      weeksInPeriod: p.weeksInPeriod,
      periodLabel: p.label,
      primaryObjective: "Get as many qualified sales leads as possible from every marketing dollar.",
      sample: false,
      dataStatus: "connected",
    },
    headline: pending.length
      ? `${leads} qualified sales leads so far${each}. I have a budget move that needs your OK: ${pending[0].title}.`
      : `${leads} qualified sales leads so far${each}. Nothing needs your approval this week.`,
    goals: [
      { id: "g-sqls", label: "Qualified sales leads", kind: "other", target: sqlTarget, current: sqls, unit: "count", direction: "up", deadline: p.end, setBy: "ceo" },
      ...(s.payback_months == null ? [] : [{ id: "g-payback", label: "Months to earn back a customer's cost", kind: "other" as const, target: paybackTarget, current: s.payback_months, unit: "months" as const, direction: "down" as const, deadline: p.end, setBy: "board" as const }]),
    ],
    guardrails: {
      budgetTotal: budget,
      budgetSpent: n(s.measured_spend_usd),
      autonomyPct: num(a, "AUTONOMY_LIMIT_PCT", 0.1) * 100,
      brandFloorPct: 0,
      maxShiftPerWeekPct: num(a, "AUTONOMY_LIMIT_PCT", 0.1) * 100,
      minTestWeeks: 2,
    },
    tree,
    objectives: [
      { id: "o-sqls", label: "More qualified leads for the same budget", driverNodeId: "t-sqls", northStarMetricId: "m-sqls", supportingMetricIds: ["m-mql2sql"], priority: 0.8, rationale: "Qualified leads, not marketing leads, are what turn into revenue." },
      { id: "o-cps", label: "Lower cost per qualified lead", driverNodeId: "t-sqls", northStarMetricId: "m-cps", supportingMetricIds: ["m-cpm"], priority: 0.7, rationale: "Cheap marketing leads that never become qualified are a trap." },
      { id: "o-payback", label: "Earn back customer costs faster", driverNodeId: "t-arr", northStarMetricId: "m-payback", supportingMetricIds: [], priority: 0.5, rationale: "The board judges marketing on how fast a new customer pays back what it cost to win." },
    ],
    metrics,
    actions,
    contributions,
    changes,
    decisions,
    log,
  };
}

// The chat route only sends the question, so the live conversation is kept here (single-user demo).
type AgentMessage = { role: "user" | "assistant"; content: { type: "text"; text: string }[] };
const HISTORY_TURNS = 8;
const HISTORY_IDLE_MS = 30 * 60 * 1000;
let history: AgentMessage[] = [];
let lastAskAt = 0;

const msg = (role: AgentMessage["role"], text: string): AgentMessage => ({ role, content: [{ type: "text", text }] });

async function* askLive(question: string): AsyncIterable<string | AskEvent> {
  if (Date.now() - lastAskAt > HISTORY_IDLE_MS) history = [];
  lastAskAt = Date.now();
  const res = await fetch(`${base()}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!res.ok || !res.body) throw new Error(`CMO agent unavailable (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let event = "message";
  let answer = "";
  let complete = false;
  let failed = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          const payload = JSON.parse(line.slice(5).trim() || "{}") as {
            text?: string;
            message?: string;
            name?: string;
            input?: Record<string, unknown>;
          };
          // cmo_delta: teammate's orchestrator /ask; token: the earlier backend.
          if ((event === "cmo_delta" || event === "token") && payload.text) {
            answer += payload.text;
            yield payload.text;
          } else if (event === "status" && payload.message) {
            yield { type: "status", message: payload.message };
          } else if (event === "tool" && payload.name) {
            yield { type: "tool", name: payload.name, input: payload.input };
          } else if (event === "error") {
            failed = true;
            yield { type: "error", message: payload.message ?? JSON.stringify(payload) };
          } else if (event === "done") {
            complete = true;
            return;
          }
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    // Only finished, error-free answers become history; a cancelled stream would leave half an answer.
    if (complete && !failed && answer.trim()) {
      history = [...history, msg("user", question), msg("assistant", answer)].slice(-HISTORY_TURNS * 2);
    }
  }
}

export const cmoApiProvider: CmoProvider = {
  async listCases(): Promise<CaseSummary[]> {
    const live: CaseSummary = { id: LIVE_ID, name: LIVE_NAME, stageLabel: "Scaling company", tagline: "Live from Snowflake", sample: false, dataStatus: "connected" };
    return [live, ...(await mockProvider.listCases())];
  },
  async getCaseData(caseId: CaseId) {
    return caseId === LIVE_ID ? fetchLive() : mockProvider.getCaseData(caseId);
  },
  isLive: (caseId: CaseId) => caseId === LIVE_ID,
  async decide(_caseId, decisionId, status) {
    const res = await fetch(`${base()}/memos/${encodeURIComponent(decisionId)}/${status === "approved" ? "approve" : "reject"}`, { method: "POST" });
    if (!res.ok) throw new Error(`CMO API decide: ${res.status} ${await res.text()}`);
  },
  ask(caseId: CaseId, question: string, data: () => Promise<CaseData>) {
    return caseId === LIVE_ID ? askLive(question) : mockProvider.ask(caseId, question, data);
  },
};
