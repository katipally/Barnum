// Shared look for the submission film, after refs/style-reference.webp: glass cards, hairlines, light numerals, glowing lines, one lavender accent.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { c, font, FPS } from "../theme";
import { ramp, rise } from "../anim";
import { LEAD, sceneOf, type Word } from "./timing";

export { Glyph, CHANNELS } from "../story/ui";

export const GLOW = "rgba(185,167,255,0.45)";
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/** Fades a scene in and out so consecutive scenes dip through the background. */
export const Stage: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, 3), 1 - ramp(f, frames - 3, frames));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const spell = (w: string) =>
  w
    .replace(/\bC\.M\.O\.?/g, "CMO")
    .replace(/\bC\.E\.O\.?/g, "CEO")
    .replace(/\bS\.E\.O\.?/g, "SEO")
    .replace(/\bS\.Q\.L\.?/g, "SQL");

/** Subtitle: the sentence being spoken, current word in the accent. Sits in the bottom 120px band; keep scene content above y≈930. */
export const Caption: React.FC<{ id: string }> = ({ id }) => {
  const f = useCurrentFrame();
  const t = (f - LEAD) / FPS;
  const words = sceneOf(id).words;
  const sentences: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.?!:]$/.test(w.w)) sentences.push(cur), (cur = []);
  }
  if (cur.length) sentences.push(cur);
  const active = sentences.find((s) => t <= s[s.length - 1].end + 0.2) ?? sentences[sentences.length - 1];
  const fade = interpolate(t, [active[0].start - 0.25, active[0].start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity: fade }}>
      <div style={{ maxWidth: 1400, textAlign: "center", fontFamily: font.sans, fontSize: 30, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.005em" }}>
        {active.map((w, i) => {
          const spoken = t >= w.start;
          const now = spoken && t <= w.end + 0.05;
          return (
            <span key={i} style={{ color: now ? c.accent : spoken ? c.ink : c.faint }}>
              {spell(w.w)}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// Glass panel, as .panel in the web app: faint top light, hairline border, inner highlight.
export const glass: React.CSSProperties = {
  background: `linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008) 40%, transparent), ${c.surface}`,
  border: `1px solid ${c.line}`,
  borderRadius: 20,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 60px -30px rgba(0,0,0,0.8)",
  boxSizing: "border-box",
};

export const Card: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...glass, ...style }}>{children}</div>
);

/** The violet hero card from the reference (right column): gradient from surface into lavender. */
export const heroGlass: React.CSSProperties = {
  ...glass,
  background: "linear-gradient(165deg, rgba(20,18,38,0.96) 0%, rgba(42,30,92,0.92) 55%, rgba(122,96,224,0.85) 100%)",
  border: "1px solid rgba(185,167,255,0.32)",
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 90px -40px ${GLOW}`,
};

/** Absolutely positioned box (1920×1080 space) that rises in at frame `at`. */
export const Abs: React.FC<{ x: number; y: number; w?: number; h?: number; at: number; children: React.ReactNode; style?: React.CSSProperties; lift?: number }> = ({ x, y, w, h, at, children, style, lift = 24 }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 18);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * lift}px)`, ...style }}>
      {children}
    </div>
  );
};

/** Small muted label + optional count chip, like "Recommended coins for 24 hours  [3 Assets]". */
export const Label: React.FC<{ children: React.ReactNode; chip?: string; size?: number; style?: React.CSSProperties }> = ({ children, chip, size = 22, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: font.sans, fontSize: size, color: c.muted, ...style }}>
    <span>{children}</span>
    {chip && <Chip size={size * 0.82}>{chip}</Chip>}
  </div>
);

/** Large light-weight title, e.g. "Top Staking Assets". */
export const Title: React.FC<{ children: React.ReactNode; size?: number; at?: number; style?: React.CSSProperties }> = ({ children, size = 64, at = 0, style }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 18);
  return (
    <div style={{ fontFamily: font.sans, fontWeight: 400, fontSize: size, lineHeight: 1.08, letterSpacing: "-0.025em", color: c.ink, opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 26}px)`, ...style }}>
      {children}
    </div>
  );
};

/** Pill chip with hairline border; `caret` adds the small ▾ of the reference's filter chips; `active` fills it with the accent. */
export const Chip: React.FC<{ children: React.ReactNode; size?: number; caret?: boolean; active?: boolean; style?: React.CSSProperties }> = ({ children, size = 20, caret, active, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.45,
      padding: `${size * 0.32}px ${size * 0.75}px`,
      borderRadius: size * 0.55,
      fontFamily: font.sans,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
      color: active ? c.accentInk : c.ink,
      background: active ? c.accent : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "transparent" : c.lineStrong}`,
      ...style,
    }}
  >
    {caret && <span style={{ fontSize: size * 0.6, color: active ? c.accentInk : c.muted }}>▼</span>}
    {children}
  </span>
);

