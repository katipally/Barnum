import React from "react";
import { useCurrentFrame } from "remotion";
import { Card, Headline, Scene } from "../components";
import { c, font } from "../theme";
import { mix, ramp, rise } from "../anim";

const LOG = [
  { t: "Mon 09:02", text: "Paused 3 zero-conversion tests", amt: 2.1, kind: "ok" },
  { t: "Mon 09:04", text: "Shifted $3k within search", amt: 3.0, kind: "ok" },
  { t: "Tue 14:30", text: "Raised webinar promo cap", amt: 1.2, kind: "ok" },
  { t: "Wed 08:15", text: "Refreshed audiences from Snowflake", amt: 0, kind: "ok" },
  { t: "Thu 10:40", text: "Move $20k off core keywords", amt: 0, kind: "esc" },
];

const BUDGET = 160; // $k per quarter
const LIMIT = 10; // %
const SCALE = 25; // meter max %

export const Autonomy: React.FC = () => {
  const frame = useCurrentFrame();
  const start = 34;
  const gap = 26;

  let moved = 0;
  LOG.forEach((l, i) => {
    moved += l.amt * ramp(frame, start + i * gap, start + i * gap + 14);
  });
  const usedPct = (moved / BUDGET) * 100;
  const escT = ramp(frame, start + 4 * gap + 6, start + 4 * gap + 30);
  const ghostPct = mix(escT, 0, (20 / BUDGET) * 100);

  return (
    <Scene>
      <Headline step="04" label="Autonomy" title="It acts on its own — within limits" />

      <Card
        style={{
          position: "absolute",
          left: 140,
          top: 330,
          width: 1000,
          height: 560,
          boxSizing: "border-box",
          padding: "36px 40px",
          opacity: rise(frame, 14),
        }}
      >
        <div
          style={{
            fontFamily: font.mono,
            fontSize: 20,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: c.faint,
            marginBottom: 20,
          }}
        >
          Autonomy log · week 9
        </div>
        {LOG.map((l, i) => {
          const t = rise(frame, start + i * gap, 22);
          const esc = l.kind === "esc";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: "22px 0",
                borderTop: i ? `1px solid ${c.line}` : "none",
                opacity: t,
                transform: `translateY(${(1 - t) * 20}px)`,
              }}
            >
              <span style={{ fontFamily: font.mono, fontSize: 22, color: c.faint, width: 140 }}>{l.t}</span>
              <span
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1.5px solid ${esc ? c.warn : c.ok}`,
                  color: esc ? c.warn : c.ok,
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  {esc ? (
                    <path d="M9 15V3M4 8l5-5 5 5" stroke="currentColor" strokeWidth="2.2" />
                  ) : (
                    <path d="M3 9.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" />
                  )}
                </svg>
              </span>
              <span style={{ fontSize: 32, color: esc ? c.warn : c.ink, flex: 1 }}>{l.text}</span>
              <span style={{ fontFamily: font.mono, fontSize: 22, color: esc ? c.warn : c.faint }}>
                {esc ? "escalate" : "done"}
              </span>
            </div>
          );
        })}
      </Card>

      {/* meter */}
      <Card
        style={{
          position: "absolute",
          left: 1200,
          top: 330,
          width: 580,
          height: 560,
          boxSizing: "border-box",
          padding: "36px 40px",
          opacity: rise(frame, 22),
        }}
      >
        <div
          style={{
            fontFamily: font.mono,
            fontSize: 20,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: c.faint,
          }}
        >
          Budget moved this quarter
        </div>
        <div style={{ marginTop: 18, fontSize: 92, fontWeight: 600, letterSpacing: -3, fontVariantNumeric: "tabular-nums" }}>
          {usedPct.toFixed(1)}%
        </div>
        <div style={{ fontSize: 26, color: c.muted }}>of $160k, without asking</div>

        <div style={{ position: "relative", marginTop: 70, height: 36 }}>
          <div style={{ position: "absolute", inset: 0, background: c.surface3 }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(usedPct / SCALE) * 100}%`,
              background: c.ok,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${(usedPct / SCALE) * 100}%`,
              top: 0,
              bottom: 0,
              width: `${(ghostPct / SCALE) * 100}%`,
              background: `repeating-linear-gradient(135deg, rgba(229,83,75,0.55) 0 8px, rgba(229,83,75,0.2) 8px 16px)`,
              outline: escT > 0 ? `1px solid ${c.bad}` : "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${(LIMIT / SCALE) * 100}%`,
              top: -16,
              bottom: -16,
              width: 3,
              background: c.gold,
            }}
          />
        </div>
        <div style={{ position: "relative", height: 70 }}>
          <div
            style={{
              position: "absolute",
              left: `${(LIMIT / SCALE) * 100}%`,
              transform: "translateX(-50%)",
              top: 24,
              fontSize: 26,
              color: c.gold,
              whiteSpace: "nowrap",
            }}
          >
            Autonomy limit 10%
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 30,
            color: c.bad,
            opacity: escT,
            transform: `translateY(${(1 - escT) * 12}px)`,
          }}
        >
          +12.5% would cross the line.
          <div style={{ color: c.muted, fontSize: 26, marginTop: 8 }}>So it asks.</div>
        </div>
      </Card>
    </Scene>
  );
};
