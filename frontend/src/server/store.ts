// In-memory working copy per company (deep clone of its source), kept on globalThis to survive dev HMR.
import type { AgentLogEntry, CaseData, CaseId, Decision, SteeringUpdate } from "@/lib/types";
import { companySource, persistCompany, resetCompanyTemplate } from "./companies";
import { HttpError } from "./errors";
import { getProvider } from "./provider";

export { HttpError };

const g = globalThis as typeof globalThis & { __cmoStore?: Map<CaseId, CaseData> };
const store = (g.__cmoStore ??= new Map<CaseId, CaseData>());
// Steering on live (backend) companies is kept as an overlay re-applied to every fresh read.
const overlays = new Map<CaseId, SteeringUpdate[]>();

export async function getCase(caseId: CaseId): Promise<CaseData> {
  if (getProvider().isLive?.(caseId)) {
    const live = await companySource(caseId);
    if (!live) throw new HttpError(404, `Unknown company: ${caseId}`);
    for (const u of overlays.get(caseId) ?? []) applySteering(live, u);
    return live;
  }
  let d = store.get(caseId);
  if (!d) {
    const src = await companySource(caseId);
    if (!src) throw new HttpError(404, `Unknown company: ${caseId}`);
    d = structuredClone(src);
    store.set(caseId, d);
  }
  return d;
}

/** Drops in-memory changes so the next read reloads source data; user companies get a fresh template. */
export async function resetCase(caseId: CaseId): Promise<void> {
  store.delete(caseId);
  overlays.delete(caseId);
  await resetCompanyTemplate(caseId);
}

/** Forgets the working copy (after a company is deleted). */
export function evictCase(caseId: CaseId): void {
  store.delete(caseId);
}

function logEntry(d: CaseData, entry: Omit<AgentLogEntry, "id" | "week">): void {
  d.log.push({ id: `log-ceo-${Date.now()}-${d.log.length}`, week: d.case.week, ...entry });
}

export async function decide(
  caseId: CaseId,
  decisionId: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<Decision> {
  const provider = getProvider();
  if (provider.isLive?.(caseId) && provider.decide) {
    const before = (await getCase(caseId)).decisions.find((x) => x.id === decisionId);
    if (!before) throw new HttpError(404, `Unknown decision: ${decisionId}`);
    if (before.status !== "pending") throw new HttpError(409, `Decision already ${before.status}`);
    await provider.decide(caseId, decisionId, status, note);
    const after = (await getCase(caseId)).decisions.find((x) => x.id === decisionId);
    return after ?? { ...before, status, decidedAt: new Date().toISOString() };
  }
  const d = await getCase(caseId);
  const dec = d.decisions.find((x) => x.id === decisionId);
  if (!dec) throw new HttpError(404, `Unknown decision: ${decisionId}`);
  if (dec.status !== "pending") throw new HttpError(409, `Decision already ${dec.status}`);

  dec.status = status;
  dec.decidedAt = new Date().toISOString();
  if (note) dec.note = note;

  if (status === "rejected") {
    logEntry(d, { kind: "alert", text: `You said no: ${dec.title}${note ? ` (${note})` : ""}` });
    await persistCompany(d);
    return dec;
  }

  const from = dec.fromActionId ? d.actions.find((a) => a.id === dec.fromActionId) : undefined;
  const to = dec.toActionId ? d.actions.find((a) => a.id === dec.toActionId) : undefined;
  let moved: number | undefined;
  if (dec.amount && dec.amount > 0 && (from || to)) {
    // Never take back money a source action has already spent.
    moved = from ? Math.min(dec.amount, Math.max(0, from.budget - (from.spent ?? 0))) : dec.amount;
    if (from) from.budget -= moved;
    if (to) {
      to.budget += moved;
      if (to.status !== "live") {
        to.status = "live";
        to.weeksRunning = 0;
      }
    }
    if (!from) d.guardrails.budgetTotal += moved; // new money rather than a reallocation
  }
  const kind: AgentLogEntry["kind"] = moved ? "shift" : dec.reason === "new_channel" ? "launch" : "alert";
  logEntry(d, { kind, text: `You approved: ${dec.title}`, amount: moved });
  await persistCompany(d);
  return dec;
}

export async function steer(caseId: CaseId, u: SteeringUpdate): Promise<CaseData> {
  const d = await getCase(caseId);
  applySteering(d, u);
  if (getProvider().isLive?.(caseId)) overlays.set(caseId, [...(overlays.get(caseId) ?? []), u]);
  else await persistCompany(d);
  return d;
}

function applySteering(d: CaseData, u: SteeringUpdate): void {
  // Validate every id before mutating anything.
  const unknown = [
    ...(u.goals ?? []).filter((x) => !d.goals.some((gl) => gl.id === x.id)).map((x) => `goal ${x.id}`),
    ...(u.objectivePriorities ?? []).filter((x) => !d.objectives.some((o) => o.id === x.id)).map((x) => `objective ${x.id}`),
  ];
  if (unknown.length) throw new HttpError(400, `Unknown ids: ${unknown.join(", ")}`);

  for (const { id, target } of u.goals ?? []) {
    const goal = d.goals.find((x) => x.id === id)!;
    // Keep the revenue tree root in step when it mirrors this goal.
    if (goal.kind === "revenue" && d.tree.unit === goal.unit && d.tree.target === goal.target) d.tree.target = target;
    goal.target = target;
  }
  for (const { id, priority } of u.objectivePriorities ?? []) {
    d.objectives.find((x) => x.id === id)!.priority = Math.min(1, Math.max(0, priority));
  }

  const gr = u.guardrails ?? {};
  if (gr.budgetTotal !== undefined) d.guardrails.budgetTotal = Math.max(0, gr.budgetTotal);
  if (gr.autonomyPct !== undefined) d.guardrails.autonomyPct = Math.min(100, Math.max(0, gr.autonomyPct));
  if (gr.brandFloorPct !== undefined) d.guardrails.brandFloorPct = Math.min(100, Math.max(0, gr.brandFloorPct));
}
