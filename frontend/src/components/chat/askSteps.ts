import type { AskEvent } from "@/lib/types";

// One row of the live progress list. `thinking` rows are the agent's current planning phase; they never outlive it.
export interface AskStep {
  label: string;
  startedAt: number;
  endedAt?: number;
  thinking?: boolean;
  id?: string; // tool_use_id: such a row is closed by its own tool_done, so parallel calls finish independently
  detail?: string;
  seconds?: number;
  failed?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  status: "Checking funnel status",
  list_channels: "Listing channels",
  unit_econ: "Running unit economics",
  propose_reallocation: "Drafting a budget move",
  data_to_chart: "Building chart",
  plan_2027: "Planning budget (plan_2027)",
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

const finish = (steps: AskStep[], now: number, keepTracked = false) =>
  steps.filter((s) => !s.thinking).map((s) => (s.endedAt || (keepTracked && s.id) ? s : { ...s, endedAt: now }));

const HEARTBEAT = /^Still working on /;

export function nextSteps(steps: AskStep[], e: AskEvent, now: number): AskStep[] {
  switch (e.type) {
    case "meta":
      return steps;
    case "status": {
      if (HEARTBEAT.test(e.message)) {
        const running = steps.findLastIndex((s) => !s.thinking && !s.endedAt);
        const at = running >= 0 ? running : steps.findLastIndex((s) => s.thinking);
        return steps.map((s, i) => (i === at ? { ...s, detail: e.message } : s));
      }
      // A status line after an untracked tool call means that tool returned; tracked ones wait for their tool_done.
      const think = steps.find((s) => s.thinking);
      return [...finish(steps, now, true), { label: e.message, startedAt: think?.startedAt ?? now, thinking: true }];
    }
    case "tool":
      return [...steps.filter((s) => !s.thinking), { label: toolLabel(e.name, e.input), startedAt: now, id: e.toolUseId }];
    case "tool_done":
      return steps.map((s) =>
        s.id === e.toolUseId && !s.endedAt ? { ...s, endedAt: now, seconds: e.seconds, failed: !e.ok, detail: undefined } : s,
      );
    default:
      return finish(steps, now);
  }
}
