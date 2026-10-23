// Snowflake Cortex Agents provider. UNTESTED scaffold for a colleague to finish; see INTEGRATION.md.
import type { CaseData, CaseId, CompanyCase } from "@/lib/types";
import type { CmoProvider } from "../provider";
import { askMock } from "../ask-mock";
import { buildBrief, buildStrategy } from "../brief";
import { seedData, seedSummaries } from "./mock";

function env() {
  const e = {
    accountUrl: process.env.SNOWFLAKE_ACCOUNT_URL?.replace(/\/$/, ""),
    pat: process.env.SNOWFLAKE_PAT,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
    agent: process.env.SNOWFLAKE_AGENT,
  };
  const ok = e.accountUrl && e.pat && e.database && e.schema && e.agent;
  return ok ? (e as Required<typeof e>) : null;
}

// Compact case context so the agent reasons over the same derived numbers the UI shows.
export function caseContext(data: CaseData): string {
  const brief = buildBrief(data);
  const strategy = buildStrategy(data);
  return JSON.stringify({
    company: { name: data.case.name, stage: data.case.stageLabel, dataStatus: data.case.dataStatus, week: data.case.week, of: data.case.weeksInPeriod, period: data.case.periodLabel },
    primaryObjective: data.case.primaryObjective,
    overall: brief.overall,
    budgetPacing: brief.budgetPacing,
    guardrails: data.guardrails,
    goals: brief.goals.map((g) => ({ label: g.label, current: g.current, target: g.target, unit: g.unit, status: g.status })),
    objectives: brief.scorecard.map((s) => ({
      label: s.objective.label,
      priority: s.objective.priority,
      northStar: s.northStar.label,
      latest: s.northStar.series.at(-1)?.value,
      target: s.northStar.target,
      forecast: s.forecast,
      status: s.status,
      source: s.northStar.source,
    })),
    actions: strategy.actions.map((a) => ({
      id: a.id, label: a.label, channel: a.channel, budget: a.budget, spent: a.spent, results: a.results,
      resultLabel: a.resultLabel, cpr: a.costPerResult, marginal: a.marginalCostPerResult, verdict: a.verdict, score: a.score,
    })),
    pendingDecisions: data.decisions.filter((d) => d.status === "pending").map((d) => ({ title: d.title, amount: d.amount, reason: d.reason })),
  });
}

async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      yield { event, data: data.join("\n") };
    }
  }
}

async function* askCortex(caseId: CaseId, question: string, data: CaseData): AsyncGenerator<string> {
  const e = env();
  if (!e) {
    console.warn("[cortex] SNOWFLAKE_* env vars missing, falling back to mock answer");
    yield* askMock(caseId, question, data);
    return;
  }
  const url = `${e.accountUrl}/api/v2/databases/${e.database}/schemas/${e.schema}/agents/${e.agent}:run`;
  const text = `Case context (JSON): ${caseContext(data)}\n\nCEO question: ${question}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.pat}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text }] }] }),
    });
  } catch (err) {
    yield `Cortex request failed: ${(err as Error).message}`;
    return;
  }
  if (!res.ok || !res.body) {
    yield `Cortex returned ${res.status}: ${(await res.text()).slice(0, 300)}`;
    return;
  }
  for await (const ev of parseSse(res.body)) {
    if (ev.event === "response.text.delta") {
      try {
        const t = (JSON.parse(ev.data) as { text?: string }).text;
        if (t) yield t;
      } catch {
        // ignore malformed frames
      }
    } else if (ev.event === "error") {
      yield `\n[Cortex error] ${ev.data.slice(0, 300)}`;
    }
  }
}

export const cortexProvider: CmoProvider = {
  async getCaseData(caseId: CaseId) {
    // TODO(colleague): load CaseData from Snowflake (tables / semantic views in INTEGRATION.md),
    // e.g. via the SQL API POST {SNOWFLAKE_ACCOUNT_URL}/api/v2/statements, then map rows to CaseData.
    return seedData(caseId);
  },
  async listCases() {
    return seedSummaries();
  },
  async getConnectedData(company: CompanyCase) {
    // TODO(colleague): if CASES has a row for company.id, load its CaseData (tables in INTEGRATION.md); else null.
    void company;
    return null;
  },
  ask(caseId: CaseId, question: string, data: CaseData) {
    return askCortex(caseId, question, data);
  },
};
