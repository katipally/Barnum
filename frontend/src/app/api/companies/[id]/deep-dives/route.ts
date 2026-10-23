import { createDeepDive, listDeepDives } from "@/server/deepDives";
import { type CompanyParams, HttpError, handle, isObj, loadCase, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const { caseId, data } = await loadCase(params);
    return Response.json(await listDeepDives(caseId, data));
  });
}

export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const body = await readJson(req);
    if (!isObj(body) || (body.title !== undefined && typeof body.title !== "string"))
      throw new HttpError(400, "title must be a string");
    return Response.json(await createDeepDive(caseId, typeof body.title === "string" ? body.title.slice(0, 200) : undefined), { status: 201 });
  });
}
