import { deleteCompany } from "@/server/companies";
import { deleteDeepDivesFor } from "@/server/deepDives";
import { type CompanyParams, handle } from "@/server/http";
import { evictCase } from "@/server/store";

export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const { id } = await params;
    await deleteCompany(id);
    evictCase(id);
    await deleteDeepDivesFor(id);
    return Response.json({ ok: true });
  });
}
