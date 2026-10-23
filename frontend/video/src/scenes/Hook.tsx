import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Scene } from "../components";
import { c, font } from "../theme";
import { ramp } from "../anim";

const LINE = "Where should the next marketing dollar go?";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(ramp(frame, 10, 78, (t) => t) * LINE.length);
  const caretOn = typed < LINE.length || Math.floor(frame / 12) % 2 === 0;
  const sub = ramp(frame, 92, 112);
  const text = LINE.slice(0, typed);
  const dollarAt = LINE.indexOf("dollar");

  return (
    <Scene fadeIn={0} fadeOut={14}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 160px" }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 600,
            letterSpacing: -3,
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 1500,
          }}
        >
          {text.slice(0, dollarAt)}
          <span style={{ color: c.gold }}>{text.slice(dollarAt, dollarAt + 6)}</span>
          {text.slice(dollarAt + 6)}
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 92,
              marginLeft: 8,
              verticalAlign: "-12px",
              background: c.gold,
              opacity: caretOn ? 1 : 0,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 36,
            color: c.muted,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 16}px)`,
          }}
        >
          Every CEO asks it. Most marketing teams answer with a dashboard.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 90,
            fontFamily: font.mono,
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: c.faint,
            opacity: ramp(frame, 20, 40),
          }}
        >
          Agentic CMO
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
