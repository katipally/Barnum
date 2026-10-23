"use client";

import { DATA_STATUS_LABEL, DataStatusDot, Monogram, SampleTag, plainStage } from "@/components/shell/CompanyMarks";
import { Button } from "@/components/ui";
import type { CaseSummary } from "@/lib/types";

export function CompanyRow({
  company: c,
  current,
  onOpen,
  onDelete,
}: {
  company: CaseSummary;
  current: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        <Monogram name={c.name} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <span className="truncate">{c.name}</span>
            {c.sample && <SampleTag />}
            {current && <span className="text-[11px] font-normal text-accent">Open now</span>}
          </p>
          <p className="truncate text-xs text-faint">{c.tagline || plainStage(c.stageLabel).short}</p>
        </div>
      </div>
      <p className="w-36 text-xs text-muted" title={plainStage(c.stageLabel).meaning}>
        {plainStage(c.stageLabel).short}
      </p>
      <p className="flex w-32 items-center gap-1.5 text-xs text-muted">
        <DataStatusDot status={c.dataStatus} />
        {DATA_STATUS_LABEL[c.dataStatus]}
      </p>
      <div className="ml-auto flex w-40 justify-end gap-1.5">
        {onDelete && (
          <Button type="button" variant="ghost" onClick={onDelete} aria-label={`Delete ${c.name}`}>
            Delete
          </Button>
        )}
        <Button type="button" onClick={onOpen} aria-label={`Open ${c.name}`}>
          Open
        </Button>
      </div>
    </li>
  );
}
