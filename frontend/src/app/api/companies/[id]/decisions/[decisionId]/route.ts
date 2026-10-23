import { withActionLabels } from "@/server/brief";
import { decide, getCase } from "@/server/store";
import { HttpError, handle, isObj, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; decisionId: string }> };

export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const { decisionId } = await params;
    const body = await readJson(req);
    if (!isObj(body) || (body.status !== "approved" && body.status !== "rejected"))
      throw new HttpError(400, 'status must be "approved" or "rejected"');
    if (body.note !== undefined && body.note !== null && typeof body.note !== "string")
      throw new HttpError(400, "note must be a string");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || undefined : undefined;
    const decision = await decide(caseId, decisionId, body.status, note);
    return Response.json(withActionLabels(decision, (await getCase(caseId)).actions));
  });
}
