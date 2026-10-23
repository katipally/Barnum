import type { MetricPoint, Status } from "@/lib/types";
import { cx } from "@/components/ui";

const W = 320;
const H = 72;
const PAD = { t: 8, r: 8, b: 8, l: 4 };

const DOT_FILL: Record<Status, string> = { on_track: "fill-ok", at_risk: "fill-warn", off_track: "fill-bad" };

// Small weekly line with a dashed target. Scales uniformly with its container width.
export function MetricChart({
  series,
  target,
  status,
  label,
}: {
  series: MetricPoint[];
  target: number | null;
  status: Status | null;
  label: string;
}) {
  const pts = [...series].sort((a, b) => a.week - b.week);
  if (pts.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md bg-surface-2 text-xs text-faint">
        {pts.length ? "Only one week of data so far" : "No data yet"}
      </div>
    );
  }
  const values = [...pts.map((p) => p.value), ...(target != null ? [target] : [])];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const w0 = Math.min(1, pts[0].week);
  const w1 = Math.max(pts[pts.length - 1].week, w0 + 1);
  const x = (week: number) => PAD.l + ((week - w0) / (w1 - w0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${x(p.week).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${label}, week by week${target != null ? " against target" : ""}`}>
        {target != null && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className="stroke-muted" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" />
        )}
        <path d={d} fill="none" className="stroke-ink" strokeOpacity={0.7} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.week)} cy={y(last.value)} r={6} className={cx(status ? DOT_FILL[status] : "fill-ink")} fillOpacity={0.18} />
        <circle cx={x(last.week)} cy={y(last.value)} r={3.5} className={cx(status ? DOT_FILL[status] : "fill-ink", "stroke-surface")} strokeWidth={1.5} />
      </svg>
      <div className="tabular mt-1 flex justify-between text-[10px] text-faint">
        <span>Week {pts[0].week}</span>
        {target != null && (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="14" y2="2" className="stroke-muted" strokeDasharray="3 3" />
            </svg>
            Target
          </span>
        )}
        <span>Week {last.week}</span>
      </div>
    </div>
  );
}
