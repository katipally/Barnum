// Live company backed by the CMO-Agent FastAPI (Snowflake CMO_DB). Samples still come from seeds.
// Env: CMO_API_URL (e.g. http://localhost:8000), CMO_API_COMPANY_ID, CMO_API_COMPANY_NAME.
import type {
  Action,
  AgentLogEntry,
  AgentThread,
  CaseData,
  CaseId,
  CaseSummary,
  Change,
  DataSource,
  Contribution,
  Decision,
  Metric,
  TreeNode,
} from "@/lib/types";
import fs from "node:fs/promises";
import path from "node:path";
import { money } from "@/lib/format";
import type { AgentTurn, CmoProvider } from "../provider";
import { mockProvider } from "./mock";

const base = () => (process.env.CMO_API_URL ?? "").replace(/\/$/, "");
export const LIVE_ID = process.env.CMO_API_COMPANY_ID ?? "snowflake";
const LIVE_NAME = process.env.CMO_API_COMPANY_NAME ?? "Your company";
const SOURCE = "Snowflake: CMO_DB.CORE";

type Num = number | null;
interface Strip {
  budget_usd: Num; spent_usd: Num; mqls: Num; sqls: Num; cost_per_mql: Num; cost_per_sql: Num;
  cac_full_usd: Num; payback_months: Num; projected_sqls_remaining: Num;
}
interface Channel {
  channel_id: string; display_name: string; spend_usd: Num; plan_usd: Num; mqls: Num; sqls: Num;
  cost_per_mql: Num; cost_per_sql: Num; mql_to_sql: Num; marginal_cost_per_sql: Num; remaining_usd: Num;
}
interface Memo {
  memo_id: string; created_at: string; title: string; finding: string; recommendation: string; status: string;
  decided_at?: string | null;
  deltas: Record<string, { current_usd: number; recommended_usd: number; delta_usd: number; sqls_before: number; sqls_after: number }>;
  impact: { remaining_budget_usd?: number; moved_usd?: number; sqls_before?: number; sqls_after?: number; sql_gain?: number; autonomy_limit_usd?: number };
}

const TIMEOUT_MS = Number(process.env.CMO_API_TIMEOUT_MS ?? 20000);

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  if (/billboard|ooh|tv|radio|podcast|display|youtube/.test(id)) return "awareness";
  if (/google|search|retarget/.test(id)) return "conversion";
  return "consideration";
}

function period(a: Record<string, unknown>) {
  const label = String(a.PERIOD ?? "Q4_2026").replace(/_/g, " ");
  const start = new Date(String(a.PERIOD_START ?? "2026-10-01"));
  const end = new Date(String(a.PERIOD_END ?? "2026-12-31"));
  const weeksInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 6048e5));
  const week = Math.min(weeksInPeriod, Math.max(1, Math.ceil((Date.now() - start.getTime()) / 6048e5)));
  return { label, end: end.toISOString().slice(0, 10), weeksInPeriod, week };
}

// Snowflake views can take 10+ s, so pages read a cached snapshot and refresh it in the background
// (stale-while-revalidate). The last good snapshot is also kept on disk so a restart or a backend
// outage still shows numbers instead of an empty screen.
const FRESH_MS = Number(process.env.CMO_API_CACHE_MS ?? 30000);
const SNAPSHOT = () => path.join(process.env.CMO_DATA_DIR ?? path.join(process.cwd(), ".data"), "live-snapshot.json");
const live = ((globalThis as { __cmoLive?: { data?: CaseData; at: number; inflight?: Promise<CaseData> } }).__cmoLive ??= { at: 0 });

function refresh(): Promise<CaseData> {
  live.inflight ??= fetchLive()
    .then(async (d) => {
      Object.assign(live, { data: d, at: Date.now() });
      await fs.mkdir(path.dirname(SNAPSHOT()), { recursive: true }).catch(() => {});
      await fs.writeFile(SNAPSHOT(), JSON.stringify(d)).catch(() => {});
      return d;
    })
    .finally(() => (live.inflight = undefined));
  return live.inflight;
}

