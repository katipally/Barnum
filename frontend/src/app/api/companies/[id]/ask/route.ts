import type { AskEvent } from "@/lib/types";
import { getProvider } from "@/server/provider";
import { getCase } from "@/server/store";
import { type CompanyParams, HttpError, handle, isObj, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

// NDJSON: one AskEvent per line. The company data loads lazily, so live agents start streaming at once.
export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const body = await readJson(req);
    if (!isObj(body) || typeof body.question !== "string" || !body.question.trim())
      throw new HttpError(400, "question must be a non-empty string");
    const question = body.question.trim().slice(0, 2000);
    const iterator = getProvider().ask(caseId, question, () => getCase(caseId))[Symbol.asyncIterator]();
    const enc = new TextEncoder();
    const line = (e: AskEvent) => enc.encode(`${JSON.stringify(e)}\n`);

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
  });
}
