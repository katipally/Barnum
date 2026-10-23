import { getProvider } from "@/server/provider";
import { type CompanyParams, HttpError, handle, isObj, loadCase, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const { caseId, data } = await loadCase(params);
    const body = await readJson(req);
    if (!isObj(body) || typeof body.question !== "string" || !body.question.trim())
      throw new HttpError(400, "question must be a non-empty string");
    const question = body.question.trim().slice(0, 2000);
    const iterator = getProvider().ask(caseId, question, data)[Symbol.asyncIterator]();
    const enc = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await iterator.next();
          if (done) controller.close();
          else controller.enqueue(enc.encode(value));
        } catch (e) {
          controller.enqueue(enc.encode(`\n[error] ${(e as Error).message}`));
          controller.close();
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  });
}
