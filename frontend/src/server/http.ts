// Shared helpers for route handlers: company resolution and JSON error mapping.
import type { CaseData, CaseId, PlanEvent } from "@/lib/types";
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

/** NDJSON stream: one event per line, ending with "done" (or "error"). Strings are answer text. */
export function ndjsonResponse(source: AsyncIterable<string | PlanEvent>): Response {
  const iterator = source[Symbol.asyncIterator]();
  const enc = new TextEncoder();
  const line = (e: PlanEvent) => enc.encode(`${JSON.stringify(e)}\n`);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.enqueue(line({ type: "done" }));
          controller.close();
        } else controller.enqueue(line(typeof value === "string" ? { type: "text", text: value } : value));
      } catch (e) {
        controller.enqueue(line({ type: "error", message: (e as Error).message }));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
