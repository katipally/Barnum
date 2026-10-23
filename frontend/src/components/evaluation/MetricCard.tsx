import type { Metric } from "@/lib/types";
import { fmt, STATUS_TEXT } from "@/lib/format";
import { Card, cx, StatusDot } from "@/components/ui";
import { Term } from "@/components/ui/Term";
import { metricCopy } from "./metricCopy";
import { MetricChart } from "./MetricChart";
import { hasTarget, latestValue, metricStatus, STATUS_WORD } from "./metricStatus";

const KIND = {
  lead: { word: "Early signal", explain: "Moves first. It warns us weeks before the results change." },
  lag: { word: "Result", explain: "The outcome we care about. It moves slowly, after the early signals." },
  main: { word: "Main number", explain: "The one number that best shows whether this goal is being met." },
};

export function MetricCard({ metric: m, northStar }: { metric: Metric; northStar: boolean }) {
  const latest = latestValue(m);
  const status = metricStatus(m);
  const copy = metricCopy(m.id, m.label);
  const kind = m.lagging ? KIND.lag : KIND.lead;
  const label = copy.k || copy.explain ? <Term k={copy.k} explain={copy.explain}>{m.label}</Term> : m.label;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h4 className="text-[15px] leading-snug text-ink">{copy.q ?? label}</h4>
        <p className="mt-1 text-xs text-muted">
          {copy.q && <>{label} · </>}
          <Term explain={kind.explain}>{kind.word}</Term>
          {northStar && (
            <>
              {" · "}
              <Term explain={KIND.main.explain}>{KIND.main.word}</Term>
            </>
          )}
        </p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="tabular">
          <div className="text-2xl font-medium tracking-tight text-ink">{latest == null ? "No data" : fmt(latest, m.unit)}</div>
          <div className="mt-0.5 text-xs text-faint">
            {hasTarget(m) ? (
              <>
                target {fmt(m.target, m.unit)}
                {m.direction === "down" && " or lower"}
              </>
            ) : (
              "No target set yet"
            )}
          </div>
        </div>
        {status && (
          <span className={cx("flex shrink-0 items-center gap-1.5 text-xs", STATUS_TEXT[status])}>
            <StatusDot status={status} />
            {STATUS_WORD[status]}
          </span>
        )}
      </div>

      <MetricChart series={m.series} target={hasTarget(m) ? m.target : null} status={status} label={m.label} />

      <p className="mt-auto break-words text-[11px] leading-snug text-faint">
        Where this number comes from: {m.source}
      </p>
    </Card>
  );
}
