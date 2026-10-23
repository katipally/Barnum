import type { Status } from "@/lib/types";

// Sparkline with a soft area, dashed target line and a glowing end point.
export function Spark({ values, target, status, id }: { values: number[]; target?: number; status: Status; id: string }) {
  const w = 240;
  const h = 64;
  const pts = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const all = target ? [...pts, target] : pts;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const y = (v: number) => (hi === lo ? h / 2 : h - 6 - ((v - lo) / (hi - lo)) * (h - 14));
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (w - 16);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const color = status === "off_track" ? "var(--color-bad)" : "var(--color-accent)";
  const last = pts.length - 1;
  return (
    <div className="relative">
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {target !== undefined && target > 0 && (
        <line x1="0" x2={w} y1={y(target)} y2={y(target)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sp-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
      {/* The end point lives outside the stretched SVG so it stays round. */}
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.75px] bg-bg"
        style={{ left: `${(x(last) / w) * 100}%`, top: `${(y(pts[last]) / h) * 100}%`, borderColor: color, boxShadow: `0 0 10px ${color}` }}
      />
    </div>
  );
}
