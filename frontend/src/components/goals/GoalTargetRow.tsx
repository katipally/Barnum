"use client";

import { StatusLabel, cx } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { GoalScore } from "@/lib/types";
import { LabelTerm } from "@/components/memo/terms";
import { FieldError, LockIcon } from "./SteeringBlock";
import { UNIT_HINT } from "./steering";

function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function GoalTargetRow({
  goal,
  showStatus = true,
  value,
  onChange,
  error,
}: {
  goal: GoalScore;
  showStatus?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = `goal-${goal.id}`;
  const locked = goal.setBy === "board";
  const parsed = Number(value);
  const changed = !locked && value.trim() !== "" && Number.isFinite(parsed) && parsed !== goal.target;

  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_240px] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={locked ? undefined : id} className="text-sm text-ink">
            <LabelTerm label={goal.label} />
          </label>
          {showStatus && <StatusLabel status={goal.status} />}
        </div>
        <p className="mt-1 text-xs text-faint tabular">
          Now {fmt(goal.current, goal.unit)} · {goal.direction === "up" ? "higher is better" : "lower is better"} · by{" "}
          {shortDate(goal.deadline)} · set by {goal.setBy === "board" ? "the board" : "you"}
        </p>
      </div>

      {locked ? (
        <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
          <div className="text-sm text-ink tabular">{fmt(goal.target, goal.unit)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
            <LockIcon />
            Only the board can change this
          </div>
        </div>
      ) : (
        <div>
          <div
            className={cx(
              "flex items-center rounded-md border bg-surface-2 focus-within:border-ink/30",
              error ? "border-bad/60" : changed ? "border-line-strong" : "border-line",
            )}
          >
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-ink outline-none tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="shrink-0 pr-3 text-xs text-faint">{UNIT_HINT[goal.unit]}</span>
          </div>
          <FieldError id={`${id}-error`} message={error} />
          {!error && (
            <p id={`${id}-hint`} className="mt-1.5 text-xs text-faint tabular">
              {changed ? `Was ${fmt(goal.target, goal.unit)}, now ${fmt(parsed, goal.unit)}` : `Current target ${fmt(goal.target, goal.unit)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
