import { getProvider } from "@/server/provider";
import { getCase } from "@/server/store";
import { type CompanyParams, HttpError, handle, isObj, ndjsonResponse, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

// NDJSON: one AskEvent per line. The company data loads lazily, so live agents start streaming at once.
export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const body = await readJson(req);
    if (!isObj(body) || typeof body.question !== "string" || !body.question.trim())
      throw new HttpError(400, "question must be a non-empty string");
    const question = body.question.trim().slice(0, 2000);
    return ndjsonResponse(getProvider().ask(caseId, question, () => getCase(caseId)));
  });
}
