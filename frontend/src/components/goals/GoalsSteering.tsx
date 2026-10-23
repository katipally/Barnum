"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { MarketingObjective, WeeklyBrief } from "@/lib/types";
import { isAwaiting } from "@/components/empty/state";
import { BusinessGoalsBlock } from "./BusinessGoalsBlock";
import { GuardrailsBlock } from "./GuardrailsBlock";
import { ObjectivePrioritiesBlock } from "./ObjectivePrioritiesBlock";
import { SaveBar, type SaveResult } from "./SaveBar";
import { buildUpdate, countChanges, draftFromBrief, priorityRows, validate, type SteeringDraft } from "./steering";

// Holds the draft for one case (mount with key={caseId}); saves only changed fields.
// `objectives` covers companies whose objectives have no scorecard row yet (no data connected).
export function GoalsSteering({
  brief,
  objectives,
  onSaved,
}: {
  brief: WeeklyBrief;
  objectives: MarketingObjective[];
  onSaved: (b: WeeklyBrief) => void;
}) {
  const [fallback, setFallback] = useState(objectives);
  const rows = useMemo(() => priorityRows(brief, fallback), [brief, fallback]);
  const [draft, setDraft] = useState<SteeringDraft>(() => draftFromBrief(brief, rows));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SaveResult | null>(null);

  const errors = useMemo(() => validate(draft, brief), [draft, brief]);
  const update = useMemo(() => buildUpdate(draft, brief, rows), [draft, brief, rows]);
  const changes = countChanges(update);
  const invalid = Object.keys(errors).length > 0;

  const edit = (fn: (d: SteeringDraft) => SteeringDraft) => {
    setDraft(fn);
    setSaved(null);
    setError(null);
  };

  const save = async () => {
    if (invalid || changes === 0) return;
    setSaving(true);
    setError(null);
    try {
      const next = await api.steer(brief.case.id, update);
      const saved = new Map((update.objectivePriorities ?? []).map((p) => [p.id, p.priority]));
      const nextFallback = fallback.map((o) => ({ ...o, priority: saved.get(o.id) ?? o.priority }));
      setFallback(nextFallback);
      onSaved(next);
      setDraft(draftFromBrief(next, priorityRows(next, nextFallback)));
      setSaved({ overall: next.overall, previous: brief.overall, count: changes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <BusinessGoalsBlock
        goals={brief.goals}
        showStatus={!isAwaiting(brief.case)}
        values={draft.goals}
        errors={errors}
        onChange={(id, v) => edit((d) => ({ ...d, goals: { ...d.goals, [id]: v } }))}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <GuardrailsBlock
          guardrails={brief.guardrails}
          company={brief.case}
          draft={draft}
          errors={errors}
          onChange={(key, v) => edit((d) => ({ ...d, [key]: v }))}
        />
        <ObjectivePrioritiesBlock
          rows={rows}
          priorities={draft.priorities}
          errors={errors}
          onChange={(id, v) => edit((d) => ({ ...d, priorities: { ...d.priorities, [id]: v } }))}
        />
      </div>
      <SaveBar
        changes={changes}
        invalid={invalid}
        saving={saving}
        error={error}
        saved={saved}
        showStatus={!isAwaiting(brief.case)}
        onSave={save}
        onReset={() => edit(() => draftFromBrief(brief, rows))}
      />
    </div>
  );
}
