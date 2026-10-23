// Mock provider: seed data (sample companies) + keyword-routed streamed answers. No network.
import { seeds } from "@/data/seeds";
import type { CaseData, CaseId, CaseSummary } from "@/lib/types";
import type { AgentTurn, CmoProvider } from "../provider";
import { relatedNote } from "../agentNotes";
import { toSummary } from "../brief";
import { askMock, composeAnswer, streamWords } from "../ask-mock";

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
  ask(caseId: CaseId, question: string, data: CaseData, turns?: AgentTurn[]) {
    const note = relatedNote(question, turns);
    if (!note) return askMock(caseId, question, data);
    // Scripted answers often repeat the earlier conclusion; then name the deep dive without quoting it again.
    const repeats = composeAnswer(question, data).includes(note.text.slice(0, 60));
    return (async function* () {
      yield* streamWords(repeats ? `Building on our deep dive "${note.title}":\n\n` : `Building on our deep dive "${note.title}": ${note.text}\n\n`);
      yield* askMock(caseId, question, data);
    })();
  },
};
