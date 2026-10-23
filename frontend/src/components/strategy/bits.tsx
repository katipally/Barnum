import type { Action, Verdict } from "@/lib/types";
import { fmt, money } from "@/lib/format";
import { Term } from "@/components/ui/Term";
import { cx } from "@/components/ui";
import { avgCost, perUnit, resultWords, VERDICT } from "./model";

export function VerdictWord({ verdict, className }: { verdict: Verdict; className?: string }) {
  const v = VERDICT[verdict];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", v.text, className)}>
      <span className={cx("inline-block h-2 w-2 shrink-0 rounded-full", v.dot)} />
      {v.word}
    </span>
  );
}

// The result a channel buys, in plain words, with a hover explanation when one exists.
export function ResultTerm({ label, plural }: { label: string; plural?: boolean }) {
  const w = resultWords(label);
  const text = plural ? w.many : w.one;
  return w.k || w.explain ? (
    <Term k={w.k} explain={w.explain}>
      {text}
    </Term>
  ) : (
    <>{text}</>
  );
}

// One sentence on what a channel buys and what each result costs.
export function Efficiency({ action: a }: { action: Action }) {
  const avg = avgCost(a);
  if (a.status === "planned") return <>Starts later. {money(a.budget)} set aside.</>;
  if (a.results === 0 || avg == null)
    return (
      <>
        {money(a.spent)} spent, no <ResultTerm label={a.resultLabel} plural /> yet.
      </>
    );
  return (
    <>
      Each <ResultTerm label={a.resultLabel} /> costs <span className="tabular text-ink">{perUnit(avg)}</span>
      <span className="tabular text-faint"> · {fmt(a.results, "count")} so far</span>
    </>
  );
}

// Bar length = budget (relative to the biggest), filled part = spent so far.
export function SpendBar({ action: a, max }: { action: Action; max: number }) {
  const len = max > 0 ? Math.max((a.budget / max) * 100, 2) : 0;
  const fill = a.budget > 0 ? Math.min(a.spent / a.budget, 1) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 min-w-0 flex-1">
        <div className="h-full overflow-hidden rounded-full bg-surface-3" style={{ width: `${len}%` }}>
          <div className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent shadow-[0_0_10px_rgba(185,167,255,0.6)]" style={{ width: `${fill}%` }} />
        </div>
      </div>
      <span className="tabular shrink-0 text-xs text-muted">
        <span className="text-ink">{money(a.spent)}</span> of {money(a.budget)}
      </span>
    </div>
  );
}