async function cachedLive(): Promise<CaseData> {
  if (!live.data) {
    try {
      live.data = JSON.parse(await fs.readFile(SNAPSHOT(), "utf8")) as CaseData;
    } catch {
      return refresh(); // first ever load: nothing to show yet, wait for the backend
    }
  }
  if (Date.now() - live.at > FRESH_MS) refresh().catch((e) => console.warn(`CMO API refresh failed: ${String(e)}`));
  return live.data!;
}

export async function fetchLive(): Promise<CaseData> {
  const [a, raw, chans, memos] = await Promise.all([
    get<AssumptionRow[]>("/assumptions").then(assumptionMap),
    get<Strip & Record<string, Num>>("/q4/strip"),
    // The backend may be mid-migration; a missing channel view should not take the whole company down.
    get<Channel[]>("/q4/channels").catch((e) => (console.warn(String(e)), [] as Channel[])),
    get<Memo[]>("/memos").catch((e) => (console.warn(String(e)), [] as Memo[])),
  ]);
  // Newer EXEC_STRIP names: measured_spend_usd, plan_budget_usd, plan_projected_sqls.
  const s: Strip = {
    ...raw,
    spent_usd: raw.spent_usd ?? raw.measured_spend_usd ?? null,
    budget_usd: raw.budget_usd ?? raw.plan_budget_usd ?? null,
    projected_sqls_remaining: raw.projected_sqls_remaining ?? null,
  };
  const p = period(a);
  const win = num(a, "SQL_TO_WON", 0.15);
  const acv = num(a, "ACV_USD", 120000);
  const sqlTarget = num(a, "Q4_SQL_TARGET"); // 0 = not set; add it to ASSUMPTIONS to get a pace
  const paybackTarget = num(a, "PAYBACK_TARGET_MONTHS", 14);
  const sqls = n(s.sqls);
  const sqlsFc = sqls + n(s.projected_sqls_remaining);
  const mqls = n(s.mqls);
  const mqlToSql = mqls ? sqls / mqls : 0;
  const series = (v: number) => [{ week: p.week, value: v }];

  const metrics: Metric[] = [
    { id: "m-sqls", label: "Qualified sales leads this period", unit: "count", target: sqlTarget, direction: "up", lagging: true, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-sqls", series: series(sqls) },
    { id: "m-cps", label: "Cost per qualified lead", unit: "usd", target: num(a, "CPS_TARGET_USD"), direction: "down", lagging: false, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-cps", series: series(n(s.cost_per_sql)) },
    { id: "m-cpm", label: "Cost per marketing lead", unit: "usd", target: 0, direction: "down", lagging: false, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-cps", series: series(n(s.cost_per_mql)) },
    { id: "m-mql2sql", label: "Marketing leads that become qualified", unit: "pct", target: 0, direction: "up", lagging: false, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-sqls", series: series(mqlToSql * 100) },
    { id: "m-payback", label: "Months to earn back a customer's cost", unit: "months", target: paybackTarget, direction: "down", lagging: true, source: `${SOURCE}.EXEC_STRIP`, objectiveId: "o-payback", series: series(n(s.payback_months)) },
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
    budget: n(c.plan_usd) || n(c.spend_usd),
    spent: n(c.spend_usd),
    resultLabel: "qualified lead",
    results: n(c.sqls),
    costPerResult: c.cost_per_sql ?? null,
    marginalCostPerResult: c.marginal_cost_per_sql ?? null,
    weeksRunning: p.week,
    hypothesis: `${n(c.mqls)} marketing leads became ${n(c.sqls)} qualified leads (${Math.round(n(c.mql_to_sql) * 100)}%). I judge it on qualified leads, because those turn into revenue.`,
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
        impact: `About ${imp.sql_gain ?? 0} more qualified leads (${imp.sqls_before ?? "?"} → ${imp.sqls_after ?? "?"}) from the ${money(imp.remaining_budget_usd ?? 0)} still to spend.`,
        risk: "Assumes each channel keeps getting less effective as we spend more, at the rate we have seen this period.",
        reason: "above_autonomy",
        amount: imp.moved_usd,
        fromActionId: ds[0] ? `ch-${ds[0][0]}` : undefined,
        toActionId: ds.at(-1) ? `ch-${ds.at(-1)![0]}` : undefined,
        evidence: [
          ...ds.filter(([, d]) => d.delta_usd !== 0).map(([cid, d]) => ({
            label: label(cid),
            value: `${money(d.current_usd)} → ${money(d.recommended_usd)}`,
            source: `${SOURCE}.Q4_PROJECTION`,
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
  if (ranked[0]) changes.push({ id: "c-best", title: `${ranked[0].display_name}: our cheapest qualified leads`, detail: `${money(n(ranked[0].cost_per_sql))} each; the next one would cost about ${money(n(ranked[0].marginal_cost_per_sql))}.`, impact: "positive", metricId: "m-cps", source: `${SOURCE}.Q4_PROJECTION` });
  const worst = ranked.at(-1);
  if (worst && worst !== ranked[0]) changes.push({ id: "c-worst", title: `${worst.display_name}: our most expensive qualified leads`, detail: `${money(n(worst.cost_per_sql))} each; only ${Math.round(n(worst.mql_to_sql) * 100)}% of its marketing leads become qualified.`, impact: "negative", metricId: "m-cps", source: `${SOURCE}.Q4_PROJECTION` });

  const pending = decisions.filter((d) => d.status === "pending");
  const budget = n(s.budget_usd);
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
      ? `${Math.round(sqls).toLocaleString("en-US")} qualified sales leads so far, at ${money(n(s.cost_per_sql))} each. I have a budget move that needs your OK: ${pending[0].title}.`
      : `${Math.round(sqls).toLocaleString("en-US")} qualified sales leads so far, at ${money(n(s.cost_per_sql))} each. Nothing needs your approval this week.`,
    goals: [
      { id: "g-sqls", label: "Qualified sales leads this period", kind: "other", target: sqlTarget, current: sqls, unit: "count", direction: "up", deadline: p.end, setBy: "ceo" },
      { id: "g-payback", label: "Months to earn back a customer's cost", kind: "other", target: paybackTarget, current: n(s.payback_months), unit: "months", direction: "down", deadline: p.end, setBy: "board" },
    ],
    guardrails: {
      budgetTotal: budget,
      budgetSpent: n(s.spent_usd),
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

// Plain /ask calls (no deep dive) keep their conversation here (single-user demo); deep dives pass their own turns.
// Both run on a Snowflake thread when the backend offers one; the history is still sent: it seeds a new thread
// and is the fallback when the thread is gone.
type AgentMessage = { role: "user" | "assistant"; content: { type: "text"; text: string }[] };
const HISTORY_TURNS = 8;
const HISTORY_IDLE_MS = 30 * 60 * 1000;
let history: AgentMessage[] = [];
let plainThread: AgentThread | null = null;
let lastAskAt = 0;

const msg = (role: AgentMessage["role"], text: string): AgentMessage => ({ role, content: [{ type: "text", text }] });

export interface LiveThreadOpts {
  thread?: AgentThread | null;
  /** Called once the answer is done: the thread to continue next time, or null when the backend fell back to history. */
  onThread?: (thread: AgentThread | null) => void;
}

export async function* askLive(question: string, turns?: AgentTurn[], opts?: LiveThreadOpts): AsyncIterable<string> {
  const own = !turns;
  if (own && Date.now() - lastAskAt > HISTORY_IDLE_MS) [history, plainThread] = [[], null];
  lastAskAt = Date.now();
  const sent = turns ? turns.map((t) => msg(t.role, t.text)) : history;
  const thread = own ? plainThread : opts?.thread;
  const res = await fetch(`${base()}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question,
      history: sent,
      ...(thread ? { thread_id: thread.id, parent_message_id: thread.parentMessageId ?? null } : { new_thread: true }),
    }),
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
            text?: string; message?: string; thread_id?: number | null; message_id?: number | null;
          };
          // cmo_delta: teammate's orchestrator /ask; token: the earlier backend.
          if ((event === "cmo_delta" || event === "token") && payload.text) {
            answer += payload.text;
            yield payload.text;
          } else if (event === "error") {
            failed = true;
            yield `\n[CMO agent error] ${payload.message ?? JSON.stringify(payload)}`;
          } else if (event === "done") {
            complete = true;
            const next = payload.thread_id ? { id: payload.thread_id, parentMessageId: payload.message_id ?? undefined } : null;
            if (own) plainThread = next;
            else opts?.onThread?.(next);
            return;
          }
        }
      }
    }
  } finally {
    // Only finished, error-free answers become history; a cancelled stream would leave half an answer.
    if (own && complete && !failed && answer.trim()) {
      history = [...history, msg("user", question), msg("assistant", answer)].slice(-HISTORY_TURNS * 2);
    }
  }
}

interface ChannelRow {
  channel_id: string; display_name: string; description: string; schema_name: string; status: string;
  map_version: number | null; updated_at: string;
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s).trim();

// What the live company's agent reads: the warehouse, one Snowflake schema per channel agent, the CRM and the plan.
async function liveSources(): Promise<DataSource[]> {
  const [channels, assumptions] = await Promise.all([get<ChannelRow[]>("/channels"), get<AssumptionRow[]>("/assumptions")]);
  const latest = channels.map((c) => c.updated_at).sort().at(-1);
  return [
    {
      id: "snowflake", name: "Snowflake", kind: "warehouse", status: "connected",
      provides: "Every channel's spend, leads and deals in one common funnel, by day, channel and campaign.",
      usedFor: ["Cost per qualified lead", "Budget left", "Payback"],
      detail: "CMO_DB.CORE · funnel views and the semantic view the agent queries", updatedAt: latest,
    },
    ...channels.map((c): DataSource => ({
      id: `channel-${c.channel_id}`, name: c.display_name, kind: "channel",
      status: c.status === "active" ? "connected" : "paused",
      provides: firstSentence(c.description), usedFor: [`${c.display_name} spend`, "Leads", "Qualified leads"],
      detail: `CMO_DB.${c.schema_name}${c.map_version ? ` · mapping v${c.map_version}` : ""} · has its own channel agent`,
      updatedAt: c.updated_at,
    })),
    {
      id: "crm", name: "CRM export", kind: "crm", status: "connected",
      provides: "Leads, qualified leads and deals, matched to channels by campaign tags and landing pages.",
      usedFor: ["Qualified leads", "Deals won"], detail: "Uploaded as files and matched to each channel's campaigns",
    },
    {
      id: "plan", name: "Planning assumptions", kind: "plan", status: "connected",
      provides: "The quarter's budget, deal size, win rate and the limits you set.",
      usedFor: ["Forecasts", "Payback", "Autonomy limit"], detail: `${assumptions.length} values in CMO_DB.CORE`,
    },
  ];
}

export const cmoApiProvider: CmoProvider = {
  async listCases(): Promise<CaseSummary[]> {
    const live: CaseSummary = { id: LIVE_ID, name: LIVE_NAME, stageLabel: "Scaling company", tagline: "Live from Snowflake", sample: false, dataStatus: "connected" };
    return [live, ...(await mockProvider.listCases())];
  },
  async getCaseData(caseId: CaseId) {
    return caseId === LIVE_ID ? cachedLive() : mockProvider.getCaseData(caseId);
  },
  isLive: (caseId: CaseId) => caseId === LIVE_ID,
  async decide(_caseId, decisionId, status, note) {
    // The note goes to the agent as feedback on the run that wrote the memo.
    const res = await fetch(`${base()}/memos/${encodeURIComponent(decisionId)}/${status === "approved" ? "approve" : "reject"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: note ?? null }),
    });
    if (!res.ok) throw new Error(`CMO API decide: ${res.status} ${await res.text()}`);
    await refresh(); // the next read must show the decision, not the cached pending card
  },
  ask(caseId: CaseId, question: string, data: CaseData, turns?: AgentTurn[]) {
    return caseId === LIVE_ID ? askLive(question, turns) : mockProvider.ask(caseId, question, data, turns);
  },
  async listSources(caseId: CaseId) {
    return caseId === LIVE_ID ? liveSources() : null;
  },
};
