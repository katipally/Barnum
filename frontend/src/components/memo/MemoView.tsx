"use client";

import Link from "next/link";
import { useState } from "react";
import type { AgentLogEntry, CaseId, CompanyCase, Decision, GoalScore, ObjectiveScore, TreeNode, WeeklyBrief } from "@/lib/types";
import { api, useApi } from "@/lib/api";
import { useCaseId, withCase } from "@/lib/case";
import { fmt, money, STATUS_TEXT } from "@/lib/format";
import { BigNumber, Button, cx, ErrorNote, Skeleton, StatusDot, StatusPill } from "@/components/ui";
import { useAskCmo } from "@/components/chat/AskCmoContext";
import { Term } from "@/components/ui/Term";
import { DecidedLine, DecisionActions, DismissButton, NOT_NOW } from "@/components/decisions/DecisionActions";
import { isAwaiting, isUnset } from "@/components/empty/state";
import { AwaitingMemo, heroGoal } from "./AwaitingMemo";
import { HowItWorks } from "./HowItWorks";
import { attainment, gapPath, inSentence, STATUS_WORD } from "./model";
import { Spark } from "./Spark";
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
  if (awaiting) {
    return (
      <article className="mx-auto max-w-[760px] py-6">
        <HowItWorks />
        <MemoHeader c={brief.case} />
        <AwaitingMemo brief={brief} caseId={caseId} />
        <OtherGoals goals={brief.goals.filter((g) => g.id !== heroGoal(brief).id)} neutral />
      </article>
    );
  }
  return (
    <article className="py-2">
      <HowItWorks />
      <MemoHeader c={brief.case} />

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Objectives scores={brief.scorecard} />
        <NeedsYouCard brief={brief} />
      </div>

      <Hero root={brief.tree} brief={brief} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Where the gap is" hint="The number holding the goal back" tour="revenue-tree">
          <GapPath path={gapPath(brief.tree)} />
        </Panel>
        <Panel title="What I did on my own" hint="Within your limit" tour="autonomy-log">
          <AgentDid log={brief.log} brief={brief} />
        </Panel>
      </div>

      <div id="decisions" className="mt-5 scroll-mt-20">
        <Panel title="What I need from you" hint="Bigger calls that need your yes or no" tour="decisions">
          <NeedsYou brief={brief} caseId={caseId} onDone={reload} />
        </Panel>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        {[
          ["/breakdown", "How we reach the goal"],
          ["/strategy", "Where the money goes"],
          ["/goals", "Change goals or limits"],
        ].map(([href, label]) => (
          <Link key={href} href={withCase(href, caseId)} className="rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-muted transition hover:border-line-strong hover:text-ink">
            {label} ↗
          </Link>
        ))}
      </div>
    </article>
  );
}

