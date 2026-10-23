import { askInDeepDive, assertCanAsk } from "@/server/deepDives";
import { HttpError, handle, isObj, ndjsonResponse, readJson, resolveCaseId } from "@/server/http";
import { getCase } from "@/server/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; deepDiveId: string }> };

// Same NDJSON contract as /ask, but the exchange is saved to the deep dive.
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const { deepDiveId } = await params;
    await assertCanAsk(caseId, deepDiveId); // 404 / 409 before the stream starts
    const body = await readJson(req);
    if (!isObj(body) || typeof body.question !== "string" || !body.question.trim())
      throw new HttpError(400, "question must be a non-empty string");
    return ndjsonResponse(askInDeepDive(caseId, deepDiveId, body.question.trim().slice(0, 2000), () => getCase(caseId)));
  });
}
