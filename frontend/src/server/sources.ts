// The data sources behind a company: from the provider for live companies, otherwise derived from the case data.
import type { CaseData, CaseId, DataSource } from "@/lib/types";
import { listDeepDives } from "./deepDives";
import { getProvider } from "./provider";

const KIND: [RegExp, DataSource["kind"]][] = [
  [/snowflake|warehouse|bigquery|redshift/i, "warehouse"],
  [/crm|hubspot|salesforce/i, "crm"],
  [/plan|budget|assumption/i, "plan"],
];
const kindOf = (name: string): DataSource["kind"] => KIND.find(([re]) => re.test(name))?.[1] ?? "other";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function derived(data: CaseData): DataSource[] {
  const status: DataSource["status"] = data.case.dataStatus === "connected" ? "connected" : "sample";
  // Metric sources look like "Snowflake: FUNNEL_FACT"; group by system, list the tables.
  const systems = new Map<string, { tables: Set<string>; metrics: string[] }>();
  for (const m of data.metrics) {
    const [system, table] = m.source.split(/:\s*/, 2);
    const s = systems.get(system) ?? { tables: new Set(), metrics: [] };
    if (table) s.tables.add(table);
    s.metrics.push(m.label);
    systems.set(system, s);
  }
  const fromMetrics = [...systems].map(([name, s]): DataSource => ({
    id: `src-${slug(name)}`,
    name,
    kind: kindOf(name),
    status,
    provides: `${s.metrics.length} of the numbers we watch.`,
    usedFor: s.metrics.slice(0, 5),
    detail: s.tables.size ? [...s.tables].join(", ") : undefined,
  }));
  const channels = new Map<string, typeof data.actions>();
  for (const a of data.actions) channels.set(a.channel, [...(channels.get(a.channel) ?? []), a]);
  const fromChannels = [...channels].map(([channel, acts]): DataSource => ({
    id: `channel-${slug(channel)}`,
    name: channel,
    kind: "channel",
    status: acts.every((a) => a.status === "paused") ? "paused" : status,
    provides: `Spend and ${acts[0].resultLabel}s for ${acts.length === 1 ? "one campaign" : `${acts.length} campaigns`}.`,
    usedFor: acts.slice(0, 5).map((a) => a.label),
  }));
  return [...fromMetrics, ...fromChannels];
}

export async function listSources(caseId: CaseId, data: CaseData): Promise<DataSource[]> {
  const live = (await getProvider().listSources?.(caseId)) ?? null;
  const base = live ?? (data.case.dataStatus === "awaiting_data" ? [] : derived(data));
  const dives = (await listDeepDives(caseId, data)).deepDives;
  const written = dives.filter((d) => d.answer);
  const notes: DataSource = {
    id: "deep-dive-notes",
    name: "Deep dive notes",
    kind: "notes",
    status: written.length ? "connected" : "not_connected",
    provides: written.length
      ? "Conclusions from our deep dives. I read these before answering, so we build on what we already agreed."
      : "Write up a deep dive and its conclusion lands here. I read these before answering.",
    usedFor: written.slice(0, 5).map((d) => d.title),
    detail: `${written.length} written up, ${dives.length} in total`,
    updatedAt: dives[0]?.updatedAt,
  };
  return [...base, notes];
}
