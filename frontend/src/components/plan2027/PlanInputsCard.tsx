"use client";

import { useState } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { FieldError } from "@/components/goals/SteeringBlock";
import { SliderField } from "@/components/goals/SliderField";
import { money } from "@/lib/format";
import type { PlanInputs } from "@/lib/types";
import { BRAND_MAX_PCT, BUDGET_RANGE, draftFrom, groupDigits, inputsFrom, parseMoney, validate, type InputsDraft } from "./plan";

const INPUT = "w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink tabular placeholder:text-faint focus:border-accent focus:outline-none";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function PlanInputsCard({ initial, running, lastPlanAt, onRun }: { initial: PlanInputs; running: boolean; lastPlanAt?: string; onRun: (i: PlanInputs) => void }) {
  const [draft, setDraft] = useState<InputsDraft>(() => draftFrom(initial));
  const [touched, setTouched] = useState(false);
  const errors = validate(draft);
  const invalid = Object.keys(errors).length > 0;
  const shown = touched ? errors : {};
  const set = (patch: Partial<InputsDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const budget = parseMoney(draft.budget);
  const tidy = (k: "budget" | "revenue") => () => {
    const n = parseMoney(draft[k]);
    if (Number.isFinite(n)) set({ [k]: groupDigits(n) });
  };

  return (
    <Card className="p-5">
      <SectionTitle hint={lastPlanAt ? `Last plan: ${new Date(lastPlanAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : undefined}>
        Inputs
      </SectionTitle>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid && !running) onRun(inputsFrom(draft));
        }}
      >
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <div className="min-w-0">
            <SliderField
              id="plan-budget-slider"
              label="Marketing budget 2027"
              value={Math.min(BUDGET_RANGE.max, Math.max(BUDGET_RANGE.min, Number.isFinite(budget) ? budget : BUDGET_RANGE.min))}
              display={Number.isFinite(budget) ? money(budget) : "Invalid"}
              {...BUDGET_RANGE}
              scale={[money(BUDGET_RANGE.min), money(BUDGET_RANGE.max)]}
              onChange={(v) => set({ budget: groupDigits(v) })}
            />
            <input
              id="plan-budget"
              aria-label="Marketing budget 2027, exact amount in dollars"
              inputMode="decimal"
              autoComplete="off"
              value={draft.budget}
              onChange={(e) => set({ budget: e.target.value })}
              onBlur={tidy("budget")}
              aria-invalid={!!shown.budget}
              aria-describedby={shown.budget ? "plan-budget-error" : undefined}
              className={`${INPUT} mt-3`}
            />
            <FieldError id="plan-budget-error" message={shown.budget} />
          </div>
          <SliderField
            id="plan-brand"
            label="Brand impressions allocation"
            value={draft.brandPct}
            display={`${draft.brandPct}%${Number.isFinite(budget) ? ` · ${money((budget * draft.brandPct) / 100)}` : ""}`}
            min={0}
            max={BRAND_MAX_PCT}
            step={1}
            scale={["0%", `${BRAND_MAX_PCT}%`]}
            explanation="The share of the budget kept for brand building, which is not measured in SQLs."
            onChange={(v) => set({ brandPct: v })}
          />
          <Field id="plan-revenue" label="Revenue target" error={shown.revenue} hint="New ARR you want 2027 spend to bring in.">
            <input
              id="plan-revenue"
              inputMode="decimal"
              autoComplete="off"
              value={draft.revenue}
              onChange={(e) => set({ revenue: e.target.value })}
              onBlur={tidy("revenue")}
              aria-invalid={!!shown.revenue}
              aria-describedby={shown.revenue ? "plan-revenue-error" : undefined}
              className={INPUT}
            />
          </Field>
          <Field id="plan-sqls" label="Sales leads (SQLs) per quarter" error={shown.sqls} hint="Sales-qualified leads you need each quarter.">
            <input
              id="plan-sqls"
              inputMode="numeric"
              autoComplete="off"
              value={draft.sqls}
              onChange={(e) => set({ sqls: e.target.value })}
              aria-invalid={!!shown.sqls}
              aria-describedby={shown.sqls ? "plan-sqls-error" : undefined}
              className={INPUT}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={running || (touched && invalid)}>
            {running ? "Planning" : "Build 2027 plan"}
          </Button>
          <p className="min-w-0 text-xs text-faint">Your inputs are saved when the CMO starts planning.</p>
        </div>
      </form>
    </Card>
  );
}
