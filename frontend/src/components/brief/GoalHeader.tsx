import Link from "next/link";
import type { TreeNode, WeeklyBrief } from "@/lib/types";
import { withCase } from "@/lib/case";
import { cx } from "@/components/ui";
import { isUnset } from "@/components/empty/state";
import { PageHeader } from "@/components/strategy/PageHeader";
import { StatusWord } from "./bits";
import { PlainLabel, plainNode } from "./plain";
import { PART_BAR, num, partStatus, shortDate, type PartStatus } from "./shared";

export const PAGE_NAME = "How we reach the goal";
export const PAGE_QUESTION = "How do we reach the goal, and which part is behind?";

// The page question answered in one sentence, then the goal with one progress bar.
export function GoalHeader({ brief, gap }: { brief: WeeklyBrief; gap: TreeNode[] }) {
  const { case: c, tree: root } = brief;
  const label = plainNode(root.label);
  const goal =
    brief.goals.find((g) => root.target > 0 && g.target === root.target && g.unit === root.unit) ??
    brief.goals.find((g) => g.kind === "revenue") ??
    brief.goals[0];
  const deadline = shortDate(goal?.deadline) ?? `the end of ${c.periodLabel}`;
  const unset = isUnset(root);
  const status = partStatus(root);
  const short = root.target - root.forecast;

  const answer = unset ? (
    <>
      There is no target yet. On the current pace we reach <span className="tabular">{num(root.forecast, root.unit)}</span> in{" "}
      <PlainLabel p={label} lower /> by {deadline}.
    </>
  ) : (
    <>
      We&apos;re on course for <span className="tabular">{num(root.forecast, root.unit)}</span> of the{" "}
      <span className="tabular">{num(root.target, root.unit)}</span> goal
      {status !== "on_track" && short > 0 && (
        <>
          , <span className="tabular">{num(short, root.unit)}</span> short
        </>
      )}
      .
      {gap[0] ? (
        <>
          {" "}
          The gap is in <PlainLabel p={plainNode(gap[0].label)} lower />.
        </>
      ) : (
        " No part is behind."
      )}
    </>
  );

  return (
    <div>
      <PageHeader page={PAGE_NAME} company={c} question={PAGE_QUESTION} answer={answer} />
      <div className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="text-base text-ink">
            Goal: {unset ? "not set yet" : <span className="tabular">{num(root.target, root.unit)}</span>} in <PlainLabel p={label} lower /> by{" "}
            {deadline}
          </p>
          <StatusWord status={status} className="text-sm" />
        </div>
        {unset ? (
          <p className="mt-2 text-sm text-muted">
            <Link href={withCase("/goals", c.id)} className="underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-accent">
              Set a target in 2027 Plan
            </Link>{" "}
            and this page shows which part is behind.
          </p>
        ) : (
          <GoalBar node={root} status={status} deadline={deadline} />
        )}
      </div>
    </div>
  );
}

function GoalBar({ node, status, deadline }: { node: TreeNode; status: PartStatus; deadline: string }) {
  const share = (v: number) => `${Math.max(0, Math.min(1, v / node.target)) * 100}%`;
  return (
    <div className="mt-4">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cx("absolute inset-y-0 left-0 rounded-full opacity-35", PART_BAR[status])} style={{ width: share(node.forecast) }} />
        <div className={cx("absolute inset-y-0 left-0 rounded-full", PART_BAR[status])} style={{ width: share(node.actual) }} />
      </div>
      <dl className="tabular mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        <Legend swatch={PART_BAR[status]} label="So far" value={num(node.actual, node.unit)} />
        <Legend swatch={cx(PART_BAR[status], "opacity-35")} label={`Expected by ${deadline}`} value={num(node.forecast, node.unit)} />
        <Legend swatch="bg-surface-3" label="Goal" value={num(node.target, node.unit)} className="sm:ml-auto" />
      </dl>
    </div>
  );
}

function Legend({ swatch, label, value, className }: { swatch: string; label: string; value: string; className?: string }) {
  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      <span className={cx("inline-block h-2 w-2 rounded-sm", swatch)} />
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
