import type { SteeringUpdate } from "@/lib/types";
import { buildBrief } from "@/server/brief";
import { type CompanyParams, HttpError, handle, isNum, isObj, readJson, resolveCaseId } from "@/server/http";
import { steer } from "@/server/store";

export const dynamic = "force-dynamic";

function parse(body: unknown): SteeringUpdate {
  if (!isObj(body)) throw new HttpError(400, "Body must be a SteeringUpdate object");
  const out: SteeringUpdate = {};
  if (body.goals !== undefined) {
    if (!Array.isArray(body.goals) || !body.goals.every((g) => isObj(g) && typeof g.id === "string" && isNum(g.target)))
      throw new HttpError(400, "goals must be [{ id: string, target: number }]");
    out.goals = body.goals as SteeringUpdate["goals"];
  }
  if (body.objectivePriorities !== undefined) {
    const ok =
      Array.isArray(body.objectivePriorities) &&
      body.objectivePriorities.every((o) => isObj(o) && typeof o.id === "string" && isNum(o.priority));
    if (!ok) throw new HttpError(400, "objectivePriorities must be [{ id: string, priority: number }]");
    out.objectivePriorities = body.objectivePriorities as SteeringUpdate["objectivePriorities"];
  }
  if (body.guardrails !== undefined) {
    const g = body.guardrails;
    if (!isObj(g)) throw new HttpError(400, "guardrails must be an object");
    const allowed = ["budgetTotal", "autonomyPct", "brandFloorPct"] as const;
    const extra = Object.keys(g).filter((k) => !(allowed as readonly string[]).includes(k));
    if (extra.length) throw new HttpError(400, `guardrails: unsupported keys ${extra.join(", ")}`);
    const bad = allowed.filter((k) => g[k] !== undefined && !isNum(g[k]));
    if (bad.length) throw new HttpError(400, `guardrails: ${bad.join(", ")} must be numbers`);
    out.guardrails = g as SteeringUpdate["guardrails"];
  }
  return out;
}

export function PATCH(req: Request, { params }: CompanyParams) {
  return handle(async () => {
    const caseId = await resolveCaseId(params);
    const update = parse(await readJson(req));
    return Response.json(buildBrief(await steer(caseId, update)));
  });
}
