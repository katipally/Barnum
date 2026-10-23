// Deep dives: saved conversations with the agent per company, persisted to .data/deep-dives.json.
// Their write-ups are fed back to the agent as notes, so later answers build on earlier conclusions.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseData, CaseId, DeepDive, DeepDiveArtifact, DeepDiveList, DeepDiveMessage, DeepDiveSummary } from "@/lib/types";
import { money } from "@/lib/format";
import { dataDir } from "./companies";
import { HttpError } from "./errors";
import { NOTES_PREFIX } from "./agentNotes";
import { getProvider, type AgentTurn } from "./provider";

const MAX_PER_COMPANY = 100;
const MAX_MESSAGES = 60;

interface DeepDiveFile {
  version: 1;
  deepDives: DeepDive[];
}

const g = globalThis as typeof globalThis & {
  __cmoDeepDives?: Promise<Map<string, DeepDive>>;
  __cmoDeepDivesWrite?: Promise<void>;
};
const filePath = () => path.join(dataDir(), "deep-dives.json");

async function load(): Promise<Map<string, DeepDive>> {
  let raw: string;
  try {
    raw = await readFile(filePath(), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw e;
  }
  try {
    const parsed = JSON.parse(raw) as DeepDiveFile;
    return new Map((parsed.deepDives ?? []).filter((d) => d?.id && d.caseId).map((d) => [d.id, d]));
  } catch (e) {
    const aside = `${filePath()}.corrupt-${Date.now()}`;
    console.error(`[deep-dives] unreadable (${(e as Error).message}); moved to ${aside}`);
    await rename(filePath(), aside).catch(() => {});
    return new Map();
  }
}

function all(): Promise<Map<string, DeepDive>> {
  return (g.__cmoDeepDives ??= load().catch((e) => {
    g.__cmoDeepDives = undefined;
    throw e;
  }));
}

async function save(): Promise<void> {
  const json = JSON.stringify({ version: 1, deepDives: [...(await all()).values()] } satisfies DeepDiveFile, null, 2);
  const run = async () => {
    await mkdir(path.dirname(filePath()), { recursive: true });
    const tmp = `${filePath()}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, json, "utf8");
    await rename(tmp, filePath());
  };
  const next = (g.__cmoDeepDivesWrite ?? Promise.resolve()).then(run, run);
  g.__cmoDeepDivesWrite = next.catch(() => {});
  return next;
}

const now = () => new Date().toISOString();
const titleFrom = (q: string) => {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 70 ? `${t.slice(0, 67).trimEnd()}…` : t || "New deep dive";
};

function summary(d: DeepDive): DeepDiveSummary {
  return {
    id: d.id,
    title: d.title,
    updatedAt: d.updatedAt,
    messageCount: d.messages.length,
    answer: d.artifact?.answer,
    stale: !!d.artifact && d.artifact.messageCount < d.messages.length,
  };
}

async function forCase(caseId: CaseId): Promise<DeepDive[]> {
  return [...(await all()).values()].filter((d) => d.caseId === caseId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listDeepDives(caseId: CaseId, data: CaseData): Promise<DeepDiveList> {
  return { deepDives: (await forCase(caseId)).map(summary), starters: starters(data) };
}

export async function getDeepDive(caseId: CaseId, id: string): Promise<DeepDive> {
  const d = (await all()).get(id);
  if (!d || d.caseId !== caseId) throw new HttpError(404, `Unknown deep dive: ${id}`);
  return d;
}

export async function createDeepDive(caseId: CaseId, title?: string): Promise<DeepDive> {
  if ((await forCase(caseId)).length >= MAX_PER_COMPANY) throw new HttpError(409, "Too many deep dives; delete some first");
  const t = now();
  const d: DeepDive = { id: `dd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, caseId, title: titleFrom(title ?? ""), createdAt: t, updatedAt: t, messages: [] };
  (await all()).set(d.id, d);
  await save();
  return d;
}

export async function deleteDeepDive(caseId: CaseId, id: string): Promise<void> {
  await getDeepDive(caseId, id);
  (await all()).delete(id);
  await save();
}

export async function deleteDeepDivesFor(caseId: CaseId): Promise<void> {
  const map = await all();
  for (const d of [...map.values()]) if (d.caseId === caseId) map.delete(d.id);
  await save();
}

/** Write-ups from other deep dives, as one notes turn the agent reads first. */
async function notes(caseId: CaseId, excludeId?: string): Promise<AgentTurn[]> {
  const written = (await forCase(caseId)).filter((d) => d.id !== excludeId && d.artifact);
  if (!written.length) return [];
  const lines = written.slice(0, 8).map((d) => `- "${d.title}": ${d.artifact!.answer} Recommendation: ${d.artifact!.recommendation}`);
  return [
    { role: "user", text: `${NOTES_PREFIX} (build on these, and say so when you do):\n${lines.join("\n")}` },
    { role: "assistant", text: "Understood. I'll build on those conclusions." },
  ];
}

const toTurns = (ms: DeepDiveMessage[]): AgentTurn[] =>
  ms.filter((m) => m.text.trim()).map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

// Deep dives with an answer in progress; a second question would interleave the transcript.
const answering = ((globalThis as typeof globalThis & { __cmoDeepDiveAnswering?: Set<string> }).__cmoDeepDiveAnswering ??= new Set());

function checkCanAsk(d: DeepDive): void {
  if (answering.has(d.id)) throw new HttpError(409, "I'm still answering the last question in this deep dive");
  if (d.messages.length >= MAX_MESSAGES) throw new HttpError(409, "This deep dive is full; start a new one");
}

/** Lets the route answer 404/409 before the stream starts. */
export async function assertCanAsk(caseId: CaseId, id: string): Promise<void> {
  checkCanAsk(await getDeepDive(caseId, id));
}

/** Streams the agent's answer and saves both sides of the exchange to the deep dive. */
export async function* askInDeepDive(caseId: CaseId, id: string, question: string, data: CaseData): AsyncGenerator<string> {
  const d = await getDeepDive(caseId, id);
  checkCanAsk(d);
  answering.add(id);
  let answer = "";
  try {
    const history = [...(await notes(caseId, id)), ...toTurns(d.messages)];
    if (!d.messages.length) d.title = titleFrom(question);
    d.messages.push({ role: "user", text: question, at: now() });
    d.updatedAt = now();
    await save();
    for await (const chunk of getProvider().ask(caseId, question, data, history)) {
      answer += chunk;
      yield chunk;
    }
  } finally {
    answering.delete(id);
    if (answer.trim()) {
      d.messages.push({ role: "agent", text: answer.trim(), at: now() });
      d.updatedAt = now();
      await save();
    }
  }
}

// ---- Write-up ----

const WRITE_UP_PROMPT = `Write up this deep dive for the CEO. Reply with JSON only, no prose, with these keys:
"question" (what was challenged, one line), "answer" (the conclusion, one or two sentences),
"findings" (two to four short strings, each with a number from this conversation or your tools),
"recommendation" (one sentence), "open_questions" (zero to three strings), "confidence" ("low", "medium" or "high").`;

/** Writes (or rewrites) the artifact: the agent's own summary when live, otherwise drawn from the transcript. */
export async function writeUp(caseId: CaseId, id: string, data: CaseData): Promise<DeepDiveArtifact> {
  const d = await getDeepDive(caseId, id);
  if (!d.messages.some((m) => m.role === "agent")) throw new HttpError(409, "Ask at least one question first");
  let artifact: DeepDiveArtifact | null = null;
  if (getProvider().isLive?.(caseId)) {
    try {
      let raw = "";
      for await (const chunk of getProvider().ask(caseId, WRITE_UP_PROMPT, data, toTurns(d.messages))) raw += chunk;
      artifact = parseWriteUp(raw, d);
    } catch (e) {
      console.error("[deep-dives] agent write-up failed, using the transcript", e);
    }
  }
  d.artifact = artifact ?? fromTranscript(d);
  d.updatedAt = now();
  await save();
  return d.artifact;
}

const strs = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, max) : [];

