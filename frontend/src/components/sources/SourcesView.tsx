"use client";

import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";
import type { DataSource } from "@/lib/types";
import { cx, ErrorNote, Skeleton } from "@/components/ui";
import { ConnectData } from "@/components/empty/ConnectData";
import { isAwaiting } from "@/components/empty/state";
import { PageFrame, PageHeader } from "@/components/strategy/PageHeader";
import { shortDate } from "@/components/deepdives/dates";

const QUESTION = "What is the agent working from?";

const GROUPS: { kind: DataSource["kind"]; title: string }[] = [
  { kind: "warehouse", title: "Data store" },
  { kind: "channel", title: "Channels" },
  { kind: "crm", title: "Sales" },
  { kind: "plan", title: "Plan" },
  { kind: "other", title: "Other sources" },
  { kind: "notes", title: "What we've learned together" },
];

const STATUS: Record<DataSource["status"], { word: string; dot: string; text: string }> = {
  connected: { word: "Connected", dot: "bg-ok", text: "text-ok" },
  sample: { word: "Sample data", dot: "bg-info", text: "text-info" },
  paused: { word: "Paused", dot: "bg-warn", text: "text-warn" },
  not_connected: { word: "Nothing yet", dot: "bg-faint", text: "text-faint" },
};

export function SourcesView() {
  const caseId = useCaseId();
  const sources = useApi(() => api.sources(caseId), [caseId]);
  const strategy = useApi(() => api.strategy(caseId), [caseId]);
  const company = strategy.data?.case;
  const list = sources.data ?? [];
  const data = list.filter((s) => s.kind !== "notes" && s.status !== "not_connected");
  const notes = list.find((s) => s.kind === "notes");
  const learned = notes?.status === "connected" ? notes.usedFor.length : 0;

  const answer = sources.data
    ? data.length
      ? `I work from ${data.length} ${data.length === 1 ? "source" : "sources"}${
          data.some((s) => s.status === "sample") ? " of sample data" : ""
        }${learned ? `, plus ${learned} ${learned === 1 ? "conclusion" : "conclusions"} from our deep dives` : ""}. Every number I give comes from one of these.`
      : "Nothing is connected yet. Connect Snowflake first; everything else flows into it."
    : sources.error
      ? null
      : undefined;

  return (
    <PageFrame>
      <PageHeader page="Data sources" company={company} question={QUESTION} answer={answer} />
      {sources.error && <ErrorNote message={`Could not load the data sources. ${sources.error}`} />}
      {sources.loading && !sources.data && <Skeleton className="h-72" />}
      {company && isAwaiting(company) && <ConnectData stage={company.stage} className="mb-10" />}
      <div className="space-y-10">
        {GROUPS.map((g) => {
          const rows = list.filter((s) => s.kind === g.kind);
          if (!rows.length) return null;
          return (
            <section key={g.kind}>
              <h2 className="mb-3 text-[13px] font-medium tracking-wide text-muted">{g.title}</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {rows.map((s) => (
                  <SourceRow key={s.id} source={s} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageFrame>
  );
}

function SourceRow({ source: s }: { source: DataSource }) {
  const st = STATUS[s.status];
  return (
    <li className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-ink">{s.name}</span>
          <span className={cx("inline-flex items-center gap-1.5 text-xs", st.text)}>
            <span className={cx("inline-block h-2 w-2 rounded-full", st.dot)} />
            {st.word}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{s.provides}</p>
        {(s.detail || s.updatedAt) && (
          <p className="mt-1.5 break-words text-xs text-faint">
            {s.detail}
            {s.detail && s.updatedAt && " · "}
            {s.updatedAt && `updated ${shortDate(s.updatedAt)}`}
          </p>
        )}
      </div>
      {s.usedFor.length > 0 && (
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-faint">{s.kind === "notes" ? "Conclusions I build on" : "Feeds"}</p>
          <ul className="flex flex-wrap gap-1.5">
            {s.usedFor.map((u) => (
              <li key={u} className="max-w-full truncate rounded border border-line px-1.5 py-0.5 text-xs text-muted">
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
