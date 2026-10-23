// Generator 4 owns this file: agents, org, decide, end. Gold marks the agent; green/red only for status.
import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp, rise } from "../../anim";
import { wordAt } from "../timing";
import { Glyph } from "../ui";

const GLOW = "rgba(185,167,255,0.45)";
const TAU = Math.PI * 2;

/** Deterministic 0..1 noise. */
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Absolutely positioned box in 1920x1080 space that rises in at `at`. */
const Abs: React.FC<{ x: number; y: number; w: number; h?: number; at: number; children: React.ReactNode; style?: React.CSSProperties; lift?: number }> = ({ x, y, w, h, at, children, style, lift = 24 }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 18);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * lift}px)`, ...style }}>
      {children}
    </div>
  );
};

const mono = (size: number, color: string = c.muted, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: font.mono,
  fontSize: size,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color,
  ...extra,
});

const panel = (gold = false): React.CSSProperties => ({
  background: c.surface,
  border: `1px solid ${gold ? c.gold : c.lineStrong}`,
  borderRadius: 16,
  boxShadow: gold ? `0 0 0 1px rgba(185,167,255,0.12), 0 24px 80px -30px ${GLOW}` : "0 24px 60px -36px rgba(0,0,0,0.9)",
  boxSizing: "border-box",
});

// ─────────────────────────────────────────────────────────────── agents ──

const RING = { x: 560, y: 440, r: 205 };
const polar = (deg: number, r = RING.r) => ({ x: RING.x + r * Math.cos((deg * Math.PI) / 180), y: RING.y + r * Math.sin((deg * Math.PI) / 180) });
const arcPath = (fromDeg: number, toDeg: number, r = RING.r) => {
  const a = polar(fromDeg, r);
  const b = polar(toDeg, r);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

export const Agents: React.FC = () => {
  const f = useCurrentFrame();
  const loop = wordAt("agents", "loop");
  const cmo = wordAt("agents", "C.M.O.");
  const rep = wordAt("agents", "Repetitive");
  const data = wordAt("agents", "data");
  const never = wordAt("agents", "never");
  const perfect = wordAt("agents", "perfect");
  const agents = wordAt("agents", "agents");

  // The loop keeps turning and speeds up once the agents take over.
  const t = Math.max(0, f - loop);
  const fast = Math.max(0, f - perfect);
  const turns = t / 78 + (fast * fast) / (2 * 78 * 26);
  const dotDeg = -90 + turns * 360;
  const week = Math.floor(turns) + 1;
  const draw = ramp(f, loop - 4, loop + 26);
  const gold = ramp(f, perfect, perfect + 18);
  const ringColor = gold > 0.5 ? c.gold : c.ink;
  const nodes = [
    { deg: -90, label: "Move", dx: 0, dy: -44, align: "center" as const },
    { deg: 30, label: "Measure", dx: 26, dy: 10, align: "left" as const },
    { deg: 150, label: "Repeat", dx: -26, dy: 10, align: "right" as const },
  ];
  const rowsOut = ramp(f, perfect - 4, perfect + 10);
  const rows = [
    { n: "01", t: "Repetitive.", at: rep },
    { n: "02", t: "Data heavy.", at: data },
    { n: "03", t: "Never finished.", at: never },
  ];
  const centreOut = ramp(f, agents - 8, agents);
  const centreIn = ramp(f, agents, agents + 12);

  return (
    <AbsoluteFill>
      {/* glow behind the ring once agents take over */}
      <div style={{ position: "absolute", left: RING.x - 360, top: RING.y - 360, width: 720, height: 720, borderRadius: "50%", background: `radial-gradient(circle, rgba(185,167,255,0.16) 0%, rgba(185,167,255,0) 62%)`, opacity: gold }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={RING.x} cy={RING.y} r={RING.r} fill="none" stroke={c.lineStrong} strokeWidth={2} strokeDasharray={`${TAU * RING.r * draw} ${TAU * RING.r}`} transform={`rotate(-90 ${RING.x} ${RING.y})`} />
        <circle cx={RING.x} cy={RING.y} r={RING.r + 26} fill="none" stroke={c.line} strokeWidth={1} opacity={draw} strokeDasharray="2 10" />
        {draw > 0.6 && <path d={arcPath(dotDeg - 80, dotDeg)} fill="none" stroke={ringColor} strokeWidth={3} strokeLinecap="round" opacity={0.85} />}
        {nodes.map((n) => {
          const p = polar(n.deg);
          const passed = ((((dotDeg - n.deg) % 360) + 360) % 360) < 50 && t > 0;
          return <circle key={n.label} cx={p.x} cy={p.y} r={9} fill={passed ? ringColor : c.bg} stroke={passed ? ringColor : c.ink} strokeWidth={2} opacity={rise(f, loop + 10, 18)} />;
        })}
        {draw > 0.6 && (() => {
          const d = polar(dotDeg);
          return <circle cx={d.x} cy={d.y} r={11} fill={ringColor} style={{ filter: `drop-shadow(0 0 10px ${gold > 0.5 ? GLOW : "rgba(243,242,250,0.5)"})` }} />;
        })()}
      </svg>
      {nodes.map((n) => {
        const p = polar(n.deg);
        const o = rise(f, loop + 14, 18);
        const w = 200;
        const left = n.align === "center" ? p.x - w / 2 : n.align === "left" ? p.x + n.dx : p.x + n.dx - w;
        return (
          <div key={n.label} style={{ position: "absolute", left, top: p.y + n.dy - 16, width: w, textAlign: n.align, ...mono(24, c.muted), opacity: o }}>
            {n.label}
          </div>
        );
      })}
      {/* centre: the job, then the agent */}
      <div style={{ position: "absolute", left: RING.x - 150, top: RING.y - 80, width: 300, textAlign: "center" }}>
        <div style={{ opacity: rise(f, cmo, 18) * (1 - centreOut), transform: `translateY(${(1 - rise(f, cmo, 18)) * 16 - centreOut * 18}px)`, filter: `blur(${centreOut * 8}px)` }}>
          <div style={mono(20, c.faint)}>The job of a</div>
          <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 92, letterSpacing: "-0.03em", color: c.ink, lineHeight: 1.05 }}>CMO</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: centreIn, transform: `translateY(${(1 - centreIn) * 18}px)`, filter: `blur(${(1 - centreIn) * 8}px)` }}>
          <div style={mono(20, c.gold)}>Run by</div>
          <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 80, letterSpacing: "-0.03em", color: c.gold, lineHeight: 1.15 }}>agents</div>
        </div>
        <div style={{ ...mono(20, c.muted), marginTop: 6, opacity: rise(f, cmo + 8, 18) }}>
          Week <span style={{ color: c.ink }}>{String(week).padStart(2, "0")}</span>
        </div>
      </div>

      {/* right column: what the job is like */}
      <div style={{ position: "absolute", left: 980, top: 200, width: 780, opacity: 1 - rowsOut, transform: `translateY(${-rowsOut * 30}px)` }}>
        {rows.map((r, i) => {
          const p = rise(f, r.at, 18);
          const local = f - r.at;
          return (
            <div key={r.n} style={{ height: 160, opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 26}px)`, borderTop: `1px solid ${c.line}`, paddingTop: 22, boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
                <span style={mono(20, c.faint)}>{r.n}</span>
                <span style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 58, letterSpacing: "-0.025em", color: c.ink }}>{r.t}</span>
              </div>
              <div style={{ marginLeft: 50, marginTop: 14, height: 40 }}>
                {i === 0 && (
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    {Array.from({ length: 52 }).map((_, k) => (
                      <div key={k} style={{ width: 9, height: 22, borderRadius: 2, background: k < local * 1.6 ? c.ink : c.surface3, opacity: k < local * 1.6 ? 0.85 : 1 }} />
                    ))}
                    <span style={{ ...mono(18, c.faint), marginLeft: 12, whiteSpace: "nowrap" }}>52 / yr</span>
                  </div>
                )}
                {i === 1 && (
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
                    {Array.from({ length: 64 }).map((_, k) => {
                      const h = 6 + 34 * noise(k * 7 + Math.floor(f / 3));
                      return <div key={k} style={{ width: 6, height: k < local * 3 ? h : 2, background: c.muted, opacity: 0.75 }} />;
                    })}
                  </div>
                )}
                {i === 2 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 460, height: 6, borderRadius: 3, background: c.surface3, overflow: "hidden" }}>
                      <div style={{ width: `${((Math.max(0, local) % 28) / 28) * 100}%`, height: 6, background: c.ink }} />
                    </div>
                    <span style={mono(18, c.faint)}>↻ again</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* the payoff line replaces the column */}
      <div style={{ position: "absolute", left: 980, top: 300, width: 800 }}>
        <Line at={perfect + 2} size={108}>A perfect job</Line>
        <Line at={perfect + 8} size={108}>
          for <span style={{ color: c.gold }}>agents.</span>
        </Line>
        <div style={{ height: 6, width: 420 * ramp(f, agents + 4, agents + 22), background: c.gold, marginTop: 22, marginLeft: 168, borderRadius: 3 }} />
      </div>
    </AbsoluteFill>
  );
};

