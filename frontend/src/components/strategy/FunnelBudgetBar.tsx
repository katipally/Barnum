import type { Action, FunnelStage } from "@/lib/types";
import { money } from "@/lib/format";
import { cx } from "@/components/ui";
import { FUNNEL_STAGES, STAGE_LABEL, STAGE_TONE } from "./model";

// Total budget allocated by funnel stage, as one thin stacked bar.
export function FunnelBudgetBar({ actions, active }: { actions: Action[]; active: FunnelStage | "all" }) {
  const byStage = FUNNEL_STAGES.map((stage) => ({
    stage,
    budget: actions.filter((a) => a.funnelStage === stage).reduce((s, a) => s + a.budget, 0),
  }));
  const total = byStage.reduce((s, x) => s + x.budget, 0);
  const spent = actions.reduce((s, a) => s + (a.spent ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-muted">
          <span className="tabular text-ink">{money(total)}</span> allocated across {actions.length} actions
        </span>
        <span className="tabular text-xs text-faint">{money(spent)} spent to date</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        {total > 0 &&
          byStage.map(({ stage, budget }) =>
            budget > 0 ? (
              <div
                key={stage}
                title={`${STAGE_LABEL[stage]}: ${money(budget)}`}
                className={cx(
                  "h-full border-r border-bg transition-opacity last:border-r-0",
                  STAGE_TONE[stage],
                  active !== "all" && active !== stage && "opacity-30",
                )}
                style={{ width: `${(budget / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {byStage.map(({ stage, budget }) => (
          <li key={stage} className={cx("flex items-center gap-1.5", active !== "all" && active !== stage && "opacity-50")}>
            <span className={cx("inline-block h-2 w-2 rounded-sm", STAGE_TONE[stage])} />
            {STAGE_LABEL[stage]}
            <span className="tabular text-faint">
              {money(budget)}
              {total > 0 && ` · ${Math.round((budget / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
