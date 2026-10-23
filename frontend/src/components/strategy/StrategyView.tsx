"use client";

import { useMemo, useState } from "react";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";
import type { Action, StrategyMap } from "@/lib/types";
import { Button, Card, ErrorNote, Skeleton } from "@/components/ui";
import { ActionDetail } from "./ActionDetail";
import { ChannelList } from "./ChannelList";
import { EmptyStrategy } from "./EmptyStrategy";
import { byBudget, DEFAULT_MIN_TEST_WEEKS, type Focus, moneyAnswer, pacingNote } from "./model";
import { PageFrame, PageHeader } from "./PageHeader";
import { Shortlist } from "./Shortlist";
import { MapLegend, StrategyMapGraph } from "./StrategyMapGraph";

const QUESTION = "Where is our money going, and is it working?";

export function StrategyView() {
  const caseId = useCaseId();
  const { data, error, loading } = useApi(() => api.strategy(caseId), [caseId]);
  const hasActions = !!data?.actions.length;
  const minTestWeeks = data?.guardrails?.minTestWeeks ?? DEFAULT_MIN_TEST_WEEKS;

  return (
    <PageFrame>
      <PageHeader
        page="Where the money goes"
        company={data?.case}
        question={QUESTION}
        answer={!data ? (error ? null : undefined) : hasActions ? moneyAnswer(data.actions, data.guardrails, minTestWeeks) : null}
        note={data && hasActions ? pacingNote(data.guardrails, data.case.week, data.case.weeksInPeriod) : null}
      />
      {error && <ErrorNote message={`Could not load where the money goes. ${error}`} />}
      {loading && !data && <StrategySkeleton />}
      {data && (hasActions ? <StrategyBody key={data.case.id} data={data} minTestWeeks={minTestWeeks} /> : <EmptyStrategy data={data} />)}
    </PageFrame>
  );
}

function StrategyBody({ data, minTestWeeks }: { data: StrategyMap; minTestWeeks: number }) {
  const [focus, setFocus] = useState<Focus>(null);
  const [showMap, setShowMap] = useState(false);
  const ranked = useMemo(() => byBudget(data.actions), [data.actions]);
  const selected = focus?.kind === "action" ? data.actions.find((a) => a.id === focus.id) : undefined;
  const select = (id: string | null) => setFocus(id ? { kind: "action", id } : null);

  const detail = (a: Action, onClose?: () => void) => (
    <ActionDetail
      action={a}
      all={data.actions}
      objectives={data.objectives}
      contributions={data.contributions}
      minTestWeeks={minTestWeeks}
      onClose={onClose}
    />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section data-tour="strategy-map" className="min-w-0 space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <h2 className="text-[13px] font-medium tracking-wide text-muted">Every channel, biggest budget first</h2>
            <span className="text-xs text-faint">Bar = budget · filled part = spent so far</span>
          </div>
          <ChannelList
            actions={ranked}
            all={data.actions}
            minTestWeeks={minTestWeeks}
            selectedId={selected?.id}
            onSelect={select}
            detail={(a) => detail(a)}
          />
        </div>

        <div>
          <Button variant="secondary" aria-expanded={showMap} onClick={() => setShowMap((s) => !s)}>
            {showMap ? "Hide how each channel feeds the goals" : "Show how each channel feeds the goals"}
          </Button>
          {showMap && (
            <Card className="mt-4 space-y-4 p-4 sm:p-5">
              <p className="text-sm text-muted">
                One channel can help several goals, and one goal gets help from several channels.
              </p>
              <MapLegend />
              <StrategyMapGraph
                objectives={data.objectives}
                actions={ranked}
                contributions={data.contributions}
                focus={focus}
                onFocus={setFocus}
                minTestWeeks={minTestWeeks}
              />
            </Card>
          )}
        </div>
      </section>

      <aside data-tour="action-detail" className="hidden min-w-0 lg:block">
        <Card className="lg:sticky lg:top-6">
          {selected ? (
            detail(selected, () => setFocus(null))
          ) : (
            <Shortlist actions={data.actions} minTestWeeks={minTestWeeks} onSelect={select} />
          )}
        </Card>
      </aside>
    </div>
  );
}

function StrategySkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="hidden h-[320px] lg:block" />
    </div>
  );
}
