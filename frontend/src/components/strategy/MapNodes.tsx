import type { Action, MarketingObjective, Status, Verdict } from "@/lib/types";
import { money, STATUS_TEXT } from "@/lib/format";
import { cx, StatusDot } from "@/components/ui";
import { VERDICT } from "./model";

type NodeState = { selected: boolean; dimmed: boolean };

const GOAL_WORD: Record<Status, string> = { on_track: "On track", at_risk: "Needs attention", off_track: "Off track" };

const nodeBase =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60";

function stateClass({ selected, dimmed }: NodeState) {
  return cx(selected ? "border-line-strong bg-surface-2" : "border-line hover:border-line-strong", dimmed && "opacity-30");
}

export function ObjectiveNode({
  objective,
  nodeRef,
  onClick,
  ...state
}: {
  objective: MarketingObjective & { status: Status };
  nodeRef: (el: HTMLElement | null) => void;
  onClick: () => void;
} & NodeState) {
  return (
    <button ref={nodeRef} onClick={onClick} aria-pressed={state.selected} className={cx(nodeBase, stateClass(state))}>
      <span className="block text-sm leading-snug text-ink">{objective.label}</span>
      <span className={cx("mt-1 flex items-center gap-1.5 text-xs", STATUS_TEXT[objective.status])}>
        <StatusDot status={objective.status} />
        {GOAL_WORD[objective.status]}
      </span>
    </button>
  );
}

export function ActionNode({
  action,
  verdict,
  nodeRef,
  onClick,
  ...state
}: {
  action: Action;
  verdict: Verdict;
  nodeRef: (el: HTMLElement | null) => void;
  onClick: () => void;
} & NodeState) {
  const v = VERDICT[verdict];
  return (
    <button ref={nodeRef} onClick={onClick} aria-pressed={state.selected} className={cx(nodeBase, stateClass(state))}>
      <span className="block text-sm leading-snug text-ink">{action.label}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        <span className={cx("inline-flex items-center gap-1.5", v.text)}>
          <span className={cx("inline-block h-1.5 w-1.5 rounded-full", v.dot)} />
          {v.word}
        </span>
        <span className="tabular text-faint">
          {action.spent == null ? "spend not tracked" : `${money(action.spent)} of ${money(action.budget)}`}
        </span>
      </span>
    </button>
  );
}
