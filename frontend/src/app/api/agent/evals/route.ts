import { agentEvals } from "@/server/agentEvals";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await agentEvals());
}
