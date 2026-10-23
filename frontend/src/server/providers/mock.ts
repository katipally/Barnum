// Mock provider: seed data (sample companies) + keyword-routed streamed answers. No network.
import { seeds } from "@/data/seeds";
import type { CaseData, CaseId, CaseSummary } from "@/lib/types";
import type { CmoProvider } from "../provider";
import { toSummary } from "../brief";
import { askMock } from "../ask-mock";

export function seedSummaries(): CaseSummary[] {
  return Object.values(seeds).map(toSummary);
}

export function seedData(caseId: CaseId): CaseData | undefined {
  return Object.hasOwn(seeds, caseId) ? seeds[caseId] : undefined;
}

export const mockProvider: CmoProvider = {
  async getCaseData(caseId: CaseId) {
    return seedData(caseId);
  },
  async listCases() {
    return seedSummaries();
  },
  async *ask(caseId: CaseId, question: string, data: () => Promise<CaseData>) {
    yield* askMock(caseId, question, await data());
  },
};
