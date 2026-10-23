"use client";

import { useEffect, useState } from "react";
import type { CaseId } from "@/lib/types";
import { api, useApi } from "@/lib/api";
import { Button, ErrorNote } from "@/components/ui";

const LABELS = ["Cost per SQL:", "Waiting for approval:", "Recommendation:"];
const POLL_MS = 15_000;

// The CMO agent's own write-up of the week. The backend has the agent write a new one once the latest predates
// Monday 07:00 PT; while it writes, this polls. Hidden for companies without a live CMO.
export function MondayBrief({ caseId }: { caseId: CaseId }) {
  const { data: state, setData, reload } = useApi(() => api.mondayBrief(caseId), [caseId]);
  const [asked, setAsked] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const writing = asked || !!state?.writing;

  useEffect(() => {
    if (!state?.writing || asked) return;
    const t = setTimeout(reload, POLL_MS);
    return () => clearTimeout(t);
  }, [state, asked, reload]);

  if (!state || (!state.brief && !writing)) return null;
  const { brief } = state;

  const rewrite = () => {
    setErr(null);
    setAsked(true);
    api
      .refreshMondayBrief(caseId)
      .then(setData)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setAsked(false));
  };
  const written =
    brief && new Date(brief.createdAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <section data-tour="monday-brief" className="panel mt-5 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-normal text-ink">Monday brief</h2>
          <p className="mt-0.5 text-xs text-faint">
            {brief
              ? `Written by the CMO agent${brief.source === "ai_complete" ? " (fallback model)" : ""} · ${written} · new one every Monday 7:00 PT`
              : "The CMO agent is writing this week's brief"}
          </p>
        </div>
        <Button variant="ghost" onClick={rewrite} disabled={writing}>
          {writing ? "Writing… about a minute" : "Write a fresh one"}
        </Button>
      </div>
      {err && <ErrorNote message={`Couldn't write a new brief. ${err}`} />}
      {brief && (
        <div className="space-y-3 text-[15px] leading-relaxed text-ink/90">
          {brief.text.split(/\n\s*\n/).map((para, i) => {
            const label = LABELS.find((l) => para.startsWith(l));
            return (
              <p key={i} className="whitespace-pre-line">
                {label && <span className="text-accent">{label}</span>}
                {label ? para.slice(label.length) : para}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
