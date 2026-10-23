"use client";

import Link from "next/link";
import type { BusinessGoal, CaseId, TreeNode, WeeklyBrief } from "@/lib/types";
import { withCase } from "@/lib/case";
import { fmt } from "@/lib/format";
import { cx } from "@/components/ui";
import { OP_SYMBOL } from "@/components/brief/shared";
import { ConnectData } from "@/components/empty/ConnectData";
import { isUnset } from "@/components/empty/state";
import { inSentence } from "./model";
import { Step } from "./Step";
import { LabelTerm } from "./terms";

type HeroGoal = Pick<BusinessGoal, "label" | "target" | "current" | "unit"> & { id?: string; deadline?: string };

// Memo for a company that has goals but no connected data: the goal, how it breaks down, what I need to start.
export function AwaitingMemo({ brief, caseId }: { brief: WeeklyBrief; caseId: CaseId }) {
  const goal = heroGoal(brief);
  return (
    <>
      <GoalHero goal={goal} objective={brief.case.primaryObjective} />

      <Step
        n={1}
        title="How I'll break it down"
        subtitle="The few numbers that add up to your goal, so we can see which one falls behind."
        tour="revenue-tree"
      >
        <p className="text-[15px] text-ink/90">
          <LabelTerm label={brief.tree.label} /> comes down to these numbers. I&apos;ll fill each one in once your data is
          connected.
        </p>
        <TemplateTree root={brief.tree} />
      </Step>

      <Step n={2} title="What I need to get started" subtitle="Where I read your numbers from." tour="autonomy-log">
        <ConnectData stage={brief.case.stage} />
      </Step>

      <Step n={3} title="What I need from you" subtitle="Bigger calls that need your yes or no." tour="decisions">
        <p className="text-[15px] text-muted">
          Nothing yet. Check that your goal, budget and limits are right in{" "}
          <Link href={withCase("/goals", caseId)} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
            Goals and limits
          </Link>
          . Once I can see where you stand today, I&apos;ll suggest a target for each number.
        </p>
      </Step>
    </>
  );
}

export function heroGoal(brief: WeeklyBrief): HeroGoal {
  const g = brief.goals.find((x) => x.kind === "revenue") ?? brief.goals[0];
  if (g) return g;
  const r = brief.tree;
  return { label: r.label, target: r.target, current: r.actual, unit: r.unit };
}

function shortDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function GoalHero({ goal: g, objective }: { goal: HeroGoal; objective: string }) {
  const date = shortDate(g.deadline);
  const unset = isUnset(g);
  const soFar = unset ? 0 : Math.max(0, Math.min(g.current / g.target, 1));
  return (
    <section data-tour="headline" className="mt-4">
      <h1 className="text-[34px] font-medium leading-tight tracking-tight text-ink">
        {unset ? (
          <>
            Your goal: <LabelTerm label={g.label}>{inSentence(g.label)}</LabelTerm>. No target set yet.
          </>
        ) : (
          <>
            Your goal: {fmt(g.target, g.unit)} <LabelTerm label={g.label}>{inSentence(g.label)}</LabelTerm>
            {date && <> by {date}</>}. You&apos;re at {fmt(g.current, g.unit)}.
          </>
        )}
      </h1>
      <p className="mt-3 text-sm text-muted">{objective}</p>
      {!unset && (
        <>
          <div className="relative mt-6 h-2 rounded-full bg-surface-3">
            <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(soFar * 100).toFixed(1)}%` }} />
            <div className="absolute -top-1.5 h-5 w-px bg-gold" style={{ left: "100%" }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted tabular">
            <span>{fmt(g.current, g.unit)} today</span>
            <span className="text-gold">Goal {fmt(g.target, g.unit)}</span>
          </div>
        </>
      )}
    </section>
  );
}

// Each parent with the numbers it is made of as one line of chips, e.g. "Net new ARR = Pipeline × Win rate × Deal size".
function TemplateTree({ root }: { root: TreeNode }) {
  const rows: TreeNode[] = [];
  const walk = (n: TreeNode, depth: number) => {
    if (!n.children?.length || depth > 2) return;
    rows.push(n);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  if (!rows.length) return null;

  return (
    <ul className="mt-4 space-y-2.5">
      {rows.map((n) => (
        <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Chip strong={n.id === root.id}>
            <LabelTerm label={n.label} />
          </Chip>
          <span className="text-faint">=</span>
          {n.children!.map((c, i) => (
            <span key={c.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-faint">{n.op ? OP_SYMBOL[n.op] : "·"}</span>}
              <Chip>
                <LabelTerm label={c.label} />
              </Chip>
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={cx("rounded-md border px-2.5 py-1.5", strong ? "border-line-strong text-ink" : "border-line text-muted")}>
      {children}
    </span>
  );
}
