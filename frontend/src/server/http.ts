// Shared helpers for route handlers: company resolution and JSON error mapping.
import type { CaseData, CaseId } from "@/lib/types";
import { companyExists } from "./companies";
import { HttpError } from "./errors";
import { getCase } from "./store";

export { HttpError };

export type CompanyParams = { params: Promise<{ id: string }> };

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function resolveCaseId(params: Promise<{ id: string }>): Promise<CaseId> {
  const { id } = await params;
  if (!(await companyExists(id))) throw new HttpError(404, `Unknown company: ${id}`);
  return id;
}

export async function loadCase(params: Promise<{ id: string }>): Promise<{ caseId: CaseId; data: CaseData }> {
  const caseId = await resolveCaseId(params);
  return { caseId, data: await getCase(caseId) };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}

/** Runs a handler and maps HttpError (and anything else) to a JSON error response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.message);
    console.error("[api]", e);
    return jsonError(500, "Internal error");
  }
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
