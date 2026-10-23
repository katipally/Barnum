import { toSummary } from "@/server/brief";
import { createCompany, listCompanies, parseCompanyInput } from "@/server/companies";
import { handle, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => Response.json(await listCompanies()));
}

export function POST(req: Request) {
  return handle(async () => {
    const input = parseCompanyInput(await readJson(req));
    return Response.json(toSummary(await createCompany(input)), { status: 201 });
  });
}
