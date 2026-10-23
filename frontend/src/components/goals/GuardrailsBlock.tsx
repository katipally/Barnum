"use client";

import { Term } from "@/components/ui/Term";
import { fmt, money } from "@/lib/format";
import type { CompanyCase, Guardrails } from "@/lib/types";
import { SliderField } from "./SliderField";
import { SteeringBlock } from "./SteeringBlock";
import { LIMITS, budgetRange, type SteeringDraft, type SteeringErrors } from "./steering";

type GuardrailKey = "budgetTotal" | "autonomyPct" | "brandFloorPct";

export function GuardrailsBlock({
  guardrails,
  company,
  draft,
  errors,
  onChange,
}: {
  guardrails: Guardrails;
  company: CompanyCase;
  draft: SteeringDraft;
  errors: SteeringErrors;
  onChange: (key: GuardrailKey, v: number) => void;
}) {
  const range = budgetRange(guardrails);
  const budget = draft.budgetTotal;
  const left = Math.max(0, budget - guardrails.budgetSpent);
  const weeksLeft = Math.max(0, company.weeksInPeriod - company.week);
  const autonomyUsd = (budget * draft.autonomyPct) / 100;
  const floorUsd = (budget * draft.brandFloorPct) / 100;

  return (
    <SteeringBlock
      title="Budget and limits"
      hint={company.periodLabel}
      intro="How much I have to spend, and how far I may go before I ask you."
    >
      <div className="space-y-7">
        <SliderField
          id="guard-budget"
          label={`Marketing budget for ${company.periodLabel}`}
          value={budget}
          display={money(budget)}
          min={range.min}
          max={range.max}
          step={range.step}
          scale={[money(range.min), money(range.max)]}
          changed={budget !== guardrails.budgetTotal}
          error={errors.budgetTotal}
          onChange={(v) => onChange("budgetTotal", v)}
          explanation={
            <>
              {money(guardrails.budgetSpent)} is already spent, leaving {money(left)} for the remaining {fmt(weeksLeft, "weeks")}.
              Raise it and I put more into what&apos;s working; lower it and I cut the weakest spending first.
            </>
          }
        />
        <SliderField
          id="guard-autonomy"
          label="How much I may move without asking"
          value={draft.autonomyPct}
          display={fmt(draft.autonomyPct, "pct")}
          {...LIMITS.autonomyPct}
          scale={["Ask first", fmt(LIMITS.autonomyPct.max, "pct")]}
          changed={draft.autonomyPct !== guardrails.autonomyPct}
          error={errors.autonomyPct}
          onChange={(v) => onChange("autonomyPct", v)}
          explanation={
            draft.autonomyPct === 0 ? (
              <>
                Your <Term k="autonomy">autonomy limit</Term> is zero: I ask you before moving any money.
              </>
            ) : (
              <>
                Your <Term k="autonomy">autonomy limit</Term>: I may move up to {money(autonomyUsd)} a week (
                {fmt(draft.autonomyPct, "pct")} of the budget) on my own. Raise it and I react faster; lower it and more
                calls come to you.
              </>
            )
          }
        />
        <SliderField
          id="guard-brand-floor"
          label="Money kept for brand building"
          value={draft.brandFloorPct}
          display={fmt(draft.brandFloorPct, "pct")}
          {...LIMITS.brandFloorPct}
          scale={["None", fmt(LIMITS.brandFloorPct.max, "pct")]}
          changed={draft.brandFloorPct !== guardrails.brandFloorPct}
          error={errors.brandFloorPct}
          onChange={(v) => onChange("brandFloorPct", v)}
          explanation={
            draft.brandFloorPct === 0 ? (
              <>
                No <Term k="brandFloor">brand budget floor</Term>: I may move everything into ads that sell right now.
              </>
            ) : (
              <>
                Your <Term k="brandFloor">brand budget floor</Term>: at least {money(floorUsd)} (
                {fmt(draft.brandFloorPct, "pct")}) stays on making the brand known, which pays off slowly. I can&apos;t go below
                it; only you can. Lower it to free money for ads that sell now.
              </>
            )
          }
        />
      </div>
    </SteeringBlock>
  );
}