const Line: React.FC<{ at: number; size: number; children: React.ReactNode; color?: string }> = ({ at, size, children, color = c.ink }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 18);
  return (
    <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 36}px)`, filter: `blur(${(1 - Math.min(1, p * 1.2)) * 8}px)` }}>
      {children}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────── org ──

const CH = [
  { kind: "conferences", name: "Conferences", native: "Badge scans", cpl: "$1,714" },
  { kind: "google", name: "Google Ads", native: "Clicks", cpl: "$1,889" },
  { kind: "linkedin", name: "LinkedIn", native: "Leads", cpl: "$3,000" },
  { kind: "email", name: "Cold email", native: "Replies", cpl: "$2,350" },
  { kind: "billboards", name: "Billboards", native: "Impressions", cpl: "$6,500" },
];
const ORG = {
  chW: 316,
  chH: 128,
  chY: 640,
  gap: 30,
  busY: 572,
  cmo: { x: 680, y: 352, w: 560, h: 150 },
  ceo: { x: 750, y: 112, w: 420, h: 108 },
  goal: { x: 330, y: 122, w: 340, h: 88 },
  limit: { x: 1250, y: 92, w: 410, h: 150 },
};
const chX = (i: number) => (1920 - (CH.length * ORG.chW + (CH.length - 1) * ORG.gap)) / 2 + i * (ORG.chW + ORG.gap);
const chCX = (i: number) => chX(i) + ORG.chW / 2;

/** Point along a polyline at fraction t (by length). */
const along = (pts: { x: number; y: number }[], t: number) => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = Math.max(0, Math.min(1, t)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? d / seg[i] : 0;
      return { x: mix(k, pts[i].x, pts[i + 1].x), y: mix(k, pts[i].y, pts[i + 1].y) };
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
};

/** Hairline that draws itself from (x1,y1) to (x2,y2) between frames a and b. */
const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; a: number; b: number; color?: string; width?: number; dash?: string }> = ({ x1, y1, x2, y2, a, b, color = c.lineStrong, width = 2, dash }) => {
  const f = useCurrentFrame();
  const p = ramp(f, a, b);
  if (p <= 0) return null;
  return <line x1={x1} y1={y1} x2={mix(p, x1, x2)} y2={mix(p, y1, y2)} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />;
};

export const Org: React.FC = () => {
  const f = useCurrentFrame();
  const one = wordAt("org", "One");
  const speaks = wordAt("org", "speaks");
  const language = wordAt("org", "language");
  const cmo = wordAt("org", "C.M.O.");
  const money = wordAt("org", "money");
  const ceo = wordAt("org", "C.E.O.");
  const goal = wordAt("org", "goal");
  const how = wordAt("org", "how");
  const own = wordAt("org", "own");

  // Camera: the chart grows upward, so the view eases down as each level arrives.
  const cam = -190 + 100 * ramp(f, cmo - 8, cmo + 22) + 90 * ramp(f, ceo - 8, ceo + 22);

  const { cmo: M, ceo: E, goal: G, limit: L } = ORG;
  const cmoBottom = M.y + M.h;

  // Autonomy limit: slider springs to 10% and lands on "own".
  const limP = ramp(f, how, own, Easing.inOut(Easing.cubic));
  const limit = 10 * limP;
  const landed = ramp(f, own - 2, own + 8);
  const ping = ramp(f, own, own + 22);

  // Budget split inside the CMO card shifts on "money".
  const split0 = [22, 20, 28, 12, 18];
  const split1 = [31, 24, 15, 13, 17];
  const sp = ramp(f, money - 4, money + 22);
  const split = split0.map((v, i) => mix(sp, v, split1[i]));

  const pulses: React.ReactNode[] = [];
  const upStart = cmo + 24;
  if (f > upStart) {
    CH.forEach((_, i) => {
      const path = [
        { x: chCX(i), y: ORG.chY },
        { x: chCX(i), y: ORG.busY },
        { x: 960, y: ORG.busY },
        { x: 960, y: cmoBottom },
      ];
      const period = 54;
      const local = f - upStart - [0, 22, 8, 30, 14][i];
      if (local < 0) return;
      const ph = local % period;
      const dur = 34;
      if (ph > dur) return;
      const p = along(path, ph / dur);
      const o = Math.min(1, ph / 5, (dur - ph) / 5);
      pulses.push(<circle key={`u${i}`} cx={p.x} cy={p.y} r={6} fill={c.gold} opacity={o} style={{ filter: `drop-shadow(0 0 8px ${GLOW})` }} />);
    });
  }
  // The CEO's goal and limit travel down to the CMO agent.
  [goal + 2, own + 4].forEach((at, k) => {
    const ph = f - at;
    if (ph < 0 || ph > 24) return;
    const p = along([{ x: 960, y: E.y + E.h }, { x: 960, y: M.y }], ph / 24);
    pulses.push(<circle key={`d${k}`} cx={p.x} cy={p.y} r={7} fill={c.ink} opacity={Math.min(1, ph / 4, (24 - ph) / 4)} style={{ filter: "drop-shadow(0 0 8px rgba(243,242,250,0.6))" }} />);
  });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${cam}px)` }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* channel stubs → bus → CMO */}
          {CH.map((_, i) => (
            <Wire key={i} x1={chCX(i)} y1={ORG.chY} x2={chCX(i)} y2={ORG.busY} a={cmo - 2 + i * 2} b={cmo + 10 + i * 2} />
          ))}
          <Wire x1={chCX(0)} y1={ORG.busY} x2={chCX(CH.length - 1)} y2={ORG.busY} a={cmo + 4} b={cmo + 22} />
          <Wire x1={960} y1={ORG.busY} x2={960} y2={cmoBottom} a={cmo + 12} b={cmo + 22} />
          {/* CEO → CMO, gold once the limit is set */}
          <Wire x1={960} y1={E.y + E.h} x2={960} y2={M.y} a={ceo + 6} b={ceo + 20} color={landed > 0.5 ? c.gold : c.lineStrong} />
          <Wire x1={G.x + G.w} y1={G.y + G.h / 2} x2={E.x} y2={E.y + E.h / 2} a={goal} b={goal + 12} dash="3 7" />
          <Wire x1={E.x + E.w} y1={E.y + E.h / 2} x2={L.x} y2={E.y + E.h / 2} a={how - 2} b={how + 10} dash="3 7" />
          {pulses}
        </svg>

        {/* channel agents */}
        {CH.map((ch, i) => {
          const at = one + i * 6;
          const tr = ramp(f, cmo + 12 + i * 4, cmo + 22 + i * 4);
          const chip = rise(f, speaks + i * 4, 18);
          const hot = ramp(f, language - 2, language + 6) * (1 - ramp(f, language + 14, language + 30));
          return (
            <Abs key={ch.kind} x={chX(i)} y={ORG.chY} w={ORG.chW} h={ORG.chH} at={at} style={{ ...panel(), padding: "20px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Glyph kind={ch.kind} size={40} color={c.ink} />
                <div>
                  <div style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 600, color: c.ink, lineHeight: 1.1 }}>{ch.name}</div>
                  <div style={mono(15, c.faint)}>Channel agent</div>
                </div>
              </div>
              <div style={{ position: "relative", height: 30, opacity: chip }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 8, opacity: 1 - tr, transform: `translateY(${-tr * 10}px)` }}>
                  <span style={{ ...mono(17, mix(hot, 0, 1) > 0.5 ? c.ink : c.muted), padding: "4px 10px", border: `1px solid ${hot > 0.5 ? c.lineStrong : c.line}`, borderRadius: 6 }}>{ch.native}</span>
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 8, opacity: tr, transform: `translateY(${(1 - tr) * 10}px)` }}>
                  <span style={{ fontFamily: font.mono, fontSize: 22, color: c.ink }}>{ch.cpl}</span>
                  <span style={{ fontFamily: font.sans, fontSize: 19, color: c.muted, whiteSpace: "nowrap" }}>per qualified lead</span>
                </div>
              </div>
            </Abs>
          );
        })}

        {/* CMO agent */}
        <Abs x={M.x} y={M.y} w={M.w} h={M.h} at={cmo} style={{ ...panel(true), padding: "22px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AgentMark size={34} />
              <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.gold, letterSpacing: "-0.02em" }}>CMO agent</div>
            </div>
            <div style={{ ...mono(15, c.gold), padding: "5px 10px", border: `1px solid rgba(185,167,255,0.5)`, borderRadius: 6, opacity: landed }}>Limit 10%</div>
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 24, color: c.muted, marginTop: 4, opacity: rise(f, wordAt("org", "decides"), 18) }}>decides where the money goes</div>
          <div style={{ display: "flex", gap: 4, marginTop: 16, opacity: rise(f, wordAt("org", "decides") + 4, 18) }}>
            {split.map((v, i) => (
              <div key={i} style={{ flex: `${v} 0 0`, height: 12, borderRadius: 3, background: c.ink, opacity: [0.9, 0.7, 0.5, 0.35, 0.22][i] }} />
            ))}
          </div>
        </Abs>

        {/* CEO */}
        <Abs x={E.x} y={E.y} w={E.w} h={E.h} at={ceo} style={{ ...panel(), padding: "20px 28px", display: "flex", alignItems: "center", gap: 18, border: `1px solid ${c.ink}` }}>
          <svg width={44} height={44} viewBox="0 0 64 64">
            <circle cx="32" cy="22" r="11" fill="none" stroke={c.ink} strokeWidth={2.6} />
            <path d="M12 56c3-14 37-14 40 0" fill="none" stroke={c.ink} strokeWidth={2.6} strokeLinecap="round" />
          </svg>
          <div>
            <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, lineHeight: 1.05 }}>CEO</div>
            <div style={mono(15, c.faint)}>Sets goal and limit</div>
          </div>
        </Abs>

        {/* goal */}
        <Abs x={G.x} y={G.y} w={G.w} h={G.h} at={goal} style={{ ...panel(), padding: "16px 22px" }}>
          <div style={mono(15, c.faint)}>Goal</div>
          <div style={{ fontFamily: font.sans, fontSize: 28, fontWeight: 600, color: c.ink, marginTop: 4 }}>More qualified leads</div>
        </Abs>

        {/* autonomy limit */}
        <Abs x={L.x} y={L.y} w={L.w} h={L.h} at={how - 4} style={{ ...panel(landed > 0.5), padding: "18px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={mono(15, c.muted)}>May move on its own</div>
            <div style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: landed > 0.5 ? c.gold : c.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(limit)}%
            </div>
          </div>
          <div style={{ position: "relative", height: 14, marginTop: 14 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 5, height: 4, borderRadius: 2, background: c.surface3 }} />
            <div style={{ position: "absolute", left: 0, top: 5, height: 4, borderRadius: 2, width: `${(limit / 20) * 100}%`, background: c.gold }} />
            <div style={{ position: "absolute", left: `${(limit / 20) * 100}%`, top: -4, width: 22, height: 22, marginLeft: -11, borderRadius: 11, background: c.gold, boxShadow: `0 0 0 ${ping * 18}px rgba(185,167,255,${0.35 * (1 - ping)})` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            {[0, 5, 10, 15, 20].map((v) => (
              <span key={v} style={mono(14, v === 10 && landed > 0.5 ? c.gold : c.faint, { letterSpacing: 0 })}>{v}%</span>
            ))}
          </div>
        </Abs>
      </div>
    </AbsoluteFill>
  );
};

/** The agent mark: the loop with its travelling node (same motif as the agents-scene ring). */
const AgentMark: React.FC<{ size: number; draw?: number; spin?: number }> = ({ size, draw = 1, spin = 0 }) => {
  const r = 24;
  const head = (-90 + 300 * draw + spin) * (Math.PI / 180);
  const trail = TAU * r * 0.3 * Math.min(1, draw * 1.6);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(185,167,255,0.3)" strokeWidth={2} strokeDasharray={`${TAU * r * draw} 999`} transform="rotate(-90 32 32)" />
      <circle cx={32} cy={32} r={r} fill="none" stroke={c.gold} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${trail} 999`} transform={`rotate(${(head * 180) / Math.PI - 0.3 * 360 * Math.min(1, draw * 1.6)} 32 32)`} />
      <circle cx={32 + r * Math.cos(head)} cy={32 + r * Math.sin(head)} r={6} fill={c.gold} opacity={draw > 0.05 ? 1 : 0} />
      <circle cx={32} cy={32} r={5} fill={c.gold} opacity={draw} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────── decide ──

export const Decide: React.FC = () => {
  const f = useCurrentFrame();
  const small = wordAt("decide", "Small");
  const moves = wordAt("decide", "moves");
  const itself = wordAt("decide", "itself");
  const big = wordAt("decide", "Big");
  const you = wordAt("decide", "you");
  const evidence = wordAt("decide", "evidence");
  const one = wordAt("decide", "One");
  const click = wordAt("decide", "click");

  const applying = ramp(f, moves, itself - 2);
  const applied = ramp(f, itself - 2, itself + 6);
  const ev = ramp(f, evidence - 2, evidence + 20);
  const cursorIn = ramp(f, one - 16, click - 3);
  const pressed = ramp(f, click, click + 4) * (1 - ramp(f, click + 4, click + 9));
  const approved = ramp(f, click + 3, click + 9);
  const result = rise(f, click + 5, 16);

  const L = { x: 120, y: 200, w: 760 };
  const R = { x: 1000, y: 200, w: 800 };

  return (
    <AbsoluteFill>
      {/* the limit splits the room in two */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={940} y1={150} x2={940} y2={150 + 700 * ramp(f, small - 6, small + 24)} stroke="rgba(185,167,255,0.45)" strokeWidth={2} strokeDasharray="4 10" />
      </svg>
      <Abs x={940 - 200} y={96} w={400} at={small - 6} lift={10} style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ ...mono(16, c.gold), whiteSpace: "nowrap", padding: "7px 14px", border: `1px solid ${c.gold}`, borderRadius: 999, background: c.bg }}>Limit · 10% of what's left · $6.2k</div>
      </Abs>
      <Abs x={L.x} y={130} w={L.w} at={small} lift={10}>
        <div style={mono(18, c.muted)}>Under the limit · on its own</div>
      </Abs>
      <Abs x={R.x} y={130} w={R.w} at={big} lift={10}>
        <div style={{ ...mono(18, c.muted), textAlign: "right" }}>Over the limit · comes to you</div>
      </Abs>

      {/* lane 1: small move, applied and logged */}
      <Abs x={L.x} y={L.y} w={L.w} at={small} style={{ ...panel(), padding: "30px 34px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={mono(17, c.faint)}>Small move · 6% of what's left</div>
          <div style={{ position: "relative", height: 28, width: 260 }}>
            <div style={{ position: "absolute", right: 0, ...mono(17, c.muted), opacity: (applying > 0 ? 1 : 0) * (1 - applied) }}>Applying…</div>
            <div style={{ position: "absolute", right: 0, ...mono(17, c.ok), opacity: applied, transform: `scale(${mix(applied, 0.9, 1)})` }}>✓ Applied</div>
          </div>
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 42, fontWeight: 600, color: c.ink, marginTop: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Move $4k from Billboards to Google Ads
        </div>
        <div style={{ height: 4, borderRadius: 2, background: c.surface3, marginTop: 26, overflow: "hidden" }}>
          <div style={{ height: 4, width: `${applying * 100}%`, background: applied > 0.5 ? c.ok : c.ink }} />
        </div>
      </Abs>
      <Abs x={L.x} y={L.y + 290} w={L.w} at={itself + 4} style={{ padding: "0 4px" }}>
        <div style={mono(16, c.faint)}>Decision log</div>
        {[
          { t: "Last week", m: "Moved $3k Cold email → Conferences", tag: "auto", at: itself + 6, tone: c.ok },
          { t: "Mon 09:12", m: "Moved $4k Billboards → Google Ads", tag: "auto", at: itself + 10, tone: c.ok },
          { t: "Mon 09:40", m: "Moved $14k LinkedIn → Conferences", tag: "approved", at: click + 14, tone: c.gold },
        ].map((e) => {
            const p = rise(f, e.at, 18);
            return (
              <div key={e.m} style={{ display: "flex", gap: 22, alignItems: "baseline", borderTop: `1px solid ${c.line}`, padding: "14px 0", marginTop: 10, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
                <span style={{ ...mono(15, c.faint, { letterSpacing: "0.04em" }), width: 120 }}>{e.t}</span>
                <span style={{ fontFamily: font.sans, fontSize: 24, color: c.ink, flex: 1 }}>{e.m}</span>
                <span style={mono(14, e.tone)}>{e.tag}</span>
              </div>
            );
          })}
      </Abs>

      {/* lane 2: big move as a memo with evidence */}
      <Abs x={R.x} y={R.y} w={R.w} at={big} style={{ ...panel(true), padding: "30px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={mono(17, c.gold)}>Memo · needs your OK</div>
          <div style={{ ...mono(15, c.muted), opacity: rise(f, you, 18) }}>To: CEO</div>
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 42, fontWeight: 600, color: c.ink, marginTop: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Move $14k from LinkedIn to Conferences
        </div>
        <div style={{ ...mono(17, c.faint), marginTop: 10 }}>Big move · 23% of what's left</div>

        <div style={{ maxHeight: mix(ramp(f, evidence - 6, evidence + 12), 0, 400), overflow: f < evidence + 12 ? "hidden" : "visible" }}>
        <div style={{ marginTop: 26, paddingTop: 20, borderTop: `1px solid ${c.line}`, opacity: rise(f, evidence - 4, 18) }}>
          <div style={mono(15, c.muted)}>Evidence · cost per qualified lead, next dollar</div>
          {[
            { n: "LinkedIn", v: 3000, tone: c.bad },
            { n: "Conferences", v: 1714, tone: c.ok },
          ].map((b, i) => (
            <div key={b.n} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
              <span style={{ fontFamily: font.sans, fontSize: 24, color: c.ink, width: 150 }}>{b.n}</span>
              <div style={{ flex: 1, height: 14, background: c.surface3, borderRadius: 3 }}>
                <div style={{ height: 14, borderRadius: 3, width: `${(b.v / 3200) * 100 * ramp(f, evidence + i * 4, evidence + 22 + i * 4)}%`, background: b.tone, opacity: 0.85 }} />
              </div>
              <span style={{ fontFamily: font.mono, fontSize: 22, color: c.ink, width: 80, textAlign: "right" }}>${Math.round(b.v * ev).toLocaleString("en-US")}</span>
            </div>
          ))}
          <div style={{ ...mono(13, c.faint, { letterSpacing: "0.08em" }), marginTop: 12 }}>Query + data in Snowflake</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 26, opacity: rise(f, evidence + 10, 18) }}>
          <div style={{ position: "relative" }}>
            <div style={{ padding: "14px 34px", borderRadius: 10, background: approved > 0.5 ? c.ok : c.gold, color: c.bg, fontFamily: font.sans, fontSize: 28, fontWeight: 600, transform: `scale(${1 - pressed * 0.07})`, boxShadow: approved > 0.5 ? "none" : `0 10px 40px -10px ${GLOW}` }}>
              {approved > 0.5 ? "Approved ✓" : "Approve"}
            </div>
            {/* cursor */}
            <svg width="40" height="50" viewBox="0 0 22 27" style={{ position: "absolute", left: mix(cursorIn, 360, 92), top: mix(cursorIn, 220, 30), opacity: cursorIn > 0 ? 1 - ramp(f, click + 18, click + 26) : 0, transform: `scale(${1 - pressed * 0.12})` }}>
              <path d="M2 2l17 11-8 2 5 9-3 2-5-9-6 5z" fill={c.ink} stroke={c.bg} strokeWidth="1.5" />
            </svg>
            {/* click ripple */}
            <div style={{ position: "absolute", left: 100 - 40, top: 34 - 40, width: 80, height: 80, borderRadius: 40, border: `2px solid ${c.ink}`, opacity: f >= click ? 0.6 * (1 - ramp(f, click, click + 14)) : 0, transform: `scale(${mix(ramp(f, click, click + 14), 0.3, 1.4)})` }} />
          </div>
          <div style={{ padding: "14px 26px", borderRadius: 10, border: `1px solid ${c.lineStrong}`, color: c.muted, fontFamily: font.sans, fontSize: 28, fontWeight: 500, opacity: 1 - approved * 0.6 }}>Not now</div>
        </div>
        </div>
      </Abs>

      {/* result */}
      <Abs x={R.x} y={R.y + 548} w={R.w} at={click + 5} lift={14} style={{ display: "flex", alignItems: "baseline", gap: 18, paddingLeft: 4 }}>
        <span style={{ fontFamily: font.sans, fontSize: 52, fontWeight: 600, color: c.ok, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>+{Math.round(6 * result)}%</span>
        <span style={{ fontFamily: font.sans, fontSize: 30, color: c.ink }}>qualified sales leads, same budget</span>
      </Abs>
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────────────── end ──

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const name = wordAt("end", "Agentic");
  const cmo = wordAt("end", "C.M.O.");
  const ceo = wordAt("end", "C.E.O.");
  const steers = wordAt("end", "steers");
  const agent = wordAt("end", "agent");
  const runs = wordAt("end", "runs");

  const draw = ramp(f, name - 6, name + 30);
  const spin = Math.max(0, f - name - 30) * 0.6;
  const word = rise(f, name, 20);
  const cmoP = rise(f, cmo - 4, 18);
  const track = mix(word, 0.04, -0.035);
  const glow = ramp(f, name, name + 40);
  const rule = ramp(f, runs + 18, runs + 44);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 150 }}>
      <div style={{ position: "absolute", left: 960 - 700, top: 400 - 420, width: 1400, height: 840, background: "radial-gradient(ellipse at center, rgba(185,167,255,0.12) 0%, rgba(185,167,255,0) 60%)", opacity: glow }} />
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ opacity: Math.min(1, draw * 3), transform: `scale(${mix(rise(f, name - 6, 16), 0.7, 1)})` }}>
          <AgentMark size={150} draw={draw} spin={spin} />
        </div>
        <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 168, lineHeight: 1, letterSpacing: `${track}em`, color: c.ink, display: "flex", gap: "0.24em" }}>
          <span style={{ opacity: word, filter: `blur(${(1 - word) * 12}px)`, transform: `translateY(${(1 - word) * 30}px)`, display: "inline-block" }}>Agentic</span>
          <span style={{ color: c.gold, opacity: cmoP, filter: `blur(${(1 - cmoP) * 12}px)`, transform: `translateY(${(1 - cmoP) * 30}px)`, display: "inline-block" }}>CMO</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 56, fontFamily: font.sans, fontSize: 54, fontWeight: 500, letterSpacing: "-0.02em" }}>
        <Line at={ceo - 4} size={54} color={c.muted}>The CEO steers.</Line>
        <Line at={agent - 6} size={54}>The agent runs marketing.</Line>
      </div>
      <div style={{ width: 760 * rule, height: 1, background: c.lineStrong, marginTop: 56 }} />
      <div style={{ ...mono(20, c.muted, { letterSpacing: "0.22em" }), marginTop: 26, opacity: ramp(f, runs + 26, runs + 44) }}>
        Built on <span style={{ color: c.ink }}>Snowflake</span> <span style={{ color: c.faint, margin: "0 14px" }}>·</span> Reasoned by <span style={{ color: c.ink }}>Claude</span>
      </div>
    </AbsoluteFill>
  );
};
