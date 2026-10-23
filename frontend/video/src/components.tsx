import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { c, font } from "./theme";
import { ramp, rise } from "./anim";

/** Fades a scene in and out over its Sequence so Series overlaps cross-dissolve. */
export const Scene: React.FC<{ children: React.ReactNode; fadeIn?: number; fadeOut?: number }> = ({
  children,
  fadeIn = 12,
  fadeOut = 12,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inT = fadeIn ? ramp(frame, 0, fadeIn) : 1;
  const outT = fadeOut ? 1 - ramp(frame, durationInFrames - fadeOut, durationInFrames) : 1;
  return (
    <AbsoluteFill style={{ opacity: Math.min(inT, outT), fontFamily: font.sans, color: c.ink }}>
      {children}
    </AbsoluteFill>
  );
};

/** Kicker + headline with a word-by-word rise. */
export const Headline: React.FC<{ step: string; label: string; title: string; delay?: number }> = ({
  step,
  label,
  title,
  delay = 4,
}) => {
  const frame = useCurrentFrame();
  const words = title.split(" ");
  const k = rise(frame, delay);
  return (
    <div style={{ position: "absolute", left: 140, top: 92, right: 140 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontFamily: font.mono,
          fontSize: 24,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: c.muted,
          opacity: k,
          transform: `translateY(${(1 - k) * 12}px)`,
        }}
      >
        <span style={{ color: c.gold }}>{step}</span>
        <span style={{ width: 40, height: 1, background: c.lineStrong }} />
        <span>{label}</span>
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: -2,
          lineHeight: 1.08,
          display: "flex",
          flexWrap: "wrap",
          columnGap: 20,
        }}
      >
        {words.map((w, i) => {
          const t = rise(frame, delay + 4 + i * 3);
          return (
            <span
              key={i}
              style={{ opacity: t, transform: `translateY(${(1 - t) * 28}px)`, display: "inline-block" }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}> = ({ children, style, accent }) => (
  <div
    style={{
      background: c.surface,
      border: `1px solid ${c.lineStrong}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${c.lineStrong}`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Dot: React.FC<{ color: string; size?: number; style?: React.CSSProperties }> = ({
  color,
  size = 12,
  style,
}) => (
  <span
    style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: size,
      background: color,
      flexShrink: 0,
      ...style,
    }}
  />
);

/** The gold mark: a tiny revenue tree (one root, three drivers). */
export const Mark: React.FC<{ size?: number; draw?: number }> = ({ size = 64, draw = 1 }) => {
  const len = 60;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="1" y="1" width="62" height="62" stroke={c.gold} strokeWidth="2" opacity={draw} />
      {[16, 32, 48].map((y, i) => (
        <path
          key={y}
          d={`M18 32 C 30 32, 30 ${y}, 42 ${y}`}
          stroke={c.gold}
          strokeWidth="2.5"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - Math.min(1, Math.max(0, draw * 3 - i)))}
        />
      ))}
      <circle cx="18" cy="32" r="4" fill={c.gold} />
      {[16, 32, 48].map((y) => (
        <circle key={y} cx="46" cy={y} r="3.5" fill={c.gold} opacity={draw} />
      ))}
    </svg>
  );
};

/** Faint grid + vignette backdrop shared by every scene. */
// Matches the web app: blue-black canvas, violet and blue glows, faint drifting dot grid.
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.12) % 28;
  return (
    <AbsoluteFill style={{ background: c.bg }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(1350px 720px at 85% -10%, rgba(139,109,255,0.14), transparent 70%), radial-gradient(1050px 630px at 0% 110%, rgba(126,166,255,0.07), transparent 70%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.4px, transparent 1.4px)",
          backgroundSize: "28px 28px",
          backgroundPosition: `${drift}px ${drift}px`,
          opacity: 0.55,
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 75% 65% at 50% 45%, rgba(7,7,13,0) 0%, rgba(7,7,13,0.55) 75%, #07070d 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