function Panel({ title, hint, tour, children }: { title: string; hint?: string; tour: string; children: React.ReactNode }) {
  return (
    <section data-tour={tour} className="panel h-full p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-normal text-ink">{title}</h2>
        {hint && <span className="chip hidden sm:inline-flex">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// Top row: each marketing objective as an asset-style card with its north-star metric and trend.
function Objectives({ scores }: { scores: ObjectiveScore[] }) {
  const top = [...scores].sort((a, b) => b.objective.priority - a.objective.priority).slice(0, 3);
  return (
    <section data-tour="goals" className="min-w-0">
      <p className="flex items-center gap-2 text-sm text-muted">
        What marketing is working on <span className="chip">{scores.length} objectives</span>
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {top.map((o, i) => {
          const m = o.northStar;
          const latest = m.series.at(-1)?.value ?? 0;
          return (
            <div key={o.objective.id} className="panel flex flex-col overflow-hidden p-4">
              <div className="flex items-start gap-3">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-sm font-medium", TILE[i % TILE.length])}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-faint">Objective</p>
                  <p className="line-clamp-2 text-[13px] leading-snug text-ink">{o.objective.label}</p>
                </div>
              </div>
              <p className="mt-4 truncate text-[11px] text-faint">
                <LabelTerm label={m.label} />
              </p>
              <BigNumber value={fmt(latest, m.unit)} className="mt-1.5 text-[34px]" />
              <div className="mt-2">
                <StatusPill status={o.status}>{m.target ? `goal ${fmt(m.target, m.unit)}` : STATUS_WORD[o.status]}</StatusPill>
              </div>
              <div className="-mx-4 -mb-4 mt-3">
                <Spark id={o.objective.id} values={m.series.map((p) => p.value)} target={m.target || undefined} status={o.status} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const TILE = [
  "bg-accent/15 text-accent ring-1 ring-accent/30",
  "bg-info/15 text-info ring-1 ring-info/30",
  "bg-ok/15 text-ok ring-1 ring-ok/30",
];

// The one loud card: how many calls wait for the CEO, and the first of them.
function NeedsYouCard({ brief }: { brief: WeeklyBrief }) {
  const { ask } = useAskCmo();
  const pending = brief.decisions.filter((d) => d.status === "pending");
  return (
    <section className="hero-violet relative flex flex-col overflow-hidden p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs text-accent">CMO agent · this week</span>
        <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-ink">{pending.length ? "Needs you" : "All clear"}</span>
      </div>
      <p className="mt-5 flex items-baseline gap-3">
        <span className="num-display text-[56px] text-ink">{pending.length}</span>
        <span className="text-[17px] leading-tight text-ink">{pending.length === 1 ? "call needs your yes or no" : "calls need your yes or no"}</span>
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/70">
        {pending[0] ? pending[0].title : "Nothing above my limit this week. I keep going within the limits you set."}
      </p>
      <div className="mt-auto space-y-2.5 pt-6">
        <a href="#decisions" className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent/90">
          Review decisions
        </a>
        <button
          type="button"
          onClick={() => ask("What are the most important things I should know this week, and why?")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-ink transition hover:bg-white/10"
        >
          Ask what matters most
        </button>
      </div>
    </section>
  );
}

function MemoHeader({ c }: { c: CompanyCase }) {
  return (
    <header>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        Weekly memo from your CMO agent
        <span className="chip">{c.periodLabel}</span>
        {c.dataStatus === "sample" && <span className="chip">Sample company</span>}
      </p>
      <h1 className="mt-2 text-[38px] font-light leading-tight tracking-tight text-ink">{c.name}&apos;s week</h1>
    </header>
  );
}

function Hero({ root, brief }: { root: TreeNode; brief: WeeklyBrief }) {
  const unset = isUnset(root);
  const share = root.target ? Math.max(0, Math.min(root.forecast / root.target, 1)) : 0;
  const soFar = root.target ? Math.max(0, Math.min(root.actual / root.target, 1)) : 0;
  const gap = root.target - root.forecast;
  return (
    <section data-tour="headline" className="panel mt-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
        <span className="text-sm text-ink">The goal</span>
        <span className="chip">Week {brief.case.week} of {brief.case.weeksInPeriod}</span>
      </div>
      <div className="dot-grid grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <LabelTerm label={root.label} />
            <StatusPill status={brief.overall}>{STATUS_WORD[brief.overall]}</StatusPill>
          </p>
          <h2 className="mt-3 text-[26px] font-light leading-tight tracking-tight text-ink">
            {unset ? (
              <>
                We&apos;re at {fmt(root.actual, root.unit)} <LabelTerm label={root.label}>{inSentence(root.label)}</LabelTerm>. No target set yet.
              </>
            ) : (
              <>
                We&apos;re heading for {fmt(root.forecast, root.unit)} of our {fmt(root.target, root.unit)}{" "}
                <LabelTerm label={root.label}>{inSentence(root.label)}</LabelTerm> goal.
              </>
            )}
          </h2>
          <p className="mt-5 text-[11px] text-faint">
            <Term k="forecast">Likely</Term> by the end of {brief.case.periodLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-4">
            <BigNumber value={fmt(unset ? root.actual : root.forecast, root.unit)} className="text-[72px] text-ink" />
            {!unset && <span className="mb-2 text-lg font-light text-faint">/ {fmt(root.target, root.unit)}</span>}
          </div>
          <p className="mt-3 max-w-xl text-sm text-muted">{brief.case.primaryObjective}</p>
        </div>

        {!unset && (
          <div className="well self-center p-5">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-light text-ink">Pace to goal</span>
              <span className="chip tabular">{Math.round(share * 100)}%</span>
            </div>
            <p className="mt-0.5 text-xs text-faint">So far, likely by the end, and the goal</p>
            <Track soFar={soFar} share={share} label={fmt(root.forecast, root.unit)} />
            <div className="mt-2 flex justify-between text-[11px] tabular text-faint">
              <span>{fmt(root.actual, root.unit)} so far</span>
              <span className="text-accent">Goal {fmt(root.target, root.unit)}</span>
            </div>
          </div>
        )}
      </div>
      {!unset && (
        <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {[
            ["So far", fmt(root.actual, root.unit), "Booked this period"],
            ["Likely", fmt(root.forecast, root.unit), "If nothing changes"],
            ["Goal", fmt(root.target, root.unit), "Set by you"],
            [gap > 0 ? "Short by" : "Ahead by", fmt(Math.abs(gap), root.unit), gap > 0 ? "What the plan must close" : "Room to spare"],
          ].map(([k, v, sub], i) => (
            <div key={k} className={cx("px-6 py-4", i > 0 && "border-l border-line")}>
              <p className="text-sm text-ink">{k}</p>
              <p className="text-[11px] text-faint">{sub}</p>
              <BigNumber value={v} className={cx("mt-3 block text-[28px]", i === 3 && gap > 0 ? "text-bad" : "text-ink")} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Tick-mark track with a knob at the likely landing point.
function Track({ soFar, share, label }: { soFar: number; share: number; label: string }) {
  const ticks = 48;
  return (
    <div className="relative mt-9 h-8">
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between">
        {Array.from({ length: ticks }, (_, i) => {
          const at = i / (ticks - 1);
          return (
            <span
              key={i}
              className={cx("w-px rounded-full", at <= soFar ? "bg-accent" : at <= share ? "bg-accent/45" : "bg-white/15")}
              style={{ height: i % 6 === 0 ? 18 : 10 }}
            />
          );
        })}
      </div>
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${share * 100}%` }}>
        <span className="absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-surface-3 px-2 py-0.5 text-[11px] tabular text-ink">
          {label}
        </span>
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-accent bg-bg shadow-[0_0_14px_rgba(185,167,255,0.8)]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
      </div>
    </div>
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
                "rounded-lg border px-3 py-2",
                path.length > 1 && i === path.length - 1 ? "border-bad/40 bg-bad/10 text-ink" : "border-line bg-surface-2/60 text-muted",
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
          <div key={d.id} className="well p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-ink">{d.title}</p>
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
    <section className="mt-12">
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
