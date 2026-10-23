import { type CompanyParams, handle, resolveCaseId } from "@/server/http";
import { mondayBrief } from "@/server/mondayBrief";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => Response.json(await mondayBrief(await resolveCaseId(params))));
}

export function POST(_req: Request, { params }: CompanyParams) {
  return handle(async () => Response.json(await mondayBrief(await resolveCaseId(params), true)));
}
