import React from "react";
import { useCurrentFrame } from "remotion";
import { Card, Headline, Scene } from "../components";
import { c, font } from "../theme";
import { ramp, rise } from "../anim";

const GOALS = [
  { label: "Net new ARR", prefix: "$", to: 2.2, suffix: "M", decimals: 1, note: "FY target" },
  { label: "CAC payback", prefix: "< ", to: 14, suffix: " mo", decimals: 0, note: "Guardrail" },
  { label: "Burn multiple", prefix: "≤ ", to: 1.5, suffix: "", decimals: 1, note: "Guardrail" },
];

export const Goals: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Scene>
      <Headline step="01" label="Business goals" title="The CEO sets the goals" />
      <div
        style={{
          position: "absolute",
          left: 140,
          right: 140,
          top: 350,
          display: "flex",
          gap: 40,
        }}
      >
        {GOALS.map((g, i) => {
          const t = rise(frame, 26 + i * 10, 18);
          const count = ramp(frame, 30 + i * 10, 70 + i * 10);
          const v = (g.to * count).toFixed(g.decimals);
          return (
            <Card
              key={g.label}
              style={{
                flex: 1,
                padding: "44px 48px",
                opacity: Math.min(1, t * 1.4),
                transform: `translateY(${(1 - t) * 80}px) scale(${0.94 + 0.06 * t})`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 32, color: c.muted }}>{g.label}</div>
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: 18,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: c.faint,
                    border: `1px solid ${c.lineStrong}`,
                    padding: "6px 12px",
                  }}
                >
                  {g.note}
                </div>
              </div>
              <div
                style={{
                  marginTop: 28,
                  fontSize: 104,
                  fontWeight: 600,
                  letterSpacing: -3,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {g.prefix}
                {v}
                {g.suffix}
              </div>
            </Card>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 740,
          fontSize: 36,
          color: c.muted,
          opacity: ramp(frame, 95, 115),
          transform: `translateY(${(1 - ramp(frame, 95, 115)) * 14}px)`,
        }}
      >
        Outcomes and guardrails. <span style={{ color: c.ink }}>Not a marketing plan.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 810,
          fontFamily: font.mono,
          fontSize: 26,
          color: c.faint,
          opacity: ramp(frame, 120, 140),
        }}
      >
        Quarterly budget $160k · autonomy limit 10%
      </div>
    </Scene>
  );
};
