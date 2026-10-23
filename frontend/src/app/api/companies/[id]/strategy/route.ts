import { buildStrategy } from "@/server/brief";
import { type CompanyParams, handle, loadCase } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => Response.json(buildStrategy((await loadCase(params)).data)));
}
