import { deleteDeepDive, getDeepDive } from "@/server/deepDives";
import { handle, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; deepDiveId: string }> };

export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    return Response.json(await getDeepDive(caseId, (await params).deepDiveId));
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    await deleteDeepDive(caseId, (await params).deepDiveId);
    return Response.json({ ok: true });
  });
}
