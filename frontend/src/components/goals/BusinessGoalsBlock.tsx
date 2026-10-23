"use client";

import type { GoalScore } from "@/lib/types";
import { GoalTargetRow } from "./GoalTargetRow";
import { SteeringBlock } from "./SteeringBlock";
import type { SteeringErrors } from "./steering";

export function BusinessGoalsBlock({
  goals,
  showStatus,
  values,
  errors,
  onChange,
}: {
  goals: GoalScore[];
  showStatus: boolean;
  values: Record<string, string>;
  errors: SteeringErrors;
  onChange: (id: string, v: string) => void;
}) {
  return (
    <SteeringBlock
      title="Your goals"
      hint={goals.length === 1 ? "1 goal" : `${goals.length} goals`}
      intro="What the business wants to achieve. Change a target and I rebuild the plan to reach it."
    >
      <div className="divide-y divide-line">
        {goals.map((g) => (
          <GoalTargetRow
            key={g.id}
            goal={g}
            showStatus={showStatus}
            value={values[g.id] ?? ""}
            error={errors[`goal:${g.id}`]}
            onChange={(v) => onChange(g.id, v)}
          />
        ))}
      </div>
    </SteeringBlock>
  );
}
