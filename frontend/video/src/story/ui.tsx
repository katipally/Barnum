import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { c, font, FPS } from "../theme";
import { ramp, rise } from "../anim";
import { LEAD, sceneOf, type Word } from "./timing";

/** Fades a scene in and out so consecutive scenes dip through the background. */
export const Stage: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, 10), 1 - ramp(f, frames - 10, frames));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** Caption: the sentence being spoken, with the current word in gold. */
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
  const active = sentences.find((s) => t <= s[s.length - 1].end + 0.25) ?? sentences[sentences.length - 1];
  const fade = interpolate(t, [active[0].start - 0.3, active[0].start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", opacity: fade }}>
      <div style={{ maxWidth: 1400, textAlign: "center", fontFamily: font.sans, fontSize: 34, lineHeight: 1.35, fontWeight: 500 }}>
        {active.map((w, i) => {
          const spoken = t >= w.start;
          const now = spoken && t <= w.end + 0.05;
          return (
            <span key={i} style={{ color: now ? c.gold : spoken ? c.ink : c.faint, transition: "none" }}>
              {w.w.replace(/\bC\.M\.O\.?/g, "CMO").replace(/\bC\.E\.O\.?/g, "CEO").replace(/\bS\.E\.O\.?/g, "SEO").replace(/\bA\.I\.?/g, "AI")}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; at?: number }> = ({ children, at = 0 }) => {
  const f = useCurrentFrame();
  const p = rise(f, at);
  return (
    <div style={{ fontFamily: font.mono, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: c.gold, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
      {children}
    </div>
  );
};

/** Big line of display type that rises in at frame `at`. */
export const Big: React.FC<{ children: React.ReactNode; at: number; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, at, size = 112, color = c.ink, style }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 18);
  return (
    <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.03em", color, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px)`, ...style }}>
      {children}
    </div>
  );
};

/** A gold underline that sweeps in under a word. */
export const Sweep: React.FC<{ at: number; width: number }> = ({ at, width }) => {
  const f = useCurrentFrame();
  return <div style={{ height: 8, width: width * ramp(f, at, at + 14), background: c.gold, borderRadius: 4, marginTop: 10 }} />;
};

// Glass panel, as .panel in the web app: faint top light, hairline border, inner highlight.
export const glass: React.CSSProperties = {
  background: `linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008) 40%, transparent), ${c.surface}`,
  border: `1px solid ${c.line}`,
  borderRadius: 18,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 30px 60px -30px rgba(0,0,0,0.7)",
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...glass, ...style }}>{children}</div>
);

// Simple line glyphs for each channel (no brand logos).
export const Glyph: React.FC<{ kind: string; size?: number; color?: string }> = ({ kind, size = 56, color = c.ink }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    conferences: (<><circle cx="16" cy="18" r="5" {...p} /><circle cx="32" cy="14" r="6" {...p} /><circle cx="48" cy="18" r="5" {...p} /><path d="M6 44c2-9 18-9 20 0M22 44c2-11 18-11 20 0M38 44c2-9 18-9 20 0" {...p} /><path d="M4 52h56" {...p} /></>),
    billboards: (<><rect x="6" y="8" width="52" height="28" rx="3" {...p} /><path d="M18 36v20M46 36v20M14 18h24M14 26h16" {...p} /></>),
    google: (<><circle cx="27" cy="27" r="15" {...p} /><path d="M38 38l16 16" {...p} /><path d="M20 27h14" {...p} /></>),
    email: (<><rect x="6" y="14" width="52" height="36" rx="4" {...p} /><path d="M8 18l24 18 24-18" {...p} /></>),
    linkedin: (<><rect x="8" y="8" width="48" height="48" rx="8" {...p} /><circle cx="22" cy="22" r="3" {...p} /><path d="M22 30v16M32 46V30M32 36c0-8 14-8 14 0v10" {...p} /></>),
    seo: (<><path d="M8 54h48" {...p} /><path d="M14 46v-8M26 46V30M38 46V22M50 46V12" {...p} /><path d="M44 12h6v6" {...p} /></>),
    ai: (<><path d="M10 14h44v28H30l-10 10V42H10z" {...p} /><path d="M32 20l2.5 6 6 2.5-6 2.5L32 37l-2.5-6-6-2.5 6-2.5z" {...p} /></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {paths[kind]}
    </svg>
  );
};

export const CHANNELS = [
  { kind: "conferences", name: "Conferences", metric: "Badge scans", lag: 3.2 },
  { kind: "billboards", name: "Billboards", metric: "Impressions", lag: 4 },
  { kind: "google", name: "Google Ads", metric: "Clicks", lag: 0.4 },
  { kind: "email", name: "Cold email", metric: "Replies", lag: 1 },
  { kind: "linkedin", name: "LinkedIn", metric: "Leads", lag: 1.4 },
  { kind: "seo", name: "SEO", metric: "Rankings", lag: 3.6 },
  { kind: "ai", name: "AI answers", metric: "Citations", lag: 3 },
];
