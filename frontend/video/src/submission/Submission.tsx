// 60-second hackathon submission film: the problem from first principles, our method, then the product. Narrated (ElevenLabs).
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "../components";
import { c, font } from "../theme";
import { ramp } from "../anim";
import { LEAD, SCENES, TOTAL_FRAMES } from "./timing";
import { Caption, Chip, Stage } from "./ui";
import { Menu, Money, Question } from "./scenes/problem";
import { Currency, Loop, Trap } from "./scenes/method";
import { Agents, Guard } from "./scenes/build";
import { End, Product } from "./scenes/product";

const SCENE_COMPONENTS: Record<string, React.FC> = {
  money: Money,
  question: Question,
  menu: Menu,
  trap: Trap,
  currency: Currency,
  loop: Loop,
  agents: Agents,
  guard: Guard,
  product: Product,
  end: End,
};

const ACTS: Record<number, string> = { 1: "The problem", 2: "Our method", 3: "The product" };

const starts = SCENES.reduce<number[]>((a, s, i) => (a.push(i ? a[i - 1] + SCENES[i - 1].frames : 0), a), []);
const actStart = (act: number) => starts[SCENES.findIndex((s) => s.act === act)];

/** Brand mark + act chip, top left; hidden on the product act (it has its own app chrome) and the end card. */
const Chrome: React.FC = () => {
  const f = useCurrentFrame();
  const act = SCENES.filter((_, i) => f >= starts[i]).pop()?.act ?? 1;
  const out = 1 - ramp(f, actStart(3) - 10, actStart(3));
  const inn = ramp(f, 4, 22);
  const swap = Math.min(...[2, 3].map((a) => Math.min(1, Math.abs(f - actStart(a)) / 8)));
  return (
    <div style={{ position: "absolute", left: 72, top: 56, display: "flex", alignItems: "center", gap: 22, opacity: inn * out }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(160deg, ${c.accent}, ${c.accentStrong})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px -8px rgba(139,109,255,0.6)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke={c.accentInk} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.6" fill={c.accentInk} />
        </svg>
      </div>
      <div style={{ fontFamily: font.sans, fontSize: 26, color: c.ink, letterSpacing: "-0.01em" }}>
        Agentic CMO<sup style={{ fontSize: 13, color: c.muted, marginLeft: 3 }}>®</sup>
      </div>
      <div style={{ width: 1, height: 28, background: c.lineStrong, margin: "0 6px" }} />
      <div style={{ opacity: swap }}>
        <Chip size={18}>
          <span style={{ color: c.accent, fontFamily: font.mono, fontSize: 15 }}>0{act}</span> {ACTS[act]}
        </Chip>
      </div>
    </div>
  );
};

const Progress: React.FC = () => {
  const f = useCurrentFrame();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${(f / TOTAL_FRAMES) * 100}%`, background: c.accent, opacity: 0.6 }} />;
};

export const Submission60: React.FC = () => (
  <AbsoluteFill style={{ background: c.bg }}>
    <Backdrop />
    {SCENES.map((s, i) => {
      const Scene = SCENE_COMPONENTS[s.id];
      return (
        <Sequence key={s.id} from={starts[i]} durationInFrames={s.frames} name={s.id}>
          <Stage frames={s.frames}>
            <Scene />
            {s.id !== "end" && <Caption id={s.id} />}
          </Stage>
          <Sequence from={LEAD}>
            <Audio src={staticFile(`submission/vo-${s.id}.mp3`)} />
          </Sequence>
        </Sequence>
      );
    })}
    <Chrome />
    <Progress />
  </AbsoluteFill>
);
