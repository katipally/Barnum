"use client";

import { Plan2027View } from "@/components/plan2027/Plan2027View";
import { PageHeader } from "@/components/strategy/PageHeader";
import { ErrorNote, Skeleton } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";

export default function PlanPage() {
  const caseId = useCaseId();
  const { data, error, loading } = useApi(() => api.plan2027(caseId), [caseId]);

  return (
    <section data-tour="steering" className="pb-4">
      <PageHeader
        page="2027 Plan"
        question="Where should the 2027 budget go?"
        answer="Give me your budget, revenue target, lead goal and brand share. I ask every channel agent what its data says, then propose a budget and the next campaign action for each channel."
      />
      {error ? (
        <ErrorNote message={`Could not load the plan. ${error}`} />
      ) : !data || loading ? (
        <div className="space-y-5">
          <Skeleton className="h-72" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <Plan2027View key={caseId} caseId={caseId} load={data} />
      )}
    </section>
  );
}
