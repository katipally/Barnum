"use client";

import { IconX } from "@/components/decisions/icons";
import { howItWorks, useHowItWorksVisible } from "./howItWorksStore";

const STEPS = [
  { who: "You", text: "set the goal and the budget" },
  { who: "I", text: "plan, spend and adjust within your limits" },
  { who: "You", text: "approve the big calls" },
];

// Slim first-visit explainer above the memo; dismissible, brought back from the top bar.
export function HowItWorks() {
  const visible = useHowItWorksVisible();
  if (!visible) return null;
  return (
    <section aria-labelledby="how-it-works" className="mb-8 panel px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="how-it-works" className="text-xs tracking-wide text-accent">
          How this works
        </h2>
        <button
          type="button"
          onClick={howItWorks.dismiss}
          className="-mr-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-faint transition hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          Got it
          <IconX width={12} height={12} />
        </button>
      </div>
      <ol className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug text-ink/90">
            <span className="tabular text-accent">{i + 1}</span>
            <span>
              <span className="text-ink">{s.who}</span> {s.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
