import { type CompanyParams, handle, loadCase } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => Response.json((await loadCase(params)).data.metrics));
}
