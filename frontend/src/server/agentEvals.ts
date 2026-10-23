// The agent's eval history from the CMO-Agent backend (GET /evals/hillclimb). Empty when no backend is configured.
import type { AgentEvals } from "@/lib/types";

const EMPTY: AgentEvals = { decision: [], prompts: [], golden: null };

export async function agentEvals(): Promise<AgentEvals> {
  const base = (process.env.CMO_API_URL ?? "").replace(/\/$/, "");
  if (!base) return EMPTY;
  try {
    const res = await fetch(`${base}/evals/hillclimb`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return res.ok ? ((await res.json()) as AgentEvals) : EMPTY;
  } catch {
    return EMPTY;
  }
}
