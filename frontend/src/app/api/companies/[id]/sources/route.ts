import { type CompanyParams, handle, loadCase } from "@/server/http";
import { listSources } from "@/server/sources";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const { caseId, data } = await loadCase(params);
    return Response.json(await listSources(caseId, data));
  });
}
