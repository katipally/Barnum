// First-principles storyline video: why marketing allocation is hard, and how Agentic CMO solves it. Narrated (ElevenLabs).
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "../components";
import { c } from "../theme";
import { LEAD, STORY, STORY_FRAMES } from "./timing";
import { Caption, Stage } from "./ui";
import { Customers, Money, Question } from "./scenes/intro";
import { Languages, LinkedIn, Menu, Trap } from "./scenes/channels";
import { Currency, Curve, Loop } from "./scenes/solution";
import { Agents, Decide, End, Org } from "./scenes/agents";

const SCENES: Record<string, React.FC> = {
  money: Money,
  customers: Customers,
  question: Question,
  menu: Menu,
  languages: Languages,
  trap: Trap,
  linkedin: LinkedIn,
  currency: Currency,
  curve: Curve,
  loop: Loop,
  agents: Agents,
  org: Org,
  decide: Decide,
  end: End,
};

const Progress: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${(f / STORY_FRAMES) * 100}%`, background: c.gold, opacity: 0.7 }} />
  );
};

export const Storyline: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: c.bg }}>
      <Backdrop />
      {STORY.map((s) => {
        const Scene = SCENES[s.id];
        const start = from;
        from += s.frames;
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.frames} name={s.id}>
            <Stage frames={s.frames}>
              <Scene />
              <Caption id={s.id} />
            </Stage>
            <Sequence from={LEAD}>
              <Audio src={staticFile(`story/vo-${s.id}.mp3`)} />
            </Sequence>
          </Sequence>
        );
      })}
      <Progress />
    </AbsoluteFill>
  );
};
