"use client";

import { CLIMB } from "./climbData";

// How the agent itself is improving: a hill climb over its decision rules on CMO-Bench (simulated weeks fitted to
// our Snowflake data). Demo snapshot from evals/hillclimb.py; one point per search generation.
const OFFSPRING = 8;

function perGeneration() {
  const exps = CLIMB.experiments;
  const gens = Math.max(...exps.map((e) => (e.i === 0 ? 0 : Math.ceil(e.i / OFFSPRING))));
  return Array.from({ length: gens + 1 }, (_, g) => {
    const group = exps.filter((e) => (e.i === 0 ? 0 : Math.ceil(e.i / OFFSPRING)) === g);
    const end = group[group.length - 1];
    return {
      regret: end.best,
      heldOut: end.best_test + CLIMB.trap_penalty * end.best_failed,
      traps: CLIMB.traps_total - end.best_failed,
      safe: (100 * group.filter((e) => e.failed === 0).length) / group.length,
    };
  });
}

export function HillClimbStrip() {
  const g = perGeneration();
  const first = g[0];
  const last = g[g.length - 1];
  const safeRecent = g.slice(-4).reduce((s, x) => s + x.safe, 0) / 4;
  return (
    <section data-tour="agent-evals" className="panel mb-6 px-5 py-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-ink">How I&apos;m getting better</h2>
        <p className="text-[11px] text-faint">CMO-Bench, {g.length - 1} rounds of tuning on simulated weeks built from your data</p>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Regret" value={last.regret.toFixed(2)} from={first.regret.toFixed(2)} values={g.map((x) => x.regret)} lowerIsBetter />
        <Metric label="Regret on held-out weeks" value={last.heldOut.toFixed(2)} from={first.heldOut.toFixed(2)} values={g.map((x) => x.heldOut)} lowerIsBetter />
        <Metric label="Known mistakes avoided" value={`${last.traps}/${CLIMB.traps_total}`} from={`${first.traps}/${CLIMB.traps_total}`} values={g.map((x) => x.traps)} />
        <Metric label="Safe candidates" value={`${Math.round(safeRecent)}%`} from={`${Math.round(first.safe)}%`} values={g.map((x) => x.safe)} />
      </div>
    </section>
  );
}

function Metric({ label, value, from, values, lowerIsBetter }: { label: string; value: string; from: string; values: number[]; lowerIsBetter?: boolean }) {
  return (
    <div className="well min-w-0 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="shrink-0 text-[11px] text-faint">from {from}</p>
      </div>
      <p className="mt-0.5 text-xl font-medium tabular-nums text-ink">{value}</p>
      <MiniLine values={values} invert={lowerIsBetter} />
    </div>
  );
}

// A small line that rises as the metric improves (lower-is-better metrics are drawn inverted).
function MiniLine({ values, invert }: { values: number[]; invert?: boolean }) {
  const w = 200;
  const h = 36;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const norm = (v: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (invert ? 1 - norm(v) : norm(v)) * (h - 6)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1.5 h-9 w-full" aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--color-accent)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
