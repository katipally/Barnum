"use client";

import { GoalsSteering } from "@/components/goals/GoalsSteering";
import { isAwaiting } from "@/components/empty/state";
import { ErrorNote, Skeleton } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";

export default function GoalsPage() {
  const caseId = useCaseId();
  const { data, error, setData } = useApi(() => api.brief(caseId), [caseId]);
  // Objectives without data have no scorecard row; the strategy map still lists them for priority steering.
  const strategy = useApi(() => api.strategy(caseId), [caseId]);
  const briefReady = data && data.case.id === caseId;
  const needsObjectives = briefReady && data.scorecard.length === 0;
  const objectivesReady = !needsObjectives || strategy.data?.case.id === caseId || !!strategy.error;
  const ready = briefReady && objectivesReady;
  const objectives = strategy.data?.case.id === caseId ? strategy.data.objectives : [];

  return (
    <section data-tour="steering" className="pb-4">
      <header className="mb-6">
        <h1 className="text-[30px] font-light leading-tight tracking-tight text-ink sm:text-[38px]">What should I aim for, and how much may I do on my own?</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          {briefReady && isAwaiting(data.case)
            ? `Start here. Set the goal, the budget and my limits for ${data.case.name} in ${data.case.periodLabel}. Once your data is connected, I'll suggest targets for the numbers behind the goal.`
            : `You set the goals and the limits; I plan within them${
                briefReady ? ` for ${data.case.name}, ${data.case.periodLabel} (week ${data.case.week} of ${data.case.weeksInPeriod})` : ""
              }. Nothing changes until you press Save.`}
        </p>
      </header>
      {error && !briefReady ? (
        <ErrorNote message={`Could not load your goals. ${error}`} />
      ) : !ready ? (
        <div className="space-y-5">
          <Skeleton className="h-64" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : (
        <GoalsSteering key={caseId} brief={data} objectives={objectives} onSaved={setData} />
      )}
    </section>
  );
}
