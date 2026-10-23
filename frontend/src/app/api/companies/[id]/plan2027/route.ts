import { getPlan2027 } from "@/server/provider";
import { getCase } from "@/server/store";
import { type CompanyParams, HttpError, handle, isNum, isObj, ndjsonResponse, readJson, resolveCaseId } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    return Response.json(await getPlan2027(caseId).load(caseId));
  });
}

// NDJSON: one PlanEvent per line, as the CMO agent plans.
export function POST(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const b = await readJson(req);
    if (!isObj(b) || !isNum(b.budget_usd) || !isNum(b.revenue_target_usd) || !isNum(b.sqls_per_quarter) || !isNum(b.brand_pct))
      throw new HttpError(400, "budget_usd, revenue_target_usd, sqls_per_quarter and brand_pct must be numbers");
    if (b.budget_usd <= 0 || b.revenue_target_usd <= 0 || b.sqls_per_quarter < 0 || b.brand_pct < 0 || b.brand_pct > 1)
      throw new HttpError(400, "Inputs out of range");
    const inputs = { budget_usd: b.budget_usd, revenue_target_usd: b.revenue_target_usd, sqls_per_quarter: b.sqls_per_quarter, brand_pct: b.brand_pct };
    return ndjsonResponse(getPlan2027(caseId).run(caseId, inputs, () => getCase(caseId)));
  });
}
