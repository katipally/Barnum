"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { money, round } from "@/lib/format";
import type { CampaignDraft, CaseId, PlanChannel } from "@/lib/types";
import { KIND_LABEL, VERDICT_STYLE, nativeText } from "./plan";

function projection(c: PlanChannel): string {
  const sqls = c.projected_sqls_per_quarter === null ? null : `${round(c.projected_sqls_per_quarter, 1)} SQLs per quarter`;
  return (c.kind === "brand" ? (nativeText(c.projected_native) ?? sqls) : (sqls ?? nativeText(c.projected_native))) ?? "not measured";
}

function Draft({ draft, open }: { draft: CampaignDraft; open: boolean }) {
  const { brief } = draft;
  return (
    <details open={open} className="well p-3 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-ink">
        <span className="min-w-0 break-words">{brief.name}</span>
        <span className="chip">{draft.stub ? "Draft (stub, not launched)" : draft.status}</span>
      </summary>
      <div className="mt-3 space-y-3 text-muted">
        <p className="break-words">{brief.objective}</p>
        <p className="tabular">Budget {money(brief.budget_usd)}</p>
        {brief.kpis.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {brief.kpis.map((k) => (
              <li key={k} className="chip whitespace-normal">
                {k}
              </li>
            ))}
          </ul>
        )}
        <ol className="list-decimal space-y-1.5 pl-5">
          {brief.steps.map((s) => (
            <li key={s.title} className="break-words">
              <span className="text-ink">{s.title}</span>
              {s.detail && <span className="block text-faint">{s.detail}</span>}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function ChannelPlanCard({ caseId, channel: c, planId, planning }: { caseId: CaseId; channel: PlanChannel; planId?: string; planning: boolean }) {
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api
      .campaigns(caseId, c.channel_id)
      .then((d) => current && setDrafts(d))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [caseId, c.channel_id]);

  const draft = async () => {
    if (!planId) return;
    setBusy(true);
    setError(null);
    try {
      const d = await api.draftCampaign(caseId, planId, c.channel_id);
      setDrafts((ds) => [d, ...ds]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(false);
    }
  };

  const pending = !c.verdict;
  const beyond = c.beyond_proven_range_usd ?? 0;
  const overflow = c.exploratory_overflow_usd ?? 0;
  const label = c.verdict === "start" ? "Start campaign" : "Optimize campaign";
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h3 className="min-w-0 break-words text-[15px] text-ink">{c.display_name}</h3>
        <span className="chip">{KIND_LABEL[c.kind] ?? c.kind}</span>
        {c.verdict ? (
          <span className={cx("rounded-md border bg-surface-3 px-2 py-0.5 text-[11px] capitalize", VERDICT_STYLE[c.verdict])}>{c.verdict}</span>
        ) : (
          <span className="text-[11px] text-faint">{planning ? "Planning" : "No call yet"}</span>
        )}
        {c.source === "fallback" && (
          <span className="chip" title="The channel agent did not answer; this call comes from a rule-based fallback.">
            Fallback estimate
          </span>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="text-2xl font-light tracking-tight text-ink tabular">{money(c.budget_usd)}</span>
          <span className="text-xs text-muted tabular">{round(c.share * 100, 1)}% of budget</span>
        </div>
        {(beyond > 0 || overflow > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {beyond > 0 && (
              <span className="chip" title={`${money(beyond)} is beyond the spend this channel has data for, so its SQLs are extrapolated from the cost curve.`}>
                extrapolated
              </span>
            )}
            {overflow > 0 && (
              <span className="chip" title={`${money(overflow)} of this test budget is overflow: more performance spend would return less than a dollar of ARR per dollar, so it buys cost data instead.`}>
                exploratory overflow
              </span>
            )}
          </div>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, c.share * 100))}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-faint">Current annual spend</dt>
          <dd className="mt-0.5 text-muted tabular">{c.current_annual_spend_usd === null ? "not measured" : money(c.current_annual_spend_usd)}</dd>
        </div>
        <div>
          <dt className="text-faint">Projected</dt>
          <dd className="mt-0.5 break-words text-muted tabular">
            {projection(c)}
            {c.estimated && <span className="chip ml-1.5">estimated</span>}
          </dd>
        </div>
        {c.plan_cost_per_sql != null && (
          <div>
            <dt className="text-faint">Cost per SQL</dt>
            <dd className="mt-0.5 text-muted tabular">
              {c.current_cost_per_sql != null && `today ${money(c.current_cost_per_sql)}, `}at plan {money(c.plan_cost_per_sql)}
            </dd>
          </div>
        )}
      </dl>
      {c.basis_note && <p className="-mt-2 break-words text-xs text-faint">{c.basis_note}</p>}

      {pending ? (
        planning && (
          <div className="space-y-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 max-w-[70%]" />
            <Skeleton className="h-9" />
          </div>
        )
      ) : (
        <>
          {c.agent_recommends_cut && <p className="break-words text-xs text-bad">Agent recommends moving this {money(c.budget_usd)}</p>}
          {c.rationale && <p className="break-words text-sm leading-relaxed text-ink/90">{c.rationale}</p>}
          {c.actions && c.actions.length > 0 && (
            <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-faint">
              {c.actions.map((a) => (
                <li key={a.title} className="break-words text-ink">
                  {a.title}
                  {a.detail && <span className="block text-muted">{a.detail}</span>}
                </li>
              ))}
            </ol>
          )}
          {c.risk && (
            <p className="break-words text-xs text-muted">
              <span className="text-faint">Risk: </span>
              {c.risk}
            </p>
          )}
        </>
      )}

      <div className="mt-auto space-y-3">
        <div>
          <Button variant="secondary" onClick={draft} disabled={busy || pending || !planId} title={!planId && !pending ? "Available once the plan is saved" : undefined}>
            {busy ? "Drafting" : label}
          </Button>
        </div>
        {error && <ErrorNote message={`Could not draft the campaign. ${error}`} />}
        {drafts.map((d, i) => (
          <Draft key={d.campaign_id} draft={d} open={i === 0} />
        ))}
      </div>
    </Card>
  );
}