function parseWriteUp(raw: string, d: DeepDive): DeepDiveArtifact | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof j.answer !== "string" || !j.answer.trim()) return null;
    const conf = j.confidence === "high" || j.confidence === "medium" ? j.confidence : "low";
    return {
      question: typeof j.question === "string" && j.question.trim() ? j.question : firstQuestion(d),
      answer: j.answer,
      findings: strs(j.findings, 4),
      recommendation: typeof j.recommendation === "string" ? j.recommendation : "",
      openQuestions: strs(j.open_questions ?? j.openQuestions, 3),
      confidence: conf,
      writtenAt: now(),
      messageCount: d.messages.length,
    };
  } catch {
    return null;
  }
}

const plain = (s: string) => s.replace(/\*\*/g, "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "").trim();
const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-Z0-9$€£"“])/).map((x) => x.trim()).filter(Boolean);
const firstQuestion = (d: DeepDive) => d.messages.find((m) => m.role === "user")?.text ?? d.title;

function fromTranscript(d: DeepDive): DeepDiveArtifact {
  const agent = d.messages.filter((m) => m.role === "agent");
  const last = agent[agent.length - 1]?.text ?? "";
  const all = agent.flatMap((m) => sentences(m.text));
  const findings = [...new Set(all.filter((s) => /\d/.test(s) && s.length <= 220))].slice(0, 4);
  const rec = [...sentences(last)].reverse().find((s) => /\b(recommend|suggest|should|move|shift|keep|cut|pause|scale|test|put|spend)\b/i.test(s));
  const asked = d.messages.filter((m) => m.role === "user");
  const unanswered = d.messages[d.messages.length - 1]?.role === "user" ? [asked[asked.length - 1].text] : [];
  return {
    question: firstQuestion(d),
    answer: sentences(last).slice(0, 2).join(" ") || "No conclusion yet.",
    findings,
    recommendation: rec ?? "No change agreed yet.",
    openQuestions: unanswered,
    confidence: findings.length >= 3 ? "medium" : "low",
    writtenAt: now(),
    messageCount: d.messages.length,
  };
}

// ---- Starters: questions worth challenging, from this company's own plan ----

function starters(data: CaseData): string[] {
  const live = data.actions.filter((a) => a.status === "live" && a.budget > 0);
  if (!live.length) return ["What should we test first, and what would convince you it works?"];
  const biggest = [...live].sort((a, b) => b.budget - a.budget)[0];
  const priciest = [...live].filter((a) => a.costPerResult).sort((a, b) => (b.costPerResult ?? 0) - (a.costPerResult ?? 0))[0];
  const out = [`Is ${biggest.channel} really the right place for ${money(biggest.budget)}?`];
  if (priciest && priciest.id !== biggest.id) out.push(`What would we lose if we cut ${priciest.channel}?`);
  out.push("Where would the next $10k do the most good?");
  return out;
}
