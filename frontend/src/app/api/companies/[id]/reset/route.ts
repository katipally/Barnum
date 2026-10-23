// Drops decisions/steering for a company; user companies get a fresh template from their onboarding input.
import { buildBrief } from "@/server/brief";
import { type CompanyParams, handle, resolveCaseId } from "@/server/http";
import { getCase, resetCase } from "@/server/store";

export const dynamic = "force-dynamic";

export function POST(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    await resetCase(caseId);
    return Response.json(buildBrief(await getCase(caseId)));
  });
}
