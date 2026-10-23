import React from "react";
import { useCurrentFrame } from "remotion";
import { Headline, Scene } from "../components";
import { c, font } from "../theme";
import { mix, ramp, rise } from "../anim";

const EVIDENCE = [
  { src: "Snowflake: FUNNEL_FACT", text: "Core keywords at $946 per conversion over 8 weeks" },
  { src: "Markov attribution", text: "NLP labeling carries 31% of SQL credit on 18% of spend" },
  { src: "Guardrail check", text: "Burn multiple stays at 1.4 — inside the 1.5 limit" },
];

// Approve button centre in canvas coordinates
const BTN = { x: 339, y: 873 };

export const Decision: React.FC = () => {
  const frame = useCurrentFrame();
  const card = rise(frame, 14, 18);
  const click = 168;
  const cursorT = ramp(frame, 120, 162);
  const cx = mix(cursorT, 1500, BTN.x + 10);
  const cy = mix(cursorT, 1020, BTN.y);
  const press = frame >= click && frame < click + 6 ? 0.94 : 1;
  const approved = ramp(frame, click + 2, click + 14);
  const check = ramp(frame, click + 6, click + 22);

  return (
    <Scene>
      <Headline step="05" label="Decision" title="…and asks you only what matters" />

      <div
        style={{
          position: "absolute",
          left: 140,
          top: 300,
          width: 1640,
          boxSizing: "border-box",
          background: c.surface,
          border: `1px solid ${c.lineStrong}`,
          borderTop: `3px solid ${c.gold}`,
          padding: "40px 48px",
          opacity: Math.min(1, card * 1.4),
          transform: `translateX(${(1 - card) * 160}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 20,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: c.gold,
              background: c.goldSoft,
              padding: "8px 14px",
            }}
          >
            Needs your decision
          </span>
          <span style={{ fontFamily: font.mono, fontSize: 20, color: c.faint }}>above autonomy limit · 12.5%</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 58, fontWeight: 600, letterSpacing: -1.5 }}>
          Move $20k from core keywords to NLP labeling
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 56, fontSize: 34 }}>
          <span>
            <span style={{ color: c.ok, fontWeight: 600 }}>+210</span>{" "}
            <span style={{ color: c.muted }}>conversions / qtr</span>
          </span>
          <span>
            <span style={{ color: c.muted }}>CAC payback</span>{" "}
            <span style={{ fontWeight: 600 }}>15.2 → </span>
            <span style={{ fontWeight: 600 }}>14.1 mo</span>
          </span>
        </div>

        <div style={{ marginTop: 30, borderTop: `1px solid ${c.line}` }}>
          {EVIDENCE.map((e, i) => {
            const t = rise(frame, 46 + i * 14);
            return (
              <div
                key={e.src}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 28,
                  padding: "16px 0",
                  borderBottom: `1px solid ${c.line}`,
                  opacity: t,
                  transform: `translateY(${(1 - t) * 14}px)`,
                }}
              >
                <span style={{ fontFamily: font.mono, fontSize: 24, color: c.gold, width: 400, flexShrink: 0 }}>
                  {e.src}
                </span>
                <span style={{ fontSize: 30, color: c.ink }}>{e.text}</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 34, display: "flex", gap: 20, alignItems: "center", height: 76 }}>
          <div
            style={{
              height: 76,
              width: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              background: c.gold,
              color: c.bg,
              fontSize: 32,
              fontWeight: 600,
              transform: `scale(${press})`,
            }}
          >
            {approved > 0.5 ? (
              <>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                  <path
                    d="M5 16l7 7 13-15"
                    stroke={c.bg}
                    strokeWidth="3.5"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - check}
                  />
                </svg>
                Approved
              </>
            ) : (
              "Approve"
            )}
          </div>
          <div
            style={{
              height: 76,
              width: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${c.lineStrong}`,
              color: c.muted,
              fontSize: 30,
              opacity: 1 - approved * 0.6,
            }}
          >
            Discuss
          </div>
          <div
            style={{
              marginLeft: 24,
              fontSize: 28,
              color: c.muted,
              opacity: approved,
              transform: `translateX(${(1 - approved) * -16}px)`,
            }}
          >
            Logged · executes Monday · reviewed in week 10
          </div>
        </div>
      </div>

      {/* cursor */}
      <svg
        width="44"
        height="54"
        viewBox="0 0 22 27"
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          opacity: ramp(frame, 116, 126),
          transform: `scale(${press})`,
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
        }}
      >
        <path d="M1 1 L1 21 L6.5 16 L10 25 L13.5 23.5 L10 15 L18 15 Z" fill={c.ink} stroke={c.bg} strokeWidth="1.5" />
      </svg>
    </Scene>
  );
};
