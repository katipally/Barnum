// Data/agent provider switch. CMO_PROVIDER = "mock" (default) | "cortex".
import type { AskEvent, CampaignDraft, CaseData, CaseId, CaseSummary, CompanyCase, DataSource, Plan2027Load, PlanEvent, PlanInputs } from "@/lib/types";
import { mockProvider } from "./providers/mock";
import { cortexProvider } from "./providers/cortex";
import { cmoApiProvider } from "./providers/cmoApi";
import { mockPlan2027 } from "./plan-mock";

/** Earlier turns sent with a question, oldest first (deep-dive notes, then the thread so far). */
export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
}

export interface Plan2027Provider {
  load(caseId: CaseId): Promise<Plan2027Load>;
  /** The company data loads lazily; only simulated plans need it. */
  run(caseId: CaseId, inputs: PlanInputs, data: () => Promise<CaseData>): AsyncIterable<PlanEvent>;
  draft(caseId: CaseId, planId: string, channelId: string): Promise<CampaignDraft>;
  campaigns(caseId: CaseId, channelId: string): Promise<CampaignDraft[]>;
}

export interface CmoProvider {
  /** Provider-owned (sample) companies; read-only, cannot be deleted. */
  listCases(): Promise<CaseSummary[]>;
  getCaseData(caseId: CaseId): Promise<CaseData | undefined>;
  /** Live data for a user-created company once its data source is connected; null while awaiting data. */
  getConnectedData?(company: CompanyCase): Promise<CaseData | null>;
  /** Plain strings are answer text. `data` loads lazily so live providers can start streaming without it. */
  ask(caseId: CaseId, question: string, data: () => Promise<CaseData>, history?: AgentTurn[]): AsyncIterable<string | AskEvent>;
  /** Sources behind a live company; others are derived from their case data. */
  listSources?(caseId: CaseId): Promise<DataSource[] | null>;
  /** Live companies are re-read on every request (no in-memory copy) and decide through the backend. */
  isLive?(caseId: CaseId): boolean;
  /** Real 2027 planning for live companies; every other company gets the simulated plan. */
  plan2027?: Plan2027Provider;
  decide?(caseId: CaseId, decisionId: string, status: "approved" | "rejected", note?: string): Promise<void>;
}

// CMO_PROVIDER = "mock" (default) | "cortex" | "cmo-api" (CMO-Agent FastAPI over Snowflake, needs CMO_API_URL).
export function getProvider(): CmoProvider {
  if (process.env.CMO_PROVIDER === "cmo-api") return cmoApiProvider;
  return process.env.CMO_PROVIDER === "cortex" ? cortexProvider : mockProvider;
}


export function getPlan2027(caseId: CaseId): Plan2027Provider {
  const p = getProvider();
  return p.isLive?.(caseId) && p.plan2027 ? p.plan2027 : mockPlan2027;
}
