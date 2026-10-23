import React from "react";
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./components";
import { c } from "./theme";
import { Hook } from "./scenes/Hook";
import { Goals } from "./scenes/Goals";
import { Tree } from "./scenes/Tree";
import { MapScene } from "./scenes/MapScene";
import { Autonomy } from "./scenes/Autonomy";
import { Decision } from "./scenes/Decision";
import { Companies } from "./scenes/Companies";
import { EndCard } from "./scenes/EndCard";

/*
 * Optional voice-over (silent-friendly: every line is also on screen).
 * 0s   Where should the next marketing dollar go?
 * 5s   The CEO sets the goals: ARR, payback, burn.
 * 12s  The agent breaks them into a revenue tree and spots the driver that's off pace.
 * 22s  It maps every dollar to those goals, and sees what isn't earning its keep.
 * 32s  Small moves it makes on its own, inside a limit the CEO sets.
 * 42s  Big ones come to you, with the evidence from Snowflake. One click.
 * 50s  Pre-PMF, scale-up, consumer brand: same agent.
 * 56s  Agentic CMO. Grounded in Snowflake, reasoned by Claude.
 */

const OVERLAP = 12;
// Durations include the overlap so scene starts land on 0/5/12/22/32/42/50/56 s.
export const SCENES: { C: React.FC; d: number }[] = [
  { C: Hook, d: 150 + OVERLAP },
  { C: Goals, d: 210 + OVERLAP },
  { C: Tree, d: 300 + OVERLAP },
  { C: MapScene, d: 300 + OVERLAP },
  { C: Autonomy, d: 300 + OVERLAP },
  { C: Decision, d: 240 + OVERLAP },
  { C: Companies, d: 180 + OVERLAP },
  { C: EndCard, d: 120 },
];

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        height: 4,
        width: `${(frame / (durationInFrames - 1)) * 100}%`,
        background: c.gold,
        opacity: 0.7,
      }}
    />
  );
};

export const AgenticCmo: React.FC = () => (
  <AbsoluteFill style={{ background: c.bg }}>
    <Backdrop />
    <Series>
      {SCENES.map(({ C, d }, i) => (
        <Series.Sequence key={i} durationInFrames={d} offset={i === 0 ? 0 : -OVERLAP}>
          <C />
        </Series.Sequence>
      ))}
    </Series>
    <Progress />
  </AbsoluteFill>
);
