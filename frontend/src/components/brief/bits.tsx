import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { PART_BAR, PART_TEXT, PART_WORD, type PartStatus } from "./shared";

export function StatusWord({ status, className }: { status: PartStatus; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium", PART_TEXT[status], className)}>
      <span className={cx("inline-block h-2 w-2 rounded-full", PART_BAR[status])} />
      {PART_WORD[status]}
    </span>
  );
}

export function Heading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-lg font-medium text-ink">{children}</h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

// Thin progress bar; value is a 0..1 share.
export function Bar({ value, status, className }: { value: number; status: PartStatus; className?: string }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cx("h-full rounded-full", PART_BAR[status])} style={{ width: `${pct}%` }} />
    </div>
  );
}
