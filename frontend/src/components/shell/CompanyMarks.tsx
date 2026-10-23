import { cx } from "@/components/ui";
import type { CaseSummary } from "@/lib/types";

// Small visual atoms shared by the company switcher and the manage page.

export function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function Monogram({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface-3 font-semibold text-ink",
        size === "md" ? "h-8 w-8 text-[12px]" : "h-6 w-6 text-[10px]",
      )}
    >
      {monogram(name)}
    </span>
  );
}

export const DATA_STATUS_LABEL: Record<CaseSummary["dataStatus"], string> = {
  sample: "Example data",
  connected: "Live data",
  awaiting_data: "Waiting for data",
};

// The company stage in plain words: short for menus, with a one-line meaning for cards and tooltips.
const STAGE_PLAIN: Record<string, { short: string; meaning: string }> = {
  "Pre-PMF startup": { short: "Early startup", meaning: "Still finding the customers who love the product" },
  "Scaling company": { short: "Growing company", meaning: "Customers love it; now winning the market" },
  "Established brand": { short: "Established brand", meaning: "Well known; growing by reaching new buyers" },
};

export function plainStage(stageLabel: string) {
  return STAGE_PLAIN[stageLabel] ?? { short: stageLabel, meaning: stageLabel };
}

export function DataStatusDot({ status, className }: { status: CaseSummary["dataStatus"]; className?: string }) {
  return (
    <span
      title={DATA_STATUS_LABEL[status]}
      className={cx(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "connected" && "bg-ok",
        status === "sample" && "bg-muted",
        status === "awaiting_data" && "border border-faint bg-transparent",
        className,
      )}
    />
  );
}

export function SampleTag() {
  return (
    <span className="rounded border border-line-strong px-1 py-px text-[10px] leading-3 text-faint">Sample</span>
  );
}
