"use client";

import type { CaseId } from "@/lib/types";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";
import { ErrorNote } from "@/components/ui";
import { isAwaiting } from "@/components/empty/state";
import { AwaitingBreakdown } from "./AwaitingBreakdown";
import { BriefSkeleton } from "./BriefSkeleton";
import { Changes } from "./Changes";
import { EquationSection } from "./Equation";
import { GoalHeader } from "./GoalHeader";
import { Objectives } from "./Objectives";
import { gapPath } from "./shared";

// "How we reach the goal": the goal, the equation behind it, what marketing works on, and what changed.
export function BreakdownView() {
  const caseId = useCaseId();
  return (
    <div className="mx-auto w-full max-w-[1180px] py-2">
      <Breakdown key={caseId} caseId={caseId} />
    </div>
  );
}

function Breakdown({ caseId }: { caseId: CaseId }) {
  const { data: brief, error } = useApi(() => api.brief(caseId), [caseId]);

  if (!brief) return error ? <ErrorNote message={`Could not load the breakdown. ${error}`} /> : <BriefSkeleton />;
  if (isAwaiting(brief.case)) return <AwaitingBreakdown brief={brief} />;

  const gap = gapPath(brief.tree);

  return (
    <div className="space-y-12">
      {error && <ErrorNote message={`Showing the last loaded numbers. ${error}`} />}
      <GoalHeader brief={brief} gap={gap} />
      <EquationSection tree={brief.tree} gap={gap} periodLabel={brief.case.periodLabel} />
      <div className="grid items-start gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Objectives scorecard={brief.scorecard} caseId={caseId} />
        <Changes changes={brief.changes} />
      </div>
    </div>
  );
}
