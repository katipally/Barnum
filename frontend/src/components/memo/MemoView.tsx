"use client";

import Link from "next/link";
import { useState } from "react";
import type { AgentLogEntry, CaseId, CompanyCase, Decision, GoalScore, TreeNode, WeeklyBrief } from "@/lib/types";
import { api, useApi } from "@/lib/api";
import { useCaseId, withCase } from "@/lib/case";
import { fmt, money, STATUS_TEXT } from "@/lib/format";
import { cx, ErrorNote, Skeleton, StatusDot } from "@/components/ui";
import { Term } from "@/components/ui/Term";
import { DecidedLine, DecisionActions, DismissButton, NOT_NOW } from "@/components/decisions/DecisionActions";
import { isAwaiting, isUnset } from "@/components/empty/state";
import { AwaitingMemo, heroGoal } from "./AwaitingMemo";
import { HowItWorks } from "./HowItWorks";
import { attainment, gapPath, inSentence, STATUS_WORD } from "./model";
import { Step } from "./Step";
import { LabelTerm } from "./terms";

// The CEO's weekly view as a one-screen memo from the agent: where we'll land, where the gap is,
// what the agent already did, and the few calls it needs from the CEO. Detail lives one click away.
export function MemoView() {
  const caseId = useCaseId();
  return <Memo key={caseId} caseId={caseId} />;
}

function Memo({ caseId }: { caseId: CaseId }) {
  const { data: brief, error, reload } = useApi(() => api.brief(caseId), [caseId]);
  if (!brief) return error ? <ErrorNote message={`Could not load this week's memo. ${error}`} /> : <MemoSkeleton />;

  const awaiting = isAwaiting(brief.case);
  return (
    <article className="mx-auto max-w-[760px] py-6">
      <HowItWorks />
      <MemoHeader c={brief.case} />

      {awaiting ? (
        <AwaitingMemo brief={brief} caseId={caseId} />
      ) : (
        <>
          <Hero root={brief.tree} brief={brief} />

          <Step n={1} title="Where the gap is" subtitle="The one number that's holding the goal back." tour="revenue-tree">
            <GapPath path={gapPath(brief.tree)} />
          </Step>

          <Step n={2} title="What I did on my own" subtitle="Small moves I made within the limit you set." tour="autonomy-log">
            <AgentDid log={brief.log} brief={brief} />
          </Step>

          <Step n={3} title="What I need from you" subtitle="Bigger calls that need your yes or no." tour="decisions">
            <NeedsYou brief={brief} caseId={caseId} onDone={reload} />
          </Step>
        </>
      )}

      <OtherGoals goals={awaiting ? brief.goals.filter((g) => g.id !== heroGoal(brief).id) : brief.goals} neutral={awaiting} />

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        <Link href={withCase("/breakdown", caseId)} className="text-muted hover:text-ink">
          How we reach the goal →
        </Link>
        <Link href={withCase("/strategy", caseId)} className="text-muted hover:text-ink">
          Where the money goes →
        </Link>
        <Link href={withCase("/goals", caseId)} className="text-muted hover:text-ink">
          Change goals or limits →
        </Link>
      </div>
    </article>
  );
}

function MemoHeader({ c }: { c: CompanyCase }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs tracking-wide text-gold">
      <span>CMO agent · {c.name}</span>
      {c.dataStatus === "sample" && (
        <span className="rounded border border-line px-1.5 py-px text-[10px] tracking-normal text-muted">Sample company</span>
      )}
      <span>
        · {c.periodLabel}, week {c.week} of {c.weeksInPeriod}
      </span>
    </p>
  );
}

