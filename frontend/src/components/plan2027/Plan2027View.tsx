"use client";

import Link from "next/link";
import { AskProgress } from "@/components/chat/AskProgress";
import { Button, Card, ErrorNote, SectionTitle, Skeleton } from "@/components/ui";
import { withCase } from "@/lib/case";
import type { CaseId, Plan2027Load } from "@/lib/types";
import { ChannelPlanCard } from "./ChannelPlanCard";
import { PlanInputsCard } from "./PlanInputsCard";
import { PlanSummary } from "./PlanSummary";
import { usePlan2027 } from "./usePlan2027";

// Inputs, then the CMO agent working, then its per-channel budgets and campaign actions.
export function Plan2027View({ caseId, load }: { caseId: CaseId; load: Plan2027Load }) {
  const { view, run, running, start, retry } = usePlan2027(caseId, load.saved);
  const planning = running;
  const planned = view && view.channels.length > 0;
  const stopped = run?.status === "error" && !planned;
  const empty = view && !planned && run && run.status !== "running" && !stopped;

  return (
    <div className="space-y-5">
      {load.notice && <ErrorNote message={load.notice} />}
      <PlanInputsCard initial={load.inputs} running={running} lastPlanAt={view?.createdAt} onRun={start} />

      {run && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tracking-wide text-accent">
            <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-accent" />
            CMO agent
            {run.model && <span className="break-all font-normal text-faint">· {run.model}</span>}
            {!load.live && <span className="chip">Sample company, simulated plan</span>}
          </div>
          <AskProgress steps={run.steps} startedAt={run.startedAt} endedAt={run.endedAt} failed={run.status === "error"} />
          {run.error && (
            <div className="space-y-3">
              <ErrorNote message={`The plan stopped early. ${planned ? "The numbers that arrived are kept below. " : ""}${run.error}`} />
              <Button variant="secondary" onClick={retry}>
                Retry
              </Button>
            </div>
          )}
        </Card>
      )}

      {stopped ? null : !view ? (
        <Card className="p-5">
          <SectionTitle>Plan</SectionTitle>
          <p className="text-sm text-muted">No plan yet. Set your inputs and press Build 2027 plan; the CMO asks every channel agent, then proposes a budget and actions for each channel.</p>
        </Card>
      ) : empty ? (
        <Card className="p-5">
          <SectionTitle>Plan</SectionTitle>
          <p className="text-sm text-muted">
            The CMO found no channels to plan. Connect channel data under{" "}
            <Link href={withCase("/sources", caseId)} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
              Data sources
            </Link>{" "}
            and build the plan again.
          </p>
        </Card>
      ) : (
        <>
          <PlanSummary totals={view.totals} targets={view.targets} summary={view.summary} running={planning} />
          <section aria-label="Channel plan" className="space-y-4">
            <SectionTitle hint={planned ? `${view.channels.length} channels` : undefined}>Channel plan</SectionTitle>
            {planned ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {view.channels.map((c) => (
                  <ChannelPlanCard key={c.channel_id} caseId={caseId} channel={c} planId={view.planId} planning={planning} />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
