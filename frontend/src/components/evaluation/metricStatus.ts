import type { Metric, Status } from "@/lib/types";

export const STATUS_WORD: Record<Status, string> = {
  on_track: "On track",
  at_risk: "Needs attention",
  off_track: "Off track",
};

export function latestValue(m: Metric): number | null {
  return m.series.length ? m.series[m.series.length - 1].value : null;
}

// A target of 0 means none has been set yet (live data before steering).
export const hasTarget = (m: Metric) => Number.isFinite(m.target) && m.target !== 0;

// Direction-aware attainment: latest vs target, where >= 1 means the target is met.
export function attainment(m: Metric): number | null {
  const v = latestValue(m);
  if (v == null || !hasTarget(m)) return null;
  if (m.direction === "up") return v / m.target;
  return v <= 0 ? 1 : m.target / v;
}

export function metricStatus(m: Metric): Status | null {
  const a = attainment(m);
  if (a == null) return null;
  if (a >= 1) return "on_track";
  if (a >= 0.9) return "at_risk";
  return "off_track";
}
