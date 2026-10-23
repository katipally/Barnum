"use client";

import { Term } from "@/components/ui/Term";
import { money } from "@/lib/format";
import { Field, FormSection, SelectInput, TextInput } from "./Field";
import { AUTONOMY_MAX, INDUSTRIES, UNITS, parseNumber, todayIso, type GoalUnit } from "./formModel";
import { StageCards } from "./StageCards";
import type { CompanyForm } from "./useCompanyForm";

export function CompanySection({ f }: { f: CompanyForm }) {
  const { values: v, set, error, blur } = f;
  return (
    <FormSection step={1} title="Company" description="What you sell and how far along you are, so I know what to focus on.">
      <Field id="name" label="Company name" error={error("name")}>
        <TextInput id="name" value={v.name} onChange={(e) => set("name", e.target.value)} onBlur={blur("name")} autoComplete="organization" error={error("name")} />
      </Field>
      <Field id="website" label="Website" optional error={error("website")}>
        <TextInput id="website" value={v.website} onChange={(e) => set("website", e.target.value)} onBlur={blur("website")} placeholder="example.com" inputMode="url" autoComplete="url" error={error("website")} />
      </Field>
      <Field id="tagline" label="What you sell" hint="One line, the way you'd say it to a customer." error={error("tagline")}>
        <TextInput id="tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} onBlur={blur("tagline")} placeholder="Label printers for small warehouses" error={error("tagline")} />
      </Field>
      <Field id="industry" label="Industry" error={error("industry")}>
        <TextInput id="industry" list="industry-options" value={v.industry} onChange={(e) => set("industry", e.target.value)} onBlur={blur("industry")} error={error("industry")} />
        <datalist id="industry-options">
          {INDUSTRIES.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </Field>
      <StageCards value={v.stage} onChange={f.setStage} error={error("stage")} />
    </FormSection>
  );
}

export function GoalSection({ f }: { f: CompanyForm }) {
  const { values: v, set, error, blur } = f;
  const prefix = v.unit === "usd" ? "$" : undefined;
  const suffix = v.unit === "pct" ? "%" : undefined;
  return (
    <FormSection step={2} title="Your main goal" description="The one number you most want to move, like revenue or new customers. I plan backwards from it.">
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Field id="goalLabel" label="Goal" hint="Picking a stage above fills this in; change it if you like." error={error("goalLabel")}>
          <TextInput id="goalLabel" value={v.goalLabel} onChange={(e) => set("goalLabel", e.target.value)} onBlur={blur("goalLabel")} placeholder="Net revenue" error={error("goalLabel")} />
        </Field>
        <Field id="unit" label="Measured in">
          <SelectInput id="unit" value={v.unit} onChange={(e) => set("unit", e.target.value as GoalUnit)}>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="current" label="Where you are today" error={error("current")}>
          <TextInput id="current" inputMode="decimal" value={v.current} onChange={(e) => set("current", e.target.value)} onBlur={blur("current")} prefix={prefix} suffix={suffix} error={error("current")} />
        </Field>
        <Field id="target" label="Where you want to be" error={error("target")}>
          <TextInput id="target" inputMode="decimal" value={v.target} onChange={(e) => set("target", e.target.value)} onBlur={blur("target")} prefix={prefix} suffix={suffix} error={error("target")} />
        </Field>
        <Field id="deadline" label="By" error={error("deadline")}>
          <TextInput id="deadline" type="date" min={todayIso()} value={v.deadline} onChange={(e) => set("deadline", e.target.value)} onBlur={blur("deadline")} error={error("deadline")} className="[color-scheme:dark]" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="periodLabel" label="Planning period" hint="Usually a quarter." error={error("periodLabel")}>
          <TextInput id="periodLabel" value={v.periodLabel} onChange={(e) => set("periodLabel", e.target.value)} onBlur={blur("periodLabel")} placeholder="Q1 2027" error={error("periodLabel")} />
        </Field>
        <Field id="weeksInPeriod" label="Weeks in it" hint="A quarter has 13." error={error("weeksInPeriod")}>
          <TextInput id="weeksInPeriod" inputMode="numeric" value={v.weeksInPeriod} onChange={(e) => set("weeksInPeriod", e.target.value)} onBlur={blur("weeksInPeriod")} error={error("weeksInPeriod")} />
        </Field>
        <Field id="week" label="We're in week" error={error("week")}>
          <TextInput id="week" inputMode="numeric" value={v.week} onChange={(e) => set("week", e.target.value)} onBlur={blur("week")} error={error("week")} />
        </Field>
      </div>
    </FormSection>
  );
}

function autonomySentence(budget: number, pct: number) {
  if (!Number.isFinite(budget) || budget <= 0) return "Set a budget to see what this allows.";
  if (pct === 0) return "I will ask you before moving any budget.";
  return `I can move up to ${money((budget * pct) / 100)} a week without asking you.`;
}

export function BudgetSection({ f }: { f: CompanyForm }) {
  const { values: v, set, error, blur } = f;
  return (
    <FormSection step={3} title="Budget and limits" description="How much I may spend, and how much of it I may move around without asking you.">
      <Field id="budget" label={`Marketing budget for ${v.periodLabel.trim() || "the period"}`} error={error("budget")}>
        <TextInput id="budget" inputMode="decimal" value={v.budget} onChange={(e) => set("budget", e.target.value)} onBlur={blur("budget")} prefix="$" placeholder="250,000" error={error("budget")} />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="autonomyPct" className="text-[13px] font-medium text-ink">
            How much I may move without asking
          </label>
          <span className="text-sm text-ink tabular">{v.autonomyPct}% of budget a week</span>
        </div>
        <input
          id="autonomyPct"
          type="range"
          min={0}
          max={AUTONOMY_MAX}
          step={1}
          value={v.autonomyPct}
          onChange={(e) => set("autonomyPct", Number(e.target.value))}
          aria-valuetext={`${v.autonomyPct} percent`}
          className="w-full accent-gold"
        />
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" aria-live="polite">
          <span className="mr-2 text-gold" aria-hidden>
            ◆
          </span>
          {autonomySentence(parseNumber(v.budget), v.autonomyPct)}
        </p>
        <p className="text-xs text-faint">
          This is my <Term k="autonomy">autonomy limit</Term>. Anything bigger, spending in a new place, or changes to the
          brand come to you for a yes or no.
        </p>
      </div>
    </FormSection>
  );
}