/** Big light numeral with a smaller unit, e.g. <Num value="13.62" unit="%" />; `prefix` for "$"; `dim` greys trailing digits like "31.39686". */
export const Num: React.FC<{ value: string; unit?: string; prefix?: string; size?: number; dim?: number; color?: string; style?: React.CSSProperties }> = ({ value, unit, prefix, size = 96, dim = 0, color = c.ink, style }) => {
  const head = dim ? value.slice(0, value.length - dim) : value;
  const tail = dim ? value.slice(value.length - dim) : "";
  return (
    <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: size, lineHeight: 1, letterSpacing: "-0.035em", color, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix && <span style={{ fontSize: size * 0.62, marginRight: size * 0.02, verticalAlign: "0.28em" }}>{prefix}</span>}
      {head}
      {tail && <span style={{ color: c.faint }}>{tail}</span>}
      {unit && <span style={{ fontSize: size * 0.5, marginLeft: size * 0.04, color: c.ink, opacity: 0.85 }}>{unit}</span>}
    </div>
  );
};

/** Small status delta with a filled dot: green when good, red when bad. */
export const Delta: React.FC<{ children: React.ReactNode; good?: boolean; size?: number; style?: React.CSSProperties }> = ({ children, good = true, size = 20, style }) => {
  const col = good ? c.ok : c.bad;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, fontFamily: font.sans, fontSize: size, color: col, whiteSpace: "nowrap", ...style }}>
      <span style={{ width: size * 0.8, height: size * 0.8, borderRadius: "50%", background: col, boxShadow: `0 0 ${size * 0.6}px ${col}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.bg, fontSize: size * 0.55, fontWeight: 700 }}>
        {good ? "↑" : "↓"}
      </span>
      {children}
    </span>
  );
};

/** Pill button: primary = lavender fill, otherwise hairline ghost. */
export const Button: React.FC<{ children: React.ReactNode; primary?: boolean; size?: number; style?: React.CSSProperties }> = ({ children, primary, size = 22, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `${size * 0.6}px ${size * 1.1}px`,
      borderRadius: size * 0.6,
      fontFamily: font.sans,
      fontSize: size,
      fontWeight: 500,
      color: primary ? c.accentInk : c.ink,
      background: primary ? `linear-gradient(180deg, #cdbfff, ${c.accent})` : "rgba(255,255,255,0.03)",
      border: `1px solid ${primary ? "rgba(255,255,255,0.25)" : c.lineStrong}`,
      boxShadow: primary ? `0 10px 30px -10px ${GLOW}` : "none",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </span>
);

/** Glowing line chart (reference: card sparklines). `points` are 0..1 values; `draw` 0..1 reveals left to right.
 *  `markers` are point indices that get a ringed dot once drawn; `label` floats above the last marker. */
export const GlowLine: React.FC<{
  points: number[];
  w: number;
  h: number;
  draw?: number;
  color?: string;
  markers?: number[];
  label?: string;
  baseline?: number;
  fill?: boolean;
  strokeWidth?: number;
}> = ({ points, w, h, draw = 1, color = c.accent, markers = [], label, baseline, fill = true, strokeWidth = 3 }) => {
  const id = React.useId().replace(/:/g, "");
  const pad = 14;
  const xy = points.map((v, i) => ({ x: pad + (i / (points.length - 1)) * (w - pad * 2), y: pad + (1 - v) * (h - pad * 2) }));
  // Catmull-Rom → cubic Bézier for a smooth curve.
  let d = `M ${xy[0].x} ${xy[0].y}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  const clipW = pad + draw * (w - pad);
  const last = markers.length ? xy[markers[markers.length - 1]] : null;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`g${id}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id={`c${id}`}>
          <rect x={-20} y={-60} width={clipW + 20} height={h + 120} />
        </clipPath>
      </defs>
      {baseline !== undefined && (
        <line x1={0} x2={w} y1={pad + (1 - baseline) * (h - pad * 2)} y2={pad + (1 - baseline) * (h - pad * 2)} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 6" strokeWidth={1.5} />
      )}
      <g clipPath={`url(#c${id})`}>
        {fill && <path d={`${d} L ${xy[xy.length - 1].x} ${h} L ${xy[0].x} ${h} Z`} fill={`url(#f${id})`} />}
        <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth * 2.4} opacity={0.55} filter={`url(#g${id})`} />
        <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        {markers.map((m) => (
          <g key={m}>
            <circle cx={xy[m].x} cy={xy[m].y} r={9} fill={c.bg} stroke={color} strokeWidth={2.5} />
            <circle cx={xy[m].x} cy={xy[m].y} r={3.5} fill={color} />
          </g>
        ))}
      </g>
      {label && last && clipW >= last.x && (
        <text x={last.x - 14} y={last.y - 24} textAnchor="end" fill={c.ink} style={{ fontFamily: font.sans, fontSize: 22 }}>
          {label}
        </text>
      )}
    </svg>
  );
};

/** Round icon tile like the coin badges in the reference (soft square, tinted). */
export const IconTile: React.FC<{ children: React.ReactNode; size?: number; tint?: string }> = ({ children, size = 64, tint = c.accentSoft }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.26, background: tint, border: `1px solid ${c.lineStrong}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {children}
  </div>
);

/** Circular ghost button with ↗, as on the reference's asset cards. */
export const ArrowDot: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: `1px solid ${c.lineStrong}`, display: "flex", alignItems: "center", justifyContent: "center", color: c.ink, fontSize: size * 0.42, fontFamily: font.sans }}>↗</div>
);
