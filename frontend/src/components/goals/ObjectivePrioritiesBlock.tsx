"use client";

import { StatusDot } from "@/components/ui";
import { LabelTerm } from "@/components/memo/terms";
import { fmt } from "@/lib/format";
import { SliderField } from "./SliderField";
import { FieldError, SteeringBlock } from "./SteeringBlock";
import { LIMITS, type PriorityRow, type SteeringErrors } from "./steering";

function level(p: number) {
  if (p === 0) return "Not a priority";
  if (p < 0.34) return "Low";
  if (p < 0.67) return "Medium";
  return "High";
}

export function ObjectivePrioritiesBlock({
  rows,
  priorities,
  errors,
  onChange,
}: {
  rows: PriorityRow[];
  priorities: Record<string, number>;
  errors: SteeringErrors;
  onChange: (id: string, v: number) => void;
}) {
  const total = rows.reduce((s, o) => s + (priorities[o.objective.id] ?? o.objective.priority), 0);

  return (
    <SteeringBlock
      title="What matters most right now"
      intro="When two aims compete for the same money, I favour the one you rate higher. Move a slider to shift my attention."
    >
      {!rows.length && <p className="text-sm text-muted">Nothing to prioritise yet.</p>}
      <div className="space-y-6">
        {rows.map(({ objective, status }) => {
          const p = priorities[objective.id] ?? objective.priority;
          const share = total > 0 ? (p / total) * 100 : 0;
          return (
            <div key={objective.id}>
              <SliderField
                id={`priority-${objective.id}`}
                label={<LabelTerm label={objective.label} />}
                value={p}
                display={level(p)}
                {...LIMITS.priority}
                changed={Math.abs(p - objective.priority) > 1e-9}
                onChange={(v) => onChange(objective.id, v)}
                explanation={
                  <span className="flex items-start gap-2">
                    {status ? (
                      <StatusDot status={status} className="mt-1.5" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong" aria-hidden />
                    )}
                    <span>
                      Gets {fmt(share, "pct")} of my attention. {objective.rationale}
                    </span>
                  </span>
                }
              />
            </div>
          );
        })}
      </div>
      <FieldError id="priorities-error" message={errors.priorities} />
    </SteeringBlock>
  );
}
