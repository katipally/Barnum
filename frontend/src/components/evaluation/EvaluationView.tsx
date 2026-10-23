"use client";

import { useMemo } from "react";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";
import type { CompanyCase, MarketingObjective, Metric, Status } from "@/lib/types";
import { fmt, STATUS_TEXT } from "@/lib/format";
import { cx, ErrorNote, Skeleton, StatusDot } from "@/components/ui";
import { AwaitingData } from "@/components/empty/AwaitingData";
import { isAwaiting } from "@/components/empty/state";
import { PageFrame, PageHeader } from "@/components/strategy/PageHeader";
import { JudgingHeuristics } from "./JudgingHeuristics";
import { MetricCard } from "./MetricCard";
import { inSentence } from "./metricCopy";
import { attainment, hasTarget, latestValue, metricStatus, STATUS_WORD } from "./metricStatus";

type Objective = MarketingObjective & { status: Status };
type Group = { objective?: Objective; metrics: Metric[] };

const QUESTION = "Are the numbers that matter moving the right way?";

export function EvaluationView() {
  const caseId = useCaseId();
  const metrics = useApi(() => api.metrics(caseId), [caseId]);
  // Strategy only supplies goal labels; metrics still render if it fails.
  const strategy = useApi(() => api.strategy(caseId), [caseId]);

  const groups = useMemo<Group[]>(() => {
    if (!metrics.data) return [];
    const objectives = strategy.data?.objectives ?? [];
    const byObjective = new Map<string, Metric[]>();
    for (const m of metrics.data) byObjective.set(m.objectiveId, [...(byObjective.get(m.objectiveId) ?? []), m]);
    const out: Group[] = [];
    for (const o of objectives) {
      const ms = byObjective.get(o.id);
      if (!ms) continue;
      byObjective.delete(o.id);
      out.push({ objective: o, metrics: sortMetrics(ms, o) });
    }
    const rest = [...byObjective.values()].flat();
    if (rest.length) out.push({ metrics: rest });
    return out;
  }, [metrics.data, strategy.data]);

  const c = strategy.data?.case;
  const answer = metrics.data ? (metrics.data.length ? summary(metrics.data) : null) : metrics.error ? null : undefined;

  return (
    <PageFrame>
      <PageHeader page="Numbers we watch" company={c} question={QUESTION} answer={answer} />
      {metrics.error && <ErrorNote message={`Could not load the numbers. ${metrics.error}`} />}

      <section data-tour="evaluation" className="space-y-12">
        {metrics.loading && !metrics.data && <EvaluationSkeleton />}
        {groups.map((g) => (
          <div key={g.objective?.id ?? "other"}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base text-ink">
                {g.objective ? (
                  <>
                    <span className="text-muted">Goal: </span>
                    {g.objective.label}
                  </>
                ) : strategy.loading ? (
                  "Loading goal"
                ) : (
                  "Other numbers"
                )}
              </h2>
              {g.objective && (
                <span className={cx("inline-flex items-center gap-1.5 text-xs", STATUS_TEXT[g.objective.status])}>
                  <StatusDot status={g.objective.status} />
                  {STATUS_WORD[g.objective.status]}
                </span>
              )}
            </div>
            {g.objective && <p className="mb-4 max-w-[760px] text-sm text-muted">{g.objective.rationale}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.metrics.map((m) => (
                <MetricCard key={m.id} metric={m} northStar={g.objective?.northStarMetricId === m.id} />
              ))}
            </div>
          </div>
        ))}
        {metrics.data && !metrics.data.length && <NoMetrics company={c} />}
      </section>

      {!!metrics.data?.length && <JudgingHeuristics />}
    </PageFrame>
  );
}

// One sentence: how many numbers are behind, and which is furthest off.
function summary(ms: Metric[]): string {
  const judged = ms.filter((m) => metricStatus(m) != null);
  const unset = ms.length - judged.length;
  const tail = unset ? ` ${unset} more ${unset === 1 ? "has" : "have"} no target yet.` : "";
  if (!judged.length) return "No targets are set yet, so I can't say which numbers are behind. Set them on the goals page.";
  const behind = judged.filter((m) => metricStatus(m) !== "on_track");
  if (!behind.length) return `All ${judged.length} numbers with a target are on track.${tail}`;
  const worst = [...behind].sort((a, b) => (attainment(a) ?? 1) - (attainment(b) ?? 1))[0];
  const v = latestValue(worst);
  const detail =
    v != null && hasTarget(worst)
      ? ` (${fmt(v, worst.unit)} against a target of ${fmt(worst.target, worst.unit)}${worst.direction === "down" ? " or lower" : ""})`
      : "";
  return `${behind.length} of ${judged.length} numbers are behind target. Furthest off: ${inSentence(worst.label)}${detail}.${tail}`;
}

function NoMetrics({ company }: { company?: CompanyCase }) {
  const sentence = "No numbers yet. Once your data is connected I'll track every number behind your goals here, each week.";
  if (company && isAwaiting(company)) return <AwaitingData stage={company.stage} sentence={sentence} />;
  return <p className="text-sm text-muted">{sentence}</p>;
}

// Main number first, then results, then early signals.
function sortMetrics(ms: Metric[], o: Objective) {
  const rank = (m: Metric) => (m.id === o.northStarMetricId ? 0 : m.lagging ? 1 : 2);
  return [...ms].sort((a, b) => rank(a) - rank(b));
}

function EvaluationSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
