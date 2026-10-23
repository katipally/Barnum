import { writeUp } from "@/server/deepDives";
import { handle, loadCase } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; deepDiveId: string }> };

export function POST(_req: Request, { params }: Params) {
  return handle(async () => {
    const { caseId, data } = await loadCase(params);
    return Response.json(await writeUp(caseId, (await params).deepDiveId, data));
  });
}
