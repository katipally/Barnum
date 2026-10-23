import type { ReactNode } from "react";
import { Term } from "@/components/ui/Term";

const RULES: { title: string; text: ReactNode }[] = [
  {
    title: "Each number",
    text: "I compare this week's value with its target. At or past the target: on track. Up to 10% short: needs attention. More than 10% short: off track.",
  },
  {
    title: "Each goal",
    text: (
      <>
        I look at where its main number will likely land by the end of the period (the <Term k="forecast">forecast</Term>), not just
        where it is today.
      </>
    ),
  },
  {
    title: "Fair timing",
    text: "Spending and results are compared with how far into the period we are, not with the full-period target.",
  },
  {
    title: "Money",
    text: (
      <>
        I compare what the <Term k="marginal">next result</Term> would cost in each channel with similar channels. Clearly cheaper
        means spend more; much more expensive means spend less. New channels get a few weeks before I judge them.
      </>
    ),
  },
  {
    title: "Brand money",
    text: (
      <>
        I never cut the <Term k="brandFloor">budget kept for brand building</Term>. Only you can change it.
      </>
    ),
  },
];

export function JudgingHeuristics() {
  return (
    <details className="group mt-12 border-t border-line pt-5">
      <summary className="cursor-pointer list-none text-sm text-muted hover:text-ink">
        <span className="text-gold">How I decide if something is on track</span>
        <span className="ml-2 text-xs text-faint group-open:hidden">Show</span>
        <span className="ml-2 hidden text-xs text-faint group-open:inline">Hide</span>
      </summary>
      <ul className="mt-4 grid max-w-[900px] gap-x-8 gap-y-3 sm:grid-cols-2">
        {RULES.map((r) => (
          <li key={r.title} className="text-sm leading-snug text-muted">
            <span className="text-ink">{r.title}.</span> {r.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