function Hero({ root, brief }: { root: TreeNode; brief: WeeklyBrief }) {
  const share = root.target ? Math.max(0, Math.min(root.forecast / root.target, 1.2)) : 0;
  const soFar = root.target ? Math.max(0, Math.min(root.actual / root.target, 1)) : 0;
  return (
    <section data-tour="headline" className="mt-4">
      <h1 className="text-[34px] font-medium leading-tight tracking-tight text-ink">
        {isUnset(root) ? (
          <>
            We&apos;re at {fmt(root.actual, root.unit)} <LabelTerm label={root.label}>{inSentence(root.label)}</LabelTerm>. No target
            set yet.
          </>
        ) : (
          <>
            We&apos;re heading for {fmt(root.forecast, root.unit)} of our {fmt(root.target, root.unit)}{" "}
            <LabelTerm label={root.label}>{inSentence(root.label)}</LabelTerm> goal.
          </>
        )}
      </h1>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <StatusDot status={brief.overall} />
        <span className={STATUS_TEXT[brief.overall]}>{STATUS_WORD[brief.overall]}</span>
        <span className="text-faint">·</span>
        <span className="text-muted">{brief.case.primaryObjective}</span>
      </div>

      {!isUnset(root) && (
        <>
          <div className="relative mt-6 h-2 rounded-full bg-surface-3">
            <div className="absolute inset-y-0 left-0 rounded-full bg-ink/25" style={{ width: `${(Math.min(share, 1) * 100).toFixed(1)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(soFar * 100).toFixed(1)}%` }} />
            <div className="absolute -top-1.5 h-5 w-px bg-gold" style={{ left: "100%" }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted tabular">
            <span>{fmt(root.actual, root.unit)} so far</span>
            <span>
              <Term k="forecast">Likely</Term> by the end: {fmt(root.forecast, root.unit)}
            </span>
            <span className="text-gold">Goal {fmt(root.target, root.unit)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function GapPath({ path }: { path: TreeNode[] }) {
  const leaf = path[path.length - 1];
  const behind = Math.round((1 - attainment(leaf)) * 100);
  return (
    <div>
      <p className="text-[15px] text-ink/90">
        {path.length > 1 ? (
          <>
            It comes down to{" "}
            <span className="text-ink">
              <LabelTerm label={leaf.label}>{inSentence(leaf.label)}</LabelTerm>
            </span>
            {behind > 0 && <>: at today&apos;s pace we&apos;ll end {behind}% short</>}.
          </>
        ) : (
          <>Every number behind the goal is on plan.</>
        )}
      </p>
      {path.length > 1 && (
        <p className="mt-1 text-xs text-faint">
          Follow the goal down, one number at a time, to the one that&apos;s furthest behind.
        </p>
      )}
      <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {path.map((n, i) => (
          <li key={n.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-faint">→</span>}
            <span
              className={cx(
                "rounded-md border px-2.5 py-1.5",
                path.length > 1 && i === path.length - 1 ? "border-bad/40 bg-bad/10 text-ink" : "border-line text-muted",
              )}
            >
              <LabelTerm label={n.label} />
              <span className="ml-2 tabular text-xs text-faint">
                {isUnset(n) ? "Not set" : `likely ${fmt(n.forecast, n.unit)} of ${fmt(n.target, n.unit)}`}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AgentDid({ log, brief }: { log: AgentLogEntry[]; brief: WeeklyBrief }) {
  const recent = [...log].sort((a, b) => b.week - a.week).slice(0, 3);
  const limit = (brief.guardrails.budgetTotal * brief.guardrails.autonomyPct) / 100;
  return (
    <div>
      {!recent.length && <p className="text-[15px] text-muted">Nothing yet. I&apos;ll log every move I make here.</p>}
      <ul className="space-y-2.5">
        {recent.map((e) => (
          <li key={e.id} className="flex gap-3 text-[15px] text-ink/90">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
            {e.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">
        Your <Term k="autonomy">autonomy limit</Term> lets me move up to {money(limit)} a week ({brief.guardrails.autonomyPct}% of
        the budget) without asking. Anything bigger comes to you below.
      </p>
    </div>
  );
}

function NeedsYou({ brief, caseId, onDone }: { brief: WeeklyBrief; caseId: CaseId; onDone: () => void }) {
  const [settled, setSettled] = useState<Record<string, "approved" | "rejected">>({});
  const [err, setErr] = useState<string | null>(null);
  // Settled cards stay in place as one line; up to three pending ones show beside them.
  let open = 0;
  const shown = brief.decisions.filter((d) => settled[d.id] || (d.status === "pending" && open++ < 3));

  if (!shown.length) return <p className="text-[15px] text-muted">Nothing this week. I&apos;ll keep going within my limits.</p>;

  const decide = (d: Decision, status: "approved" | "rejected") => {
    setErr(null);
    setSettled((s) => ({ ...s, [d.id]: status }));
    api
      .decide(caseId, d.id, status, status === "rejected" ? NOT_NOW : undefined)
      .then(onDone)
      .catch((e: Error) => {
        setSettled((s) => {
          const next = { ...s };
          delete next[d.id];
          return next;
        });
        setErr(e.message);
      });
  };

  return (
    <div className="space-y-3">
      {err && <ErrorNote message={`Couldn't save that. ${err}`} />}
      {shown.map((d) =>
        settled[d.id] ? (
          <DecidedLine key={d.id} title={d.title} status={settled[d.id]} />
        ) : (
          <div key={d.id} className="rounded-xl border border-line-strong bg-surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">{d.title}</p>
                <p className="mt-1 text-sm text-muted">{d.impact}</p>
                <p className="mt-1.5 text-xs text-faint">Why it needs you: {REASON_TEXT[d.reason]}</p>
              </div>
              <DismissButton onClick={() => decide(d, "rejected")} />
            </div>
            <DecisionActions decision={d} onApprove={() => decide(d, "approved")} />
          </div>
        ),
      )}
    </div>
  );
}

const REASON_TEXT: Record<Decision["reason"], string> = {
  above_autonomy: "it's more money than I may move on my own.",
  new_channel: "it means spending somewhere we haven't spent before.",
  brand_floor: "it touches the money kept for brand building.",
  objective_change: "it changes what we're aiming for.",
  messaging: "it changes what we say about ourselves in public.",
};

function OtherGoals({ goals, neutral }: { goals: GoalScore[]; neutral?: boolean }) {
  if (!goals.length) return null;
  return (
    <section data-tour="goals" className="mt-12">
      <h2 className="text-xs tracking-wide text-faint">All your goals</h2>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {goals.map((g) => (
          <li key={g.id} className="flex items-center gap-2 text-sm">
            {neutral ? <span className="h-2 w-2 shrink-0 rounded-full bg-faint" /> : <StatusDot status={g.status} />}
            <span className="text-ink/90">
              <LabelTerm label={g.label} />
            </span>
            <span className="ml-auto whitespace-nowrap tabular text-xs text-muted">
              {fmt(g.current, g.unit)}
              <span className="text-faint"> · goal {fmt(g.target, g.unit)}</span>
              {!neutral && <span className={cx("ml-2", STATUS_TEXT[g.status])}>{STATUS_WORD[g.status]}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemoSkeleton() {
  return (
    <div className="mx-auto max-w-[760px] space-y-6 py-6">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
