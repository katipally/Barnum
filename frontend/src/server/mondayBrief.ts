// The CMO agent's Monday brief, read from the FastAPI backend (/brief). Only the live company has one.
import type { CaseId, MondayBrief, MondayBriefState } from "@/lib/types";
import { HttpError } from "./errors";
import { LIVE_ID } from "./providers/cmoApi";

const base = () => (process.env.CMO_API_URL ?? "").replace(/\/$/, "");

interface Row {
  created_at: string;
  source: MondayBrief["source"];
  brief: string;
  pending_memos: unknown[] | null;
}

/** Latest brief, or with `refresh` a new one written by the agent now (about a minute). */
export async function mondayBrief(caseId: CaseId, refresh = false): Promise<MondayBriefState | null> {
  if (process.env.CMO_PROVIDER !== "cmo-api" || caseId !== LIVE_ID) return null;
  const res = await fetch(`${base()}/brief${refresh ? "/refresh" : ""}`, {
    method: refresh ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(refresh ? 180_000 : 20_000),
  });
  if (res.status === 404) return null; // backend started before /brief existed
  if (!res.ok) throw new HttpError(502, `CMO API /brief: ${res.status}`);
  const { brief: row, writing } = (await res.json()).data as { brief: Row | null; writing: boolean };
  const brief = row && { createdAt: row.created_at, source: row.source, text: row.brief, pendingMemos: row.pending_memos?.length ?? 0 };
  return { brief, writing };
}
