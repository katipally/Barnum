import type { Status, Unit, Verdict } from "./types";

export function fmt(value: number, unit: Unit): string {
  switch (unit) {
    case "usd":
      return money(value);
    case "pct":
      return `${round(value, 1)}%`;
    case "pts":
      return `${round(value, 1)} pt`;
    case "months":
      return `${round(value, 1)} mo`;
    case "weeks":
      return `${round(value, 0)} wk`;
    case "ratio":
      return `${round(value, 1)}×`;
    default:
      if (Math.abs(value) >= 1e6) return `${round(value / 1e6, 1)}M`;
      if (Math.abs(value) >= 1e5) return `${round(value / 1e3, 0)}k`;
      return Math.round(value).toLocaleString("en-US");
  }
}

export function money(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${round(a / 1e9, 1)}B`;
  if (a >= 1e6) return `${s}$${round(a / 1e6, 1)}M`;
  if (a >= 1e3) return `${s}$${round(a / 1e3, a >= 1e5 ? 0 : 1)}k`;
  return `${s}$${Math.round(a)}`;
}

export function round(v: number, d: number): string {
  return Number(v.toFixed(d)).toLocaleString("en-US");
}

export const STATUS_LABEL: Record<Status, string> = {
  on_track: "On track",
  at_risk: "Needs attention",
  off_track: "Off track",
};

// Tailwind classes per status / verdict (tokens from globals.css)
export const STATUS_DOT: Record<Status, string> = {
  on_track: "bg-ok",
  at_risk: "bg-warn",
  off_track: "bg-bad",
};
export const STATUS_TEXT: Record<Status, string> = {
  on_track: "text-ok",
  at_risk: "text-warn",
  off_track: "text-bad",
};
export const VERDICT_STYLE: Record<Verdict, string> = {
  scale: "text-ok border-ok/40",
  hold: "text-muted border-line",
  cut: "text-bad border-bad/40",
  test: "text-info border-info/40",
};
