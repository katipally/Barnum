"use client";

import type { WeeklyBrief } from "@/lib/types";
import { AwaitingData } from "@/components/empty/AwaitingData";
import { PageHeader } from "@/components/strategy/PageHeader";
import { EquationSection } from "./Equation";
import { PAGE_NAME, PAGE_QUESTION } from "./GoalHeader";

// Breakdown for a company without data: the goal's equation with every part "Not set", and the sources to connect.
export function AwaitingBreakdown({ brief }: { brief: WeeklyBrief }) {
  return (
    <div>
      <PageHeader
        page={PAGE_NAME}
        company={brief.case}
        question={PAGE_QUESTION}
        answer="No numbers yet. Once your data is connected, this page shows how your goal adds up and which part is behind."
      />
      <AwaitingData stage={brief.case.stage} sentence={null}>
        <EquationSection tree={brief.tree} gap={[]} periodLabel={brief.case.periodLabel} pending />
      </AwaitingData>
    </div>
  );
}
