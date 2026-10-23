// Generator 1 owns this file: money, customers, question. A gold coin carries through all three scenes.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp, rise } from "../../anim";
import { wordAt } from "../timing";

const GOLD_GLOW = "rgba(185,167,255,0.38)";

/** Word that blurs, rises and sharpens in on its spoken frame. */
const W: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dur?: number }> = ({ at, children, style, dur = 11 }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at - 3, at + dur);
  return (
    <span
      style={{
        display: "inline-block",
        opacity: p,
        filter: `blur(${(1 - p) * 16}px)`,
        transform: `translateY(${(1 - p) * 0.32}em) scale(${mix(p, 0.94, 1)})`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Hairline gold coin. `turn` is the flip angle in radians (0 = face on). */
const Coin: React.FC<{ size: number; turn?: number; glow?: number; style?: React.CSSProperties }> = ({ size, turn = 0, glow = 1, style }) => {
  const sx = Math.max(0.05, Math.abs(Math.cos(turn)));
  const id = `coin${size}`;
  return (
    <div style={{ width: size, height: size, transform: `scaleX(${sx})`, filter: `drop-shadow(0 0 ${size * 0.22}px rgba(185,167,255,${0.32 * glow}))`, ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <radialGradient id={id} cx="36%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(214,204,255,0.34)" />
            <stop offset="60%" stopColor="rgba(185,167,255,0.12)" />
            <stop offset="100%" stopColor="rgba(185,167,255,0.04)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill={`url(#${id})`} stroke={c.gold} strokeWidth="2.6" />
        <circle cx="50" cy="50" r="42.5" fill="none" stroke={c.gold} strokeWidth="2.2" strokeDasharray="0.9 2.4" opacity="0.55" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={c.gold} strokeWidth="1" opacity="0.45" />
        <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontFamily={font.sans} fontWeight={600} fontSize="44" fill={c.gold}>
          $
        </text>
      </svg>
    </div>
  );
};

/** Coin flip-in: 1.5 turns settling face-on. */
const spinIn = (f: number, at: number, dur = 22) => (1 - ramp(f, at, at + dur)) * Math.PI * 3;

const People: React.FC<{ size: number; color?: string }> = ({ size, color = c.ink }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="18" cy="24" r="5.5" {...p} opacity="0.6" />
      <circle cx="46" cy="24" r="5.5" {...p} opacity="0.6" />
      <path d="M6 48c1.5-8 6-12 12-12 3 0 5.5 1 7.5 3M58 48c-1.5-8-6-12-12-12-3 0-5.5 1-7.5 3" {...p} opacity="0.6" />
      <circle cx="32" cy="22" r="7.5" {...p} />
      <path d="M17 52c2-10 8-15 15-15s13 5 15 15" {...p} />
    </svg>
  );
};

const Megaphone: React.FC<{ size: number }> = ({ size }) => {
  const p = { fill: "none", stroke: c.ink, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d="M10 26v12h9l21 11V15L19 26z" {...p} />
      <path d="M20 38l4 13h6l-3-11" {...p} />
      <path d="M47 25c3.5 4 3.5 10 0 14M53 19c7 7 7 19 0 26" {...p} opacity="0.65" />
    </svg>
  );
};

// ─── money ────────────────────────────────────────────────────────────────

export const Money: React.FC = () => {
  const f = useCurrentFrame();
  const at = (w: string) => wordAt("money", w);
  const to = at("To");
  const money = at("money");
  const lift = ramp(f, to - 8, to + 12);
  const push = mix(ramp(f, money, money + 45), 1, 1.04);
  const line1: [string, number][] = [["Every", at("Every")], ["business", at("business")], ["exists", at("exists")], ["for", at("for")], ["one", at("one")], ["reason.", at("reason")]];
  const glow = ramp(f, money + 6, money + 30);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      {/* soft light behind the coin */}
      <div style={{ position: "absolute", left: 1600 - 380, top: 560 - 380, width: 760, height: 760, borderRadius: 999, background: `radial-gradient(circle, rgba(185,167,255,0.12) 0%, rgba(185,167,255,0) 62%)`, opacity: glow }} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: mix(lift, 440, 318), display: "flex", justifyContent: "center", gap: "0.26em",
          fontFamily: font.sans, fontWeight: 600, fontSize: 80, letterSpacing: "-0.03em", lineHeight: 1,
          color: lift > 0.5 ? c.muted : c.ink, transform: `translateY(-50%) scale(${mix(lift, 1, 0.66)})`, opacity: mix(lift, 1, 0.9),
        }}
      >
        {line1.map(([w, t]) => (
          <W key={w} at={t}>{w}</W>
        ))}
      </div>
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 540, display: "flex", justifyContent: "center", alignItems: "center", gap: "0.24em",
          fontFamily: font.sans, fontWeight: 600, fontSize: 176, letterSpacing: "-0.045em", lineHeight: 1, color: c.ink, transform: "translateY(-50%)",
        }}
      >
        <W at={to} dur={13}>To</W>
        <W at={at("make")} dur={13}>make</W>
        <W at={money} dur={13}>money</W>
        <div style={{ opacity: ramp(f, money + 2, money + 8), transform: `translateY(14px) scale(${mix(rise(f, money + 2, 14), 0.4, 1)})`, marginLeft: -4 }}>
          <Coin size={150} turn={spinIn(f, money + 2, 26)} glow={0.4 + glow * 0.6} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── customers ────────────────────────────────────────────────────────────

const GAP = 560; // distance between node centres
const R = 104; // node radius

const ChainNode: React.FC<{ x: number; at: number; label: string; sub: string; ring?: string; children: React.ReactNode }> = ({ x, at, label, sub, ring, children }) => {
  const f = useCurrentFrame();
  const p = rise(f, at - 4, 16);
  const t = ramp(f, at + 2, at + 16);
  return (
    <div style={{ position: "absolute", left: x - 240, top: -R, width: 480, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: R * 2, height: R * 2, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
          border: ring ? `1.5px solid ${ring}` : "none", background: ring ? c.surface : "transparent",
          boxShadow: ring === c.gold ? `0 0 60px ${c.goldSoft}, inset 0 0 40px ${c.goldSoft}` : "none",
          opacity: p, transform: `scale(${mix(p, 0.6, 1)})`, filter: `blur(${(1 - p) * 10}px)`,
        }}
      >
        {children}
      </div>
      <div style={{ marginTop: 34, fontFamily: font.sans, fontWeight: 600, fontSize: 60, letterSpacing: "-0.03em", color: c.ink, opacity: t, filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 18}px)` }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontFamily: font.mono, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: c.muted, opacity: ramp(f, at + 8, at + 20) }}>{sub}</div>
    </div>
  );
};

/** Arrow between two node edges, drawn from its head backwards (the chain is revealed right to left), with gold value flowing along it. */
const Link: React.FC<{ x1: number; x2: number; at: number; flowAt: number }> = ({ x1, x2, at, flowAt }) => {
  const f = useCurrentFrame();
  const w = ramp(f, at, at + 16);
  const len = x2 - x1;
  const head = ramp(f, at, at + 5);
  const flow = ramp(f, flowAt, flowAt + 10);
  return (
    <svg style={{ position: "absolute", left: x1, top: -20, overflow: "visible" }} width={len} height={40}>
      {w > 0 && <line x1={len - len * w} y1={20} x2={len - 4} y2={20} stroke={c.lineStrong} strokeWidth={2} strokeLinecap="round" />}
      <path d={`M${len - 18} 9L${len - 4} 20L${len - 18} 31`} fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={head} />
      {[0, 1, 2].map((k) => {
        const t = (((f - flowAt) / 42 + k / 3) % 1 + 1) % 1;
        return <circle key={k} cx={10 + t * (len - 34)} cy={20} r={5} fill={c.gold} opacity={flow * Math.sin(Math.PI * t)} style={{ filter: `drop-shadow(0 0 6px ${GOLD_GLOW})` }} />;
      })}
    </svg>
  );
};

export const Customers: React.FC = () => {
  const f = useCurrentFrame();
  const money = wordAt("customers", "Money");
  const cust = wordAt("customers", "customers");
  const mkt = wordAt("customers", "marketing");
  // The camera starts on the coin and pulls back as each cause is revealed to its left.
  const s1 = ramp(f, cust - 8, cust + 22);
  const s2 = ramp(f, mkt - 8, mkt + 24);
  const shift = -GAP + (GAP / 2) * (s1 + s2);
  const scale = 1.2 - 0.1 * s1 - 0.1 * s2 - 0.02 * ramp(f, mkt + 24, mkt + 80);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 960, top: 425, transform: `translateX(${shift * scale}px) scale(${scale})` }}>
        <Link x1={-GAP + R + 26} x2={-R - 26} at={mkt - 10} flowAt={mkt + 10} />
        <Link x1={R + 26} x2={GAP - R - 26} at={cust - 10} flowAt={cust + 14} />
        <ChainNode x={-GAP} at={mkt} label="Marketing" sub="finds and convinces" ring={c.gold}>
          <Megaphone size={104} />
        </ChainNode>
        <ChainNode x={0} at={cust} label="Customers" sub="choose to buy" ring={c.lineStrong}>
          <People size={124} />
        </ChainNode>
        <ChainNode x={GAP} at={money} label="Money" sub="revenue">
          <Coin size={R * 2} turn={spinIn(f, money - 4, 26)} glow={0.6 + 0.4 * Math.sin(f / 14)} />
        </ChainNode>
      </div>
    </AbsoluteFill>
  );
};

// ─── question ─────────────────────────────────────────────────────────────

const AX_Y = 480; // time axis (phase A)
const MID_Y = 440; // decision fan (phase B)
const TODAY_X = 560;
const TOMORROW_X = 1360;
const ARC = 170;

const rays = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + Math.sin(i * 7.3) * 0.12;
  const l = 250 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 170;
  return { a, l };
});

export const Question: React.FC = () => {
  const f = useCurrentFrame();
  const at = (w: string, n = 0) => wordAt("question", w, n);

  // Phase A: money spent today travels along the time axis and becomes customers tomorrow.
  const axis = ramp(f, at("Marketing") - 4, at("Marketing") + 26);
  const coinIn = at("money") - 4;
  const travel = ramp(f, at("to", 1) - 2, at("customers") + 4, (t) => t * t * (3 - 2 * t));
  const arrived = ramp(f, at("customers") + 2, at("customers") + 8);
  const cx = mix(travel, TODAY_X, TOMORROW_X);
  const cy = AX_Y - Math.sin(Math.PI * travel) * ARC;
  const outA = ramp(f, at("So") - 8, at("So") + 14);

  // Phase B: every decision fans out from the coin, then collapses into one question.
  const coinB = at("So");
  const fan = (i: number) => ramp(f, at("every") + i * 1.4, at("every") + i * 1.4 + 16);
  const fold = ramp(f, at("down") - 4, at("one") + 2, (t) => t * t);
  const pulse = ramp(f, at("one") + 2, at("one") + 28);

  // Phase C: the question.
  const up = ramp(f, at("question") + 2, at("Where") + 4);
  const flip = ramp(f, at("dollar"), at("dollar") + 20) * Math.PI * 2;
  const push = mix(ramp(f, at("go"), at("go") + 50), 1, 1.035);
  const coinY = mix(up, MID_Y, 268);
  const coinS = mix(up, 1, 0.74);

  const arcPath = Array.from({ length: 41 }, (_, i) => {
    const t = (i / 40) * travel;
    return `${i ? "L" : "M"}${mix(t, TODAY_X, TOMORROW_X).toFixed(1)} ${(AX_Y - Math.sin(Math.PI * t) * ARC).toFixed(1)}`;
  }).join(" ");

  const label: React.CSSProperties = { position: "absolute", top: AX_Y + 108, width: 400, textAlign: "center", fontFamily: font.mono, fontSize: 26, letterSpacing: "0.18em", color: c.muted };

  return (
    <AbsoluteFill>
      {/* Phase A */}
      {outA < 1 && (
        <AbsoluteFill style={{ opacity: 1 - outA, filter: `blur(${outA * 12}px)`, transform: `scale(${mix(outA, 1, 0.92)})` }}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <line x1={960 - 620 * axis} y1={AX_Y} x2={960 + 620 * axis} y2={AX_Y} stroke={c.lineStrong} strokeWidth={2} />
            {[TODAY_X, TOMORROW_X].map((x, i) => (
              <line key={x} x1={x} y1={AX_Y + 80} x2={x} y2={AX_Y + 94} stroke={c.muted} strokeWidth={2} opacity={ramp(f, i ? at("tomorrow") : at("today"), (i ? at("tomorrow") : at("today")) + 8)} />
            ))}
            {travel > 0 && <path d={arcPath} fill="none" stroke={c.gold} strokeWidth={2.5} strokeDasharray="0.5 10" strokeLinecap="round" opacity={0.85} />}
            {/* where the coin used to be: spent */}
            <circle cx={TODAY_X} cy={AX_Y} r={70} fill={c.bg} stroke={c.faint} strokeWidth={1.5} strokeDasharray="3 7" opacity={ramp(f, at("to", 1) + 2, at("to", 1) + 12)} />
          </svg>
          <div style={{ ...label, left: TODAY_X - 200, opacity: ramp(f, at("today") - 2, at("today") + 10) }}>TODAY</div>
          <div style={{ ...label, left: TOMORROW_X - 200, opacity: ramp(f, at("tomorrow") - 2, at("tomorrow") + 10) }}>TOMORROW</div>
          {/* customers won */}
          {(() => {
            const p = rise(f, at("customers") + 4, 14);
            return (
              <div
                style={{
                  position: "absolute", left: TOMORROW_X - 75, top: AX_Y - 75, width: 150, height: 150, borderRadius: 999, background: c.surface,
                  border: `1.5px solid ${c.lineStrong}`, display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: p, transform: `scale(${mix(p, 0.5, 1)})`, filter: `blur(${(1 - p) * 8}px)`,
                }}
              >
                <People size={100} />
              </div>
            );
          })()}
          {/* the coin */}
          <div style={{ position: "absolute", left: cx - 70, top: cy - 70, opacity: ramp(f, coinIn, coinIn + 6) * (1 - arrived), transform: `scale(${mix(rise(f, coinIn, 14), 0.5, 1) * mix(arrived, 1, 0.3)})` }}>
            <Coin size={140} turn={spinIn(f, coinIn, 24) + travel * Math.PI * 2} />
          </div>
        </AbsoluteFill>
      )}

      {/* Phase B + C */}
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - up }}>
          {rays.map(({ a, l }, i) => {
            const g = fan(i) * (1 - fold);
            const r0 = 96;
            const r1 = mix(g, r0, l);
            const dx = Math.cos(a + f * 0.0015) * 1.35;
            const dy = Math.sin(a + f * 0.0015);
            return (
              <g key={i} opacity={Math.min(1, fan(i) * 3) * (1 - fold * 0.6)}>
                <line x1={960 + dx * r0} y1={MID_Y + dy * r0} x2={960 + dx * r1} y2={MID_Y + dy * r1} stroke={c.lineStrong} strokeWidth={1.6} />
                <circle cx={960 + dx * r1} cy={MID_Y + dy * r1} r={mix(g, 2, 8)} fill={c.bg} stroke={c.muted} strokeWidth={1.6} opacity={g} />
              </g>
            );
          })}
          <circle cx={960} cy={MID_Y} r={mix(pulse, 80, 260)} fill="none" stroke={c.gold} strokeWidth={2} opacity={(1 - pulse) * 0.7 * (pulse > 0 ? 1 : 0)} />
        </svg>
        <div
          style={{
            position: "absolute", left: 960 - 80, top: coinY - 80,
            opacity: ramp(f, coinB, coinB + 8), transform: `scale(${coinS * mix(rise(f, coinB, 14), 0.5, 1) * (1 + 0.08 * Math.sin(Math.PI * pulse))})`,
          }}
        >
          <Coin size={160} turn={spinIn(f, coinB, 24) + flip} glow={1 + 0.8 * Math.sin(Math.PI * ramp(f, at("dollar"), at("dollar") + 20))} />
        </div>
        <div
          style={{
            position: "absolute", left: 0, right: 0, top: 412, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            fontFamily: font.sans, fontWeight: 600, fontSize: 124, letterSpacing: "-0.04em", lineHeight: 1.06, color: c.ink,
          }}
        >
          <div style={{ display: "flex", gap: "0.24em" }}>
            <W at={at("Where")}>Where</W>
            <W at={at("should")}>should</W>
            <W at={at("the")}>the</W>
          </div>
          <div style={{ display: "flex", gap: "0.24em" }}>
            <W at={at("next")} style={{ color: c.gold, textShadow: `0 0 40px ${c.goldSoft}` }}>next</W>
            <W at={at("dollar")} style={{ color: c.gold, textShadow: `0 0 40px ${c.goldSoft}` }}>dollar</W>
            <W at={at("go")}>go?</W>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
