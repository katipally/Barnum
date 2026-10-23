import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Mark, Scene } from "../components";
import { c, font } from "../theme";
import { ramp, rise } from "../anim";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const m = ramp(frame, 4, 40);
  const t = rise(frame, 14);
  const s = ramp(frame, 34, 52);
  const team = ramp(frame, 50, 68);
  return (
    <Scene fadeOut={0}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ transform: `scale(${0.8 + 0.2 * t})` }}>
            <Mark size={128} draw={m} />
          </div>
          <div
            style={{
              fontSize: 132,
              fontWeight: 600,
              letterSpacing: -4,
              opacity: t,
              transform: `translateX(${(1 - t) * -30}px)`,
            }}
          >
            Agentic CMO
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 40,
            color: c.muted,
            opacity: s,
            transform: `translateY(${(1 - s) * 12}px)`,
          }}
        >
          Grounded in <span style={{ color: c.ink }}>Snowflake</span> · Reasoned by{" "}
          <span style={{ color: c.gold }}>Claude</span>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 110,
            fontFamily: font.mono,
            fontSize: 24,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: c.faint,
            opacity: team,
          }}
        >
          Team [name] · Snowflake × Anthropic hackathon
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
