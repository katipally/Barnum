"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { TreeNode } from "@/lib/types";
import { cx } from "@/components/ui";
import { Term } from "@/components/ui/Term";
import { StatusWord, Heading } from "./bits";
import { PlainLabel, plainNode } from "./plain";
import { PART_TEXT, SIGN_WORD, lowerIsBetter, num, partStatus, parts, type PartStatus, type Sign } from "./shared";

const GAP_STYLE: Record<PartStatus, string> = {
  off_track: "border-bad/50 bg-bad/[0.07]",
  at_risk: "border-warn/50 bg-warn/[0.06]",
  on_track: "border-line-strong bg-surface-2",
  unset: "border-line-strong bg-surface-2",
};

// The goal written as a plain equation of the few numbers it is made of; the part furthest behind is marked.
export function EquationSection({
  tree,
  gap,
  periodLabel,
  pending,
}: {
  tree: TreeNode;
  gap: TreeNode[];
  periodLabel: string;
  pending?: boolean;
}) {
  return (
    <section data-tour="revenue-tree">
      <Heading hint={<Term k="revenueTree">What is this?</Term>}>How the goal adds up</Heading>
      <p className="-mt-2 mb-5 text-sm text-muted">
        {pending
          ? "Your goal is made of these parts. Targets and numbers fill in once your data is connected."
          : `For each part: where it will likely land by the end of ${periodLabel}, next to what we need.`}
      </p>
      <Equation
        node={tree}
        depth={0}
        gapIds={new Set(gap.map((n) => n.id))}
        pending={pending}
        footer={pending ? null : <GapLine gap={gap} tree={tree} />}
      />
    </section>
  );
}

function Equation({
  node,
  depth,
  gapIds,
  pending,
  footer,
}: {
  node: TreeNode;
  depth: number;
  gapIds: Set<string>;
  pending?: boolean;
  footer?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = parts(node);
  const opened = items.find((p) => p.node.id === openId)?.node ?? null;

  return (
    <div>
      <p className={cx("mb-3 flex items-baseline gap-2", depth ? "text-sm text-muted" : "text-base text-ink")}>
        <PlainLabel p={plainNode(node.label)} />
        <span aria-hidden className="text-faint">
          =
        </span>
        <span className="sr-only">equals</span>
      </p>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {items.map((p) => (
          <Fragment key={p.node.id}>
            {p.sign && <Operator sign={p.sign} />}
            <Block
              node={p.node}
              compact={depth > 0}
              isGap={gapIds.has(p.node.id)}
              pending={pending}
              open={openId === p.node.id}
              onToggle={() => setOpenId((cur) => (cur === p.node.id ? null : p.node.id))}
            />
          </Fragment>
        ))}
      </div>
      {footer}
      {opened && (
        <div className="mt-5 border-l border-line-strong pl-4 lg:pl-6">
          <Equation node={opened} depth={depth + 1} gapIds={gapIds} pending={pending} />
        </div>
      )}
    </div>
  );
}

function Operator({ sign }: { sign: Sign }) {
  return (
    <span className="flex shrink-0 items-center justify-center text-2xl font-light text-faint lg:w-6">
      <span aria-hidden>{sign}</span>
      <span className="sr-only">{SIGN_WORD[sign]}</span>
    </span>
  );
}

function Block({
  node,
  compact,
  isGap,
  pending,
  open,
  onToggle,
}: {
  node: TreeNode;
  compact: boolean;
  isGap: boolean;
  pending?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const s = partStatus(node, pending);
  const hasKids = !!node.children?.length;
  const nowWord = node.unit === "usd" || node.unit === "count" ? "so far" : "now";
  const big = compact ? "text-xl" : "text-2xl";

  return (
    <div className={cx("flex min-w-0 flex-1 flex-col rounded-xl border", compact ? "p-3.5" : "p-4", isGap ? GAP_STYLE[s] : "border-line bg-surface")}>
      {isGap && <p className={cx("mb-1.5 text-[11px] font-medium", PART_TEXT[s])}>Biggest gap</p>}
      <h3 className="text-[15px] leading-snug text-ink">
        <PlainLabel p={plainNode(node.label)} />
      </h3>

      {pending ? (
        <p className="mt-3 text-sm text-muted">Fills in once data is connected</p>
      ) : (
        <dl className="tabular mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[11px] text-faint">Expected</dt>
            <dd className={cx(big, "leading-tight text-ink")}>{num(node.forecast, node.unit)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-faint">{lowerIsBetter(node) ? "Most we can afford" : "Needed"}</dt>
            <dd className={cx(s === "unset" ? "pt-1.5 text-sm" : big, "leading-tight text-muted")}>
              {s === "unset" ? "No target yet" : num(node.target, node.unit)}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <StatusWord status={s} />
        {!pending && (
          <span className="tabular text-xs text-faint">
            {num(node.actual, node.unit)} {nowWord}
          </span>
        )}
      </div>

      {hasKids && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="mt-3 flex items-center gap-1 self-start rounded-sm text-xs text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
        >
          {open ? "Hide what drives this" : "What drives this?"}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={cx("transition", open && "rotate-180")}>
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function GapLine({ gap, tree }: { gap: TreeNode[]; tree: TreeNode }) {
  if (gap.length === 0) {
    const someUnset = parts(tree).some((p) => partStatus(p.node) === "unset");
    return (
      <p className="mt-4 border-l-2 border-ok pl-3 text-[15px] text-ink/90">
        <span className="text-ok">Nothing is behind right now.</span>
        {someUnset && " Some parts have no target yet, so we can't judge them."}
      </p>
    );
  }
  const top = gap[0];
  const root = gap[gap.length - 1];
  const s = partStatus(top);
  return (
    <p className={cx("mt-4 border-l-2 pl-3 text-[15px] leading-relaxed text-ink/90", s === "off_track" ? "border-bad" : "border-warn")}>
      <span className={PART_TEXT[s]}>This is where the gap is:</span> <PlainLabel p={plainNode(top.label)} lower />
      {root !== top ? (
        <>
          . It traces back to <PlainLabel p={plainNode(root.label)} lower />
        </>
      ) : null}
      :{" "}
      <span className="tabular">
        {num(root.forecast, root.unit)} expected, {num(root.target, root.unit)} {lowerIsBetter(root) ? "at most" : "needed"}
      </span>
      .
    </p>
  );
}
