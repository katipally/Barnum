"use client";

import Link from "next/link";
import { useState } from "react";
import type { CaseId, ObjectiveScore } from "@/lib/types";
import { withCase } from "@/lib/case";
import { fmt } from "@/lib/format";
import { Bar, Heading, StatusWord } from "./bits";
import { ObjectiveTitle, PlainText } from "./plain";
import type { PartStatus } from "./shared";

const MAX = 4;

// The marketing objectives as plain rows: what we're pushing, how far along, and why.
export function Objectives({ scorecard, caseId }: { scorecard: ObjectiveScore[]; caseId: CaseId }) {
  const [all, setAll] = useState(false);
  const rows = [...scorecard].sort((a, b) => b.objective.priority - a.objective.priority);
  const shown = all ? rows : rows.slice(0, MAX);

  return (
    <section data-tour="scorecard">
      <Heading>What marketing is working on</Heading>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">No marketing objectives yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {shown.map((r) => (
            <ObjectiveRow key={r.objective.id} row={r} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {rows.length > MAX ? (
          <button type="button" onClick={() => setAll((a) => !a)} className="text-muted hover:text-ink">
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        ) : (
          <span />
        )}
        <Link
          href={withCase("/evaluation", caseId)}
          className="text-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-gold"
        >
          Weekly charts for each one are in Numbers we watch
        </Link>
      </div>
    </section>
  );
}

function ObjectiveRow({ row: r }: { row: ObjectiveScore }) {
  const m = r.northStar;
  const latest = m.series.length ? m.series[m.series.length - 1].value : null;
  const unset = !m.target;
  const s: PartStatus = unset ? "unset" : r.status;

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug text-ink">
          <ObjectiveTitle row={r} />
        </h3>
        <StatusWord status={s} className="mt-0.5" />
      </div>
      <p className="mt-1 text-sm text-ink/80">
        <PlainText text={m.label} />:{" "}
        <span className="tabular">
          {latest === null ? "no data yet" : `${fmt(latest, m.unit)} now`}
          {" · "}
          {unset ? "no goal set yet" : `goal ${fmt(m.target, m.unit)}${m.direction === "down" ? " or less" : ""}`}
        </span>
      </p>
      {!unset && <Bar value={r.attainment} status={s} className="mt-2.5 max-w-[420px]" />}
      <p className="mt-2.5 text-xs leading-relaxed text-muted">
        Why: <PlainText text={r.objective.rationale} />
      </p>
    </li>
  );
}
