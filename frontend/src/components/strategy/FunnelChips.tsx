import type { FunnelStage } from "@/lib/types";
import { cx } from "@/components/ui";
import { FUNNEL_STAGES, STAGE_LABEL } from "./model";

export type StageFilter = FunnelStage | "all";

export function FunnelChips({
  value,
  onChange,
  counts,
}: {
  value: StageFilter;
  onChange: (v: StageFilter) => void;
  counts: Record<StageFilter, number>;
}) {
  const options: StageFilter[] = ["all", ...FUNNEL_STAGES];
  return (
    <div role="radiogroup" aria-label="Filter actions by funnel stage" className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={cx(
              "rounded-full border px-2.5 py-1 text-xs transition",
              on ? "border-line-strong bg-surface-3 text-ink" : "border-line text-muted hover:text-ink",
            )}
          >
            {o === "all" ? "All" : STAGE_LABEL[o]}
            <span className="tabular ml-1.5 text-faint">{counts[o]}</span>
          </button>
        );
      })}
    </div>
  );
}
