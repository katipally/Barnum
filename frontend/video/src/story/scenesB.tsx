import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { c, font } from "../theme";
import { mix, ramp, rise } from "../anim";
import { wordAt } from "./timing";
import { Big, Card, CHANNELS, Eyebrow, Glyph } from "./ui";

const center: React.CSSProperties = { alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28, paddingBottom: 120 };

// Demo company (fictional): cost per qualified lead by channel.
const CPSQL = [
  { kind: "conferences", name: "Conferences", v: 1714 },
  { kind: "google", name: "Google Ads", v: 1889 },
  { kind: "linkedin", name: "LinkedIn", v: 3000 },
  { kind: "billboards", name: "Billboards", v: 6500 },
];
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export const Currency: React.FC = () => {
  const f = useCurrentFrame();
  const one = wordAt("currency", "one");
  const cost = wordAt("currency", "cost");
  const merge = ramp(f, one, one + 22);
  const bars = ramp(f, cost, cost + 30);
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={wordAt("currency", "first")}>First principles</Eyebrow>
      <div style={{ position: "relative", width: 1500, height: 300 }}>
        {CHANNELS.slice(0, 6).map((ch, i) => {
          const x = mix(merge, (i - 2.5) * 250, 0);
          const y = mix(merge, (i % 2 ? 60 : -40), 30);
          return (
            <div key={ch.kind} style={{ position: "absolute", left: 750 - 110 + x, top: 90 + y, width: 220, textAlign: "center", opacity: 1 - merge, fontFamily: font.mono, fontSize: 28, color: c.muted }}>
              {ch.metric}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 60, display: "flex", justifyContent: "center", opacity: merge, transform: `scale(${mix(merge, 0.6, 1)})` }}>
          <div style={{ padding: "26px 44px", borderRadius: 999, background: c.goldSoft, border: `3px solid ${c.gold}`, fontFamily: font.sans, fontSize: 56, fontWeight: 600, color: c.gold }}>
            $ per qualified sales lead
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 1200, opacity: bars }}>
        {CPSQL.map((r, i) => {
          const p = ramp(f, cost + i * 5, cost + i * 5 + 24);
          return (
            <div key={r.kind} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Glyph kind={r.kind} size={40} />
              <div style={{ width: 230, fontFamily: font.sans, fontSize: 30, color: c.ink }}>{r.name}</div>
              <div style={{ flex: 1, height: 26, background: c.surface3, borderRadius: 13 }}>
                <div style={{ width: `${(r.v / 6500) * 100 * p}%`, height: 26, borderRadius: 13, background: r.v < 2000 ? c.ok : r.v < 4000 ? c.warn : c.bad }} />
              </div>
              <div style={{ width: 140, textAlign: "right", fontFamily: font.mono, fontSize: 30, color: c.ink }}>{usd(r.v * p)}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Curve: React.FC = () => {
  const f = useCurrentFrame();
  const next = wordAt("curve", "next");
  const more = wordAt("curve", "expensive");
  const W = 1100, H = 520;
  const fx = (x: number) => 1 - Math.exp(-x * 2.6); // diminishing returns
  const pts = Array.from({ length: 81 }, (_, i) => i / 80);
  const draw = ramp(f, 0, next);
  const path = pts.filter((x) => x <= draw).map((x, i) => `${i ? "L" : "M"}${60 + x * (W - 80)} ${H - 40 - fx(x) * (H - 90)}`).join(" ");
  const dot = ramp(f, more - 10, more + 40);
  const dx = mix(dot, 0.12, 0.88);
  const step = 0.08;
  const sx = (x: number) => 60 + x * (W - 80);
  const sy = (x: number) => H - 40 - fx(x) * (H - 90);
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={0}>What does the next dollar buy?</Eyebrow>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={`M60 ${H - 40}H${W - 20}M60 ${H - 40}V30`} stroke={c.lineStrong} strokeWidth="3" />
        <text x={W - 20} y={H - 6} textAnchor="end" fill={c.muted} fontFamily={font.mono} fontSize="24">spend →</text>
        <text x={70} y={40} fill={c.muted} fontFamily={font.mono} fontSize="24">qualified leads</text>
        <path d={path} fill="none" stroke={c.gold} strokeWidth="6" strokeLinecap="round" />
        {dot > 0 && (
          <g opacity={Math.min(1, dot * 4)}>
            <path d={`M${sx(dx)} ${sy(dx)}H${sx(dx + step)}V${sy(dx + step)}`} fill="none" stroke={c.ink} strokeWidth="3" strokeDasharray="8 8" />
            <circle cx={sx(dx)} cy={sy(dx)} r="12" fill={c.gold} />
            <text x={sx(dx + step) + 16} y={(sy(dx) + sy(dx + step)) / 2 + 8} fill={dx > 0.5 ? c.bad : c.ok} fontFamily={font.mono} fontSize="26">
              {dx > 0.5 ? "next $ buys little" : "next $ buys a lot"}
            </text>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};

export const Loop: React.FC = () => {
  const f = useCurrentFrame();
  const move = wordAt("loop", "Move");
  const small = wordAt("loop", "Small");
  const measure = wordAt("loop", "Measure");
  const repeat = wordAt("loop", "Repeat");
  const week = wordAt("loop", "week");
  const shiftP = ramp(f, move + 20, move + 60);
  const exp = mix(shiftP, 62, 46);
  const cheap = mix(shiftP, 22, 38);
  const steps = [
    { t: "Small steps", at: small },
    { t: "Measure", at: measure },
    { t: "Repeat", at: repeat },
  ];
  return (
    <AbsoluteFill style={center}>
      <div style={{ display: "flex", gap: 120, alignItems: "flex-end", height: 420 }}>
        {[
          { name: "Expensive next customer", v: exp, tone: c.bad },
          { name: "Cheap next customer", v: cheap, tone: c.ok },
        ].map((b) => (
          <div key={b.name} style={{ textAlign: "center", width: 360 }}>
            <div style={{ fontFamily: font.mono, fontSize: 32, color: c.ink, marginBottom: 10 }}>${Math.round(b.v)}k</div>
            <div style={{ height: b.v * 5.4, background: b.tone, borderRadius: "14px 14px 4px 4px", opacity: 0.9 }} />
            <div style={{ fontFamily: font.sans, fontSize: 28, color: c.muted, marginTop: 14 }}>{b.name}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 330, fontFamily: font.sans, fontSize: 54, fontWeight: 600, color: c.gold, opacity: ramp(f, move + 16, move + 26) * (1 - ramp(f, move + 64, move + 74)), transform: `translateX(${mix(ramp(f, move + 20, move + 60), -120, 120)}px)` }}>$ →</div>
      <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
        {steps.map((s) => (
          <div key={s.t} style={{ padding: "14px 30px", borderRadius: 999, border: `2px solid ${c.lineStrong}`, fontFamily: font.sans, fontSize: 36, fontWeight: 500, color: c.ink, opacity: rise(f, s.at, 14) }}>
            {s.t}
          </div>
        ))}
        <div style={{ padding: "14px 30px", borderRadius: 999, background: c.gold, fontFamily: font.sans, fontSize: 36, fontWeight: 600, color: c.bg, opacity: rise(f, week, 14) }}>Every week ↻</div>
      </div>
    </AbsoluteFill>
  );
};

export const Agents: React.FC = () => {
  const items = [
    { t: "Repetitive.", at: wordAt("agents", "Repetitive") },
    { t: "Data heavy.", at: wordAt("agents", "data") },
    { t: "Never finished.", at: wordAt("agents", "never") },
  ];
  const perfect = wordAt("agents", "perfect");
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={0}>The job of a CMO</Eyebrow>
      <div style={{ display: "flex", gap: 40 }}>
        {items.map((x) => (
          <Big key={x.t} at={x.at} size={78} color={c.muted}>{x.t}</Big>
        ))}
      </div>
      <Big at={perfect} size={124}>
        A perfect job for <span style={{ color: c.gold }}>agents.</span>
      </Big>
    </AbsoluteFill>
  );
};

const Box: React.FC<{ at: number; title: string; sub?: string; gold?: boolean; w?: number; glyph?: string }> = ({ at, title, sub, gold, w = 300, glyph }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 15);
  return (
    <Card style={{ width: w, padding: "22px 24px", opacity: p, transform: `translateY(${(1 - p) * 30}px)`, borderColor: gold ? c.gold : c.lineStrong, display: "flex", gap: 16, alignItems: "center" }}>
      {glyph && <Glyph kind={glyph} size={44} />}
      <div>
        <div style={{ fontFamily: font.sans, fontSize: 34, fontWeight: 600, color: gold ? c.gold : c.ink }}>{title}</div>
        {sub && <div style={{ fontFamily: font.sans, fontSize: 24, color: c.muted }}>{sub}</div>}
      </div>
    </Card>
  );
};

export const Org: React.FC = () => {
  const f = useCurrentFrame();
  const channel = wordAt("org", "One");
  const cmo = wordAt("org", "C.M.O.", 0);
  const ceo = wordAt("org", "C.E.O.");
  const own = wordAt("org", "own");
  const lim = ramp(f, own - 20, own + 10);
  const kinds = ["conferences", "google", "linkedin", "billboards"];
  const names = ["Conferences", "Google Ads", "LinkedIn", "Billboards"];
  const line = (at: number) => ({ opacity: ramp(f, at, at + 10) });
  return (
    <AbsoluteFill style={{ ...center, gap: 0 }}>
      <Box at={ceo} title="CEO" sub="sets the goal and the limit" w={460} />
      <div style={{ width: 3, height: 50, background: c.lineStrong, ...line(ceo + 6) }} />
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <Box at={cmo} title="CMO agent" sub="decides where the money goes" gold w={520} />
        <div style={{ opacity: lim, width: 360 }}>
          <div style={{ fontFamily: font.mono, fontSize: 22, color: c.muted, marginBottom: 10 }}>MAY MOVE ON ITS OWN</div>
          <div style={{ height: 14, borderRadius: 7, background: c.surface3 }}>
            <div style={{ width: `${10 * lim}%`, height: 14, borderRadius: 7, background: c.gold }} />
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.gold, marginTop: 8 }}>{Math.round(10 * lim)}% of budget</div>
        </div>
      </div>
      <div style={{ width: 3, height: 50, background: c.lineStrong, ...line(cmo + 6) }} />
      <div style={{ width: 1400, height: 3, background: c.lineStrong, ...line(channel + 4) }} />
      <div style={{ display: "flex", gap: 30, marginTop: 24 }}>
        {kinds.map((k, i) => (
          <Box key={k} at={channel + i * 5} title={names[i]} sub="channel agent" glyph={k} w={320} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Decide: React.FC = () => {
  const f = useCurrentFrame();
  const small = wordAt("decide", "Small");
  const big = wordAt("decide", "Big");
  const click = wordAt("decide", "click");
  const pressed = ramp(f, click, click + 6);
  const done = ramp(f, click + 8, click + 18);
  const cursor = ramp(f, click - 26, click - 2);
  return (
    <AbsoluteFill style={{ ...center, flexDirection: "row", gap: 60, alignItems: "center" }}>
      <Card style={{ width: 600, padding: "34px 38px", opacity: rise(f, small, 15) }}>
        <div style={{ fontFamily: font.mono, fontSize: 22, color: c.ok, letterSpacing: "0.08em" }}>✓ DONE ON ITS OWN · LOGGED</div>
        <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, marginTop: 14 }}>Moved $4k from Billboards to Google Ads</div>
        <div style={{ fontFamily: font.sans, fontSize: 28, color: c.muted, marginTop: 10 }}>Under the 10% limit</div>
      </Card>
      <div style={{ position: "relative" }}>
        <Card style={{ width: 680, padding: "34px 38px", opacity: rise(f, big, 15), borderColor: c.gold }}>
          <div style={{ fontFamily: font.mono, fontSize: 22, color: c.gold, letterSpacing: "0.08em" }}>NEEDS YOUR OK</div>
          <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, marginTop: 14 }}>Move $14k from LinkedIn to Conferences</div>
          <div style={{ fontFamily: font.sans, fontSize: 28, color: c.muted, marginTop: 10 }}>Evidence: cost per qualified lead, with the SQL behind it</div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 26 }}>
            <div style={{ padding: "14px 34px", borderRadius: 12, background: done > 0 ? c.ok : c.gold, color: c.bg, fontFamily: font.sans, fontSize: 32, fontWeight: 600, transform: `scale(${1 - pressed * 0.06 + done * 0.06})` }}>
              {done > 0.5 ? "Approved ✓" : "Approve"}
            </div>
            <div style={{ fontFamily: font.sans, fontSize: 32, fontWeight: 600, color: c.ok, opacity: done }}>+6% qualified leads, same budget</div>
          </div>
        </Card>
        <svg width="44" height="54" viewBox="0 0 22 27" style={{ position: "absolute", left: mix(cursor, 520, 130), top: mix(cursor, 380, 300), opacity: cursor > 0 ? 1 - done : 0 }}>
          <path d="M2 2l17 11-8 2 5 9-3 2-5-9-6 5z" fill={c.ink} stroke={c.bg} strokeWidth="1.5" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const name = wordAt("end", "Agentic");
  const steers = wordAt("end", "steers");
  const runs = wordAt("end", "runs");
  return (
    <AbsoluteFill style={center}>
      <Big at={name} size={150}>
        Agentic <span style={{ color: c.gold }}>CMO</span>
      </Big>
      <div style={{ display: "flex", gap: 30 }}>
        <Big at={steers - 6} size={56} color={c.muted}>The CEO steers.</Big>
        <Big at={runs - 8} size={56}>The agent runs marketing.</Big>
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 24, color: c.faint, letterSpacing: "0.12em", opacity: ramp(f, runs + 30, runs + 45) }}>
        BUILT ON SNOWFLAKE · REASONED BY CLAUDE
      </div>
    </AbsoluteFill>
  );
};
