import type { AskEvent } from "@/lib/types";

// One row of the live progress list. `thinking` rows are the agent's current planning phase; they never outlive it.
export interface AskStep {
  label: string;
  startedAt: number;
  endedAt?: number;
  thinking?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  status: "Checking funnel status",
  list_channels: "Listing channels",
  unit_econ: "Running unit economics",
  propose_reallocation: "Drafting a budget move",
  data_to_chart: "Building chart",
};

const words = (id: string) => id.replace(/[_-]+/g, " ").trim();
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toolLabel(name: string, input?: Record<string, unknown>): string {
  if (name === "ask_channel") {
    const id = typeof input?.channel_id === "string" ? words(input.channel_id) : "";
    return id ? `Asking ${sentence(id)} agent` : "Asking a channel agent";
  }
  if (/funnel/i.test(name)) return "Querying funnel (Cortex Analyst)";
  return TOOL_LABELS[name] ?? sentence(words(name.replace(/([a-z])([A-Z])/g, "$1 $2")).toLowerCase());
}

const finish = (steps: AskStep[], now: number) =>
  steps.filter((s) => !s.thinking).map((s) => (s.endedAt ? s : { ...s, endedAt: now }));

export function nextSteps(steps: AskStep[], e: AskEvent, now: number): AskStep[] {
  switch (e.type) {
    case "status": {
      // A status line after a tool call means that tool returned.
      const think = steps.find((s) => s.thinking);
      return [...finish(steps, now), { label: e.message, startedAt: think?.startedAt ?? now, thinking: true }];
    }
    case "tool":
      return [...steps.filter((s) => !s.thinking), { label: toolLabel(e.name, e.input), startedAt: now }];
    default:
      return finish(steps, now);
  }
}
