import type { ReactNode } from "react";
import { AgentText } from "@/components/chat/AgentText";
import { Card, SectionTitle, Skeleton, StatusPill } from "@/components/ui";
import { money, round } from "@/lib/format";
import type { PlanTargets, PlanTotals } from "@/lib/types";

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="well min-w-0 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 break-words text-2xl font-light tracking-tight text-ink tabular">{value}</p>
      {sub && <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const Gap = ({ met, text }: { met: boolean; text: string }) => <StatusPill status={met ? "on_track" : "off_track"}>{met ? "Target met" : text}</StatusPill>;

export function PlanSummary({ totals, targets, summary, running }: { totals?: PlanTotals; targets?: PlanTargets; summary: string; running: boolean }) {
  if (!totals || !targets) return <Skeleton className="h-28" />;
  const { revenue, sqls_per_quarter: sqls, budget_needed_for_targets_usd: needed } = targets;
  const orNone = (v: number | null, f: (n: number) => string) => (v === null ? <span className="text-base text-muted">not measured</span> : f(v));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
        <Tile label="Total budget" value={money(totals.budget_usd)} />
        <Tile
          label="Allocated"
          value={money(totals.allocated_usd)}
          sub={[
            totals.unallocated_usd >= 1 && `${money(totals.unallocated_usd)} unallocated`,
            totals.beyond_proven_range_usd && `${money(totals.beyond_proven_range_usd)} extrapolated`,
            totals.exploratory_overflow_usd && `${money(totals.exploratory_overflow_usd)} exploratory overflow`,
          ]
            .filter(Boolean)
            .join(", ")}
        />
        <Tile
          label="SQLs per quarter"
          value={orNone(sqls.projected, (n) => round(n, 1))}
          sub={
            <>
              <span>target {round(sqls.target, 0)}</span>
              <Gap met={sqls.met} text={`${round(Math.abs(sqls.gap ?? 0), 1)} short`} />
            </>
          }
        />
        <Tile
          label="New ARR"
          value={orNone(revenue.projected_usd, money)}
          sub={
            <>
              <span>target {money(revenue.target_usd)}</span>
              <Gap met={revenue.met} text={`${money(Math.abs(revenue.gap_usd ?? 0))} short`} />
            </>
          }
        />
        <Tile
          label="Budget needed to hit targets"
          value={needed === null ? <span className="text-base text-bad">Not reachable</span> : money(needed)}
          sub={needed === null ? `Limited by: ${targets.limited_by ?? "unknown"}` : undefined}
        />
      </div>
      {targets.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {targets.notes.map((n) => (
            <li key={n} className="break-words">
              {n}
            </li>
          ))}
        </ul>
      )}
      {(summary || running) && (
        <Card className="p-5">
          <SectionTitle>CMO summary</SectionTitle>
          {summary ? (
            <div className="text-sm leading-relaxed text-ink/90">
              <AgentText text={summary} />
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 max-w-xl" />
              <Skeleton className="h-4 max-w-md" />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
