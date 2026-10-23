import React from "react";
import { useCurrentFrame } from "remotion";
import { Headline, Scene } from "../components";
import { c, font } from "../theme";
import { mix, ramp, rise } from "../anim";

const CASES = [
  {
    name: "Fieldnote",
    stage: "Pre-PMF",
    goal: "Learn: find the segment that stays",
    tree: "Retained teams = Activations × Week-8 retention",
  },
  {
    name: "Tessellate",
    stage: "Scale-up",
    goal: "Win against Gridlabel",
    tree: "New ARR = SQLs × Win rate × ACV",
  },
  {
    name: "Brightwell",
    stage: "Consumer brand",
    goal: "Reach more households, not deeper discounts",
    tree: "Revenue = Households × Buy rate × Price",
  },
];

export const Companies: React.FC = () => {
  const frame = useCurrentFrame();
  // spotlight sweeps across the three cards
  const spot = interpolateSpot(frame);

  return (
    <Scene>
      <Headline step="06" label="Generic by design" title="One agent, any company" />
      <div style={{ position: "absolute", left: 140, right: 140, top: 340, display: "flex", gap: 40 }}>
        {CASES.map((k, i) => {
          const t = rise(frame, 16 + i * 8, 18);
          const lit = Math.max(0, 1 - Math.abs(spot - i), ramp(frame, 135, 155));
          return (
            <div
              key={k.name}
              style={{
                flex: 1,
                height: 520,
                boxSizing: "border-box",
                background: mix(lit, 0, 1) > 0.5 ? c.surface2 : c.surface,
                border: `1px solid ${c.lineStrong}`,
                borderTop: `3px solid ${lit > 0.05 ? `rgba(212,168,75,${0.25 + 0.75 * lit})` : c.lineStrong}`,
                padding: "44px 44px",
                display: "flex",
                flexDirection: "column",
                opacity: Math.min(1, t * 1.4) * (0.6 + 0.4 * lit),
                transform: `translateY(${(1 - t) * 90 - lit * 14}px) rotateY(${(1 - t) * 30}deg)`,
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
                {k.stage}
              </div>
              <div style={{ marginTop: 14, fontSize: 56, fontWeight: 600, letterSpacing: -1.5 }}>{k.name}</div>
              <div style={{ marginTop: 36, fontSize: 40, lineHeight: 1.2, color: c.ink, flex: 1 }}>{k.goal}</div>
              <div
                style={{
                  borderTop: `1px solid ${c.line}`,
                  paddingTop: 22,
                  fontFamily: font.mono,
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: lit > 0.5 ? c.gold : c.muted,
                }}
              >
                {k.tree}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 920,
          fontSize: 34,
          color: c.muted,
          opacity: ramp(frame, 120, 140),
        }}
      >
        Same four layers: goals → revenue tree → objectives → actions.
      </div>
    </Scene>
  );
};

function interpolateSpot(frame: number) {
  // 0 → 1 → 2 → rest on all
  if (frame < 40) return -1;
  if (frame < 70) return 0;
  if (frame < 80) return mix(ramp(frame, 70, 80), 0, 1);
  if (frame < 105) return 1;
  if (frame < 115) return mix(ramp(frame, 105, 115), 1, 2);
  return 2;
}
