import { getPlan2027 } from "@/server/provider";
import { type CompanyParams, HttpError, handle, isObj, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const channelId = new URL(req.url).searchParams.get("channelId");
    if (!channelId) throw new HttpError(400, "channelId is required");
    return Response.json(await getPlan2027(caseId).campaigns(caseId, channelId));
  });
}

// Creates a stub campaign draft for one channel of a saved plan. Nothing is launched.
export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const b = await readJson(req);
    if (!isObj(b) || typeof b.planId !== "string" || typeof b.channelId !== "string") throw new HttpError(400, "planId and channelId are required");
    return Response.json(await getPlan2027(caseId).draft(caseId, b.planId, b.channelId));
  });
}
