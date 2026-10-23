// Data/agent provider switch. CMO_PROVIDER = "mock" (default) | "cortex".
import type { CaseData, CaseId, CaseSummary, CompanyCase, DataSource } from "@/lib/types";
import { mockProvider } from "./providers/mock";
import { cortexProvider } from "./providers/cortex";
import { cmoApiProvider } from "./providers/cmoApi";

/** Earlier turns sent with a question, oldest first (deep-dive notes, then the thread so far). */
export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
}

export interface CmoProvider {
  /** Provider-owned (sample) companies; read-only, cannot be deleted. */
  listCases(): Promise<CaseSummary[]>;
  getCaseData(caseId: CaseId): Promise<CaseData | undefined>;
  /** Live data for a user-created company once its data source is connected; null while awaiting data. */
  getConnectedData?(company: CompanyCase): Promise<CaseData | null>;
  ask(caseId: CaseId, question: string, data: CaseData, history?: AgentTurn[]): AsyncIterable<string>;
  /** Sources behind a live company; others are derived from their case data. */
  listSources?(caseId: CaseId): Promise<DataSource[] | null>;
  /** Live companies are re-read on every request (no in-memory copy) and decide through the backend. */
  isLive?(caseId: CaseId): boolean;
  decide?(caseId: CaseId, decisionId: string, status: "approved" | "rejected", note?: string): Promise<void>;
}

// CMO_PROVIDER = "mock" (default) | "cortex" | "cmo-api" (CMO-Agent FastAPI over Snowflake, needs CMO_API_URL).
export function getProvider(): CmoProvider {
  if (process.env.CMO_PROVIDER === "cmo-api") return cmoApiProvider;
  return process.env.CMO_PROVIDER === "cortex" ? cortexProvider : mockProvider;
}

