import { askInDeepDive, assertCanAsk } from "@/server/deepDives";
import { HttpError, handle, isObj, loadCase, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; deepDiveId: string }> };

// Same streamed text/plain contract as /ask, but the exchange is saved to the deep dive.
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const { caseId, data } = await loadCase(params);
    const { deepDiveId } = await params;
    await assertCanAsk(caseId, deepDiveId); // 404 / 409 before the stream starts
    const body = await readJson(req);
    if (!isObj(body) || typeof body.question !== "string" || !body.question.trim())
      throw new HttpError(400, "question must be a non-empty string");
    const iterator = askInDeepDive(caseId, deepDiveId, body.question.trim().slice(0, 2000), data)[Symbol.asyncIterator]();
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
        await iterator.return?.(undefined);
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  });
}
