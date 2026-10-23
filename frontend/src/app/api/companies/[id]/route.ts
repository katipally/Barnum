import { deleteCompany } from "@/server/companies";
import { type CompanyParams, handle } from "@/server/http";
import { evictCase } from "@/server/store";

export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const { id } = await params;
    await deleteCompany(id);
    evictCase(id);
    return Response.json({ ok: true });
  });
}
