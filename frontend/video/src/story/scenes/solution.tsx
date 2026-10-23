// Generator 3: solution scenes (currency, curve, loop).
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp, rise } from "../../anim";
import { wordAt } from "../timing";
import { Eyebrow, Glyph } from "../ui";

const W = 1920;
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
// Status colour for a cost per qualified lead.
const tone = (v: number) => (v < 2000 ? c.ok : v < 2600 ? c.warn : c.bad);
const qbez = (t: number, a: number, b: number, k: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * k + t * t * b;

const Header: React.FC<{ eyebrow: string; eyebrowAt: number; title?: string; titleAt?: number }> = ({ eyebrow, eyebrowAt, title, titleAt = 0 }) => {
  const f = useCurrentFrame();
  const p = rise(f, titleAt, 18);
  return (
    <div style={{ position: "absolute", top: 92, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <Eyebrow at={eyebrowAt}>{eyebrow}</Eyebrow>
      {title && (
        <div style={{ fontFamily: font.sans, fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em", color: c.ink, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
          {title}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────────── currency ───────────────────────────── */

// Native metrics: every channel reports in its own language.
const METRICS = [
  { kind: "conferences", name: "Conferences", val: "1,240", unit: "badge scans", x: 450, y: 420, row: 0 },
  { kind: "email", name: "Cold email", val: "312", unit: "replies", x: 960, y: 392, row: -1 },
  { kind: "google", name: "Google Ads", val: "38,200", unit: "clicks", x: 1470, y: 432, row: 1 },
  { kind: "linkedin", name: "LinkedIn", val: "860", unit: "leads", x: 650, y: 646, row: 2 },
  { kind: "seo", name: "SEO", val: "#3", unit: "ranking", x: 1130, y: 676, row: -1 },
  { kind: "billboards", name: "Billboards", val: "2.4M", unit: "impressions", x: 1560, y: 654, row: 3 },
];
// Cost per qualified sales lead (fictional demo company).
const CPSQL = [
  { kind: "conferences", name: "Conferences", v: 1714 },
  { kind: "google", name: "Google Ads", v: 1889 },
  { kind: "linkedin", name: "LinkedIn", v: 3000 },
  { kind: "billboards", name: "Billboards", v: 6500 },
];
const PILL = { x: 960, y: 262, w: 760, h: 92 };
const cpsqlTone = (v: number) => (v < 2000 ? c.ok : v < 4000 ? c.warn : c.bad);
const ROW_Y = (r: number) => 438 + r * 96;
const TRACK = { x0: 690, x1: 1450, max: 7000 };
const CHIP_W = 330;
const CHIP_H = 122;

export const Currency: React.FC = () => {
  const f = useCurrentFrame();
  const first = wordAt("currency", "first");
  const translate = wordAt("currency", "Translate");
  const every = wordAt("currency", "every");
  const one = wordAt("currency", "one");
  const close = wordAt("currency", "close");
  const cost = wordAt("currency", "cost");
  const qualified = wordAt("currency", "qualified");
  const sales = wordAt("currency", "sales");
  const lead = wordAt("currency", "lead");

  const target = ramp(f, translate, translate + 14);
  const filled = rise(f, one - 2, 14);
  const toRows = ramp(f, close + 2, close + 34, inOut);
  const unframe = ramp(f, close - 8, close + 6);
  const axis = ramp(f, close + 10, close + 40);
  const label2 = ramp(f, cost - 4, cost + 8);

  const glow = 0.35 + 0.65 * Math.max(0, ...METRICS.map((_, i) => {
    const arrive = every + i * 5 + 20;
    return 1 - clamp01(Math.abs(f - arrive) / 8);
  }));

  return (
    <AbsoluteFill>
      <Header eyebrow="First principles" eyebrowAt={first - 4} />

      {/* the one currency */}
      <div style={{ position: "absolute", left: PILL.x - PILL.w / 2, top: PILL.y - PILL.h / 2, width: PILL.w, height: PILL.h, opacity: target }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `2px dashed ${c.gold}`, opacity: 0.55 * (1 - filled) }} />
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 999, background: c.goldSoft, border: `2px solid ${c.gold}`,
            opacity: filled, transform: `scale(${mix(filled, 0.9, 1)})`,
            boxShadow: `0 0 ${40 + 50 * glow * filled}px rgba(185,167,255,${0.18 + 0.2 * glow * (1 - toRows)})`,
            display: "flex", alignItems: "center", gap: 22, padding: "0 30px",
          }}
        >
          <div style={{ width: 58, height: 58, borderRadius: 999, background: c.gold, color: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontWeight: 700, fontSize: 36, flexShrink: 0 }}>$</div>
          <div style={{ position: "relative", flex: 1, height: 60 }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", color: c.gold, opacity: 1 - label2 }}>
              One currency
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 13, fontFamily: font.sans, fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              {[
                { t: "Cost", at: cost },
                { t: "per", at: cost + 6 },
                { t: "qualified", at: qualified },
                { t: "sales", at: sales },
                { t: "lead", at: lead },
              ].map((w) => {
                const p = rise(f, w.at - 2, 16);
                return (
                  <span key={w.t} style={{ color: c.gold, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, display: "inline-block" }}>
                    {w.t}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* shared scale */}
      <svg width={W} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[0, 2000, 4000, 6000].map((v, i) => {
          const x = mix(v / TRACK.max, TRACK.x0, TRACK.x1);
          const p = ramp(f, close + 10 + i * 4, close + 30 + i * 4);
          return (
            <g key={v} opacity={p}>
              <line x1={x} x2={x} y1={ROW_Y(0) - 44} y2={mix(p, ROW_Y(0) - 44, ROW_Y(3) + 44)} stroke={c.line} strokeWidth={1.5} strokeDasharray={v ? "4 6" : undefined} />
              <text x={x} y={ROW_Y(3) + 78} textAnchor="middle" fill={c.faint} fontFamily={font.mono} fontSize={20}>
                {v ? `$${v / 1000}k` : "$0"}
              </text>
            </g>
          );
        })}
        <line x1={TRACK.x0} x2={mix(axis, TRACK.x0, TRACK.x1)} y1={ROW_Y(3) + 44} y2={ROW_Y(3) + 44} stroke={c.lineStrong} strokeWidth={1.5} />
        <text x={TRACK.x1} y={ROW_Y(3) + 112} textAnchor="end" fill={c.faint} fontFamily={font.mono} fontSize={18} letterSpacing="0.1em" opacity={ramp(f, cost + 20, cost + 36)}>
          LOWER IS BETTER
        </text>
        {CPSQL.map((r, i) => {
          const at = cost - 6 + i * 6;
          const p = ramp(f, at, at + 28);
          const x = mix((r.v / TRACK.max) * p, TRACK.x0, TRACK.x1);
          const y = ROW_Y(i);
          return (
            <g key={r.kind} opacity={axis}>
              <line x1={TRACK.x0} x2={TRACK.x1} y1={y} y2={y} stroke={c.surface3} strokeWidth={10} strokeLinecap="round" />
              {p > 0 && (
                <>
                  <line x1={TRACK.x0} x2={x} y1={y} y2={y} stroke={cpsqlTone(r.v)} strokeWidth={10} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={11} fill={c.bg} stroke={cpsqlTone(r.v)} strokeWidth={4} />
                  <text x={x + 24} y={y + 11} fill={c.ink} fontFamily={font.mono} fontSize={30} opacity={clamp01(p * 3)}>
                    {usd(r.v * p)}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {/* the spread between best and worst */}
        {(() => {
          const p = ramp(f, lead + 4, lead + 18);
          const x = 1640;
          const y0 = ROW_Y(0), y3 = ROW_Y(3);
          return (
            <g opacity={p}>
              <path d={`M${x - 14} ${y0}H${x}V${mix(p, y0, y3)}H${x - 14}`} fill="none" stroke={c.gold} strokeWidth={2} />
              <text x={x + 18} y={(y0 + y3) / 2 + 2} fill={c.gold} fontFamily={font.sans} fontWeight={600} fontSize={40}>3.8×</text>
              <text x={x + 18} y={(y0 + y3) / 2 + 30} fill={c.muted} fontFamily={font.mono} fontSize={18}>apart</text>
            </g>
          );
        })()}
      </svg>

      {/* gold particles: each metric translated into the currency */}
      <svg width={W} height={1080} style={{ position: "absolute", inset: 0 }}>
        {METRICS.map((m, i) => {
          const start = every + i * 5;
          const t = ramp(f, start, start + 20, Easing.bezier(0.5, 0, 0.2, 1));
          if (t <= 0 || t >= 1) return null;
          const kx = (m.x + PILL.x) / 2 + (m.x < PILL.x ? -60 : 60);
          const ky = Math.min(m.y, PILL.y) - 40;
          const pt = (tt: number) => [qbez(clamp01(tt), m.x, PILL.x, kx), qbez(clamp01(tt), m.y - 18, PILL.y, ky)];
          const N = 12;
          const [hx, hy] = pt(t);
          return (
            <g key={m.kind}>
              {Array.from({ length: N }, (_, j) => {
                const [x1, y1] = pt(t - ((j + 1) / N) * 0.3);
                const [x2, y2] = pt(t - (j / N) * 0.3);
                return <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.gold} strokeWidth={6 * (1 - j / N)} strokeLinecap="round" opacity={0.9 * (1 - j / N)} />;
              })}
              <circle cx={hx} cy={hy} r={18} fill={c.gold} opacity={0.18} />
              <circle cx={hx} cy={hy} r={7} fill={c.gold} />
            </g>
          );
        })}
      </svg>

      {/* metric chips → row labels */}
      {METRICS.map((m, i) => {
        const appear = rise(f, 4 + i * 5, 16);
        const tStart = every + i * 5;
        const struck = ramp(f, tStart, tStart + 10);
        const isRow = m.row >= 0;
        const move = isRow ? toRows : 0;
        const leave = isRow ? 0 : ramp(f, close - 6, close + 12);
        const drift = Math.sin(f / 26 + i * 1.7) * 5 * (1 - move);
        const left = mix(move, m.x - CHIP_W / 2, 400 - 18);
        const top = mix(move, m.y - CHIP_H / 2 + drift, ROW_Y(Math.max(0, m.row)) - 18 - 16);
        const frame = 1 - (isRow ? unframe : 0);
        return (
          <div
            key={m.kind}
            style={{
              position: "absolute", left, top, width: CHIP_W, height: CHIP_H, boxSizing: "border-box", padding: "16px 18px",
              borderRadius: 14, background: `rgba(13,13,22,${0.92 * frame})`, border: `1px solid rgba(255,255,255,${0.16 * frame})`,
              opacity: appear * (1 - leave), transform: `translateY(${(1 - appear) * 20}px) scale(${1 - leave * 0.2})`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 36 }}>
              <Glyph kind={m.kind} size={36} color={move > 0.5 ? c.ink : c.muted} />
              <div style={{ fontFamily: font.sans, fontSize: mix(move, 26, 30), color: mix(move, 0, 1) > 0.5 ? c.ink : c.muted, whiteSpace: "nowrap" }}>{m.name}</div>
            </div>
            <div style={{ position: "relative", marginTop: 10, display: "inline-flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap", opacity: frame }}>
              <span style={{ fontFamily: font.mono, fontSize: 36, color: struck > 0.5 ? c.faint : c.ink }}>{m.val}</span>
              <span style={{ fontFamily: font.mono, fontSize: 24, color: struck > 0.5 ? c.faint : c.muted }}>{m.unit}</span>
              <div style={{ position: "absolute", left: -2, top: "55%", height: 2, width: `${struck * 104}%`, background: c.gold }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ───────────────────────────── curve ───────────────────────────── */

const PLOT = { x0: 250, x1: 1190, y0: 790, y1: 290, sMax: 100, lMax: 70 };
const CURVES = [
  { kind: "google", name: "Google Ads", A: 70, k: 50, hero: true },
  { kind: "conferences", name: "Conferences", A: 58, k: 38 },
  { kind: "linkedin", name: "LinkedIn", A: 40, k: 55 },
  { kind: "billboards", name: "Billboards", A: 24, k: 70 },
];
const leads = (cv: { A: number; k: number }, s: number) => cv.A * (1 - Math.exp(-s / cv.k));
const px = (s: number) => mix(s / PLOT.sMax, PLOT.x0, PLOT.x1);
const py = (l: number) => mix(l / PLOT.lMax, PLOT.y0, PLOT.y1);
const STEP = 10; // the "next $10k"

const Row: React.FC<{ k: string; v: string; color: string; big?: boolean }> = ({ k, v, color, big }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
    <span style={{ fontFamily: font.sans, fontSize: 22, color: c.muted }}>{k}</span>
    <span style={{ fontFamily: font.mono, fontSize: big ? 32 : 24, color }}>{v}</span>
  </div>
);

export const Curve: React.FC = () => {
  const f = useCurrentFrame();
  const ask = wordAt("curve", "ask");
  const next = wordAt("curve", "next");
  const buys = wordAt("curve", "buys");
  const every = wordAt("curve", "every");
  const gets = wordAt("curve", "gets");
  const pour = wordAt("curve", "pour");
  const hero = CURVES[0];

  const axes = ramp(f, 0, 22);
  const markerIn = rise(f, next - 2, 16);
  const travel = ramp(f, gets, pour + 12, inOut);
  const s = mix(travel, 10, 70);
  const l0 = leads(hero, s);
  const l1 = leads(hero, s + STEP);
  const gain = l1 - l0;
  const nextCost = (STEP * 1000) / gain;
  const bracket = ramp(f, buys - 2, buys + 10);

  const pathFor = (cv: { A: number; k: number }, upto: number) =>
    Array.from({ length: 101 }, (_, i) => i)
      .filter((i) => i <= upto * 100)
      .map((i, j) => `${j ? "L" : "M"}${px(i).toFixed(1)} ${py(leads(cv, i)).toFixed(1)}`)
      .join(" ");

  const ghosts = [10, 30, 50];

  return (
    <AbsoluteFill>
      <Header eyebrow="Diminishing returns" eyebrowAt={0} title="What does the next dollar buy?" titleAt={ask - 6} />
      <svg width={W} height={1080} style={{ position: "absolute", inset: 0 }}>
        {/* grid + axes */}
        <g opacity={axes}>
          {[20, 40, 60].map((v) => (
            <g key={v}>
              <line x1={PLOT.x0} x2={PLOT.x1} y1={py(v)} y2={py(v)} stroke={c.line} strokeWidth={1.5} strokeDasharray="4 6" />
              <text x={PLOT.x0 - 18} y={py(v) + 7} textAnchor="end" fill={c.faint} fontFamily={font.mono} fontSize={20}>{v}</text>
            </g>
          ))}
          {[25, 50, 75, 100].map((v) => (
            <text key={v} x={px(v)} y={PLOT.y0 + 36} textAnchor="middle" fill={c.faint} fontFamily={font.mono} fontSize={20}>${v}k</text>
          ))}
          <text x={PLOT.x0 - 18} y={PLOT.y0 + 7} textAnchor="end" fill={c.faint} fontFamily={font.mono} fontSize={20}>0</text>
          <path d={`M${PLOT.x0} ${PLOT.y1 - 20}V${PLOT.y0}H${mix(axes, PLOT.x0, PLOT.x1 + 20)}`} fill="none" stroke={c.lineStrong} strokeWidth={2} />
          <text x={PLOT.x0} y={PLOT.y1 - 36} fill={c.muted} fontFamily={font.mono} fontSize={20} letterSpacing="0.1em">QUALIFIED SALES LEADS</text>
          <text x={PLOT.x1 + 20} y={PLOT.y0 + 72} textAnchor="end" fill={c.muted} fontFamily={font.mono} fontSize={20} letterSpacing="0.1em">SPEND PER MONTH →</text>
        </g>

        {/* spend poured in so far */}
        <g opacity={markerIn}>
          <line x1={PLOT.x0} x2={px(s)} y1={PLOT.y0} y2={PLOT.y0} stroke={c.gold} strokeWidth={5} />
        </g>

        {/* channel curves */}
        {CURVES.map((cv, i) => {
          const d = ramp(f, 6 + i * 6, 52 + i * 6, Easing.bezier(0.33, 0, 0.2, 1));
          const pulse = cv.hero ? 0 : 1 - clamp01(Math.abs(f - (every + 4 + (i - 1) * 7)) / 10);
          const endL = leads(cv, 100);
          return (
            <g key={cv.kind}>
              <path d={pathFor(cv, d)} fill="none" stroke={cv.hero ? c.ink : `rgba(243,242,250,${0.28 + 0.6 * pulse})`} strokeWidth={cv.hero ? 4.5 : 2.5 + pulse * 1.5} strokeLinecap="round" strokeLinejoin="round" />
              <g opacity={ramp(f, 44 + i * 6, 60 + i * 6)}>
                <text x={PLOT.x1 + 18} y={py(endL) + 8} fill={cv.hero ? c.ink : pulse > 0.3 ? c.ink : c.muted} fontFamily={font.sans} fontSize={cv.hero ? 26 : 22} fontWeight={cv.hero ? 600 : 400}>
                  {cv.name}
                </text>
              </g>
            </g>
          );
        })}

        {/* staircase left behind: equal steps of spend, shrinking returns */}
        {ghosts.map((g) => {
          const p = clamp01((s - g - STEP - 1) / 5) * markerIn;
          if (p <= 0) return null;
          const a = leads(hero, g), b = leads(hero, g + STEP);
          return (
            <g key={g} opacity={0.55 * p}>
              <path d={`M${px(g)} ${py(a)}H${px(g + STEP)}`} stroke={c.muted} strokeWidth={2} strokeDasharray="5 6" />
              <line x1={px(g + STEP)} x2={px(g + STEP)} y1={py(a)} y2={py(b)} stroke={c.gold} strokeWidth={4} strokeLinecap="round" />
              <text x={px(g + STEP) + 12} y={(py(a) + py(b)) / 2 + 7} fill={c.gold} fontFamily={font.mono} fontSize={19}>+{(b - a).toFixed(1)}</text>
            </g>
          );
        })}

        {/* the next dollar */}
        <g opacity={markerIn}>
          <path d={`M${px(s)} ${py(l0)}H${px(s + STEP)}`} stroke={c.ink} strokeWidth={2.5} strokeDasharray="6 6" />
          <text x={(px(s) + px(s + STEP)) / 2} y={py(l0) + 34} textAnchor="middle" fill={c.muted} fontFamily={font.mono} fontSize={20}>+$10k</text>
          <line x1={px(s + STEP)} x2={px(s + STEP)} y1={py(l0)} y2={mix(bracket, py(l0), py(l1))} stroke={c.gold} strokeWidth={6} strokeLinecap="round" />
          <circle cx={px(s)} cy={py(l0)} r={10} fill={c.gold} />
          <circle cx={px(s)} cy={py(l0)} r={20} fill="none" stroke={c.gold} strokeOpacity={0.35} strokeWidth={2} />
          <text
            x={px(s + STEP) + 14} y={Math.max((py(l0) + py(l1)) / 2 + 9, py(l1) + 26)} fill={c.gold} fontFamily={font.mono} fontSize={24} opacity={bracket}
            stroke={c.bg} strokeWidth={8} paintOrder="stroke" strokeLinejoin="round"
          >
            +{gain.toFixed(1)}
          </text>
        </g>
      </svg>

      {/* readout */}
      <div
        style={{
          position: "absolute", left: 1440, top: 330, width: 400, padding: "26px 28px", boxSizing: "border-box",
          background: c.surface, border: `1px solid ${c.lineStrong}`, borderRadius: 14,
          opacity: markerIn, transform: `translateY(${(1 - markerIn) * 16}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Glyph kind="google" size={28} color={c.muted} />
          <span style={{ fontFamily: font.mono, fontSize: 18, letterSpacing: "0.12em", color: c.muted }}>GOOGLE ADS</span>
        </div>
        <Row k="Spend so far" v={`$${Math.round(s)}k / mo`} color={c.ink} />
        <div style={{ height: 1, background: c.line, margin: "16px 0 14px" }} />
        <div style={{ fontFamily: font.sans, fontSize: 22, color: c.muted }}>The next $10k buys</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
          <span style={{ fontFamily: font.sans, fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em", color: c.gold, fontVariantNumeric: "tabular-nums" }}>{gain.toFixed(1)}</span>
          <span style={{ fontFamily: font.sans, fontSize: 24, color: c.muted }}>qualified leads</span>
        </div>
        <div style={{ height: 1, background: c.line, margin: "14px 0 0" }} />
        <Row k="Cost of the next lead" v={usd(nextCost)} color={tone(nextCost)} big />
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────────── loop ───────────────────────────── */

const COLS = [
  { kind: "linkedin", name: "LinkedIn", x: 440, budget: [60, 55, 50, 45], next: [3000, 2700, 2450, 2250] },
  { kind: "conferences", name: "Conferences", x: 900, budget: [30, 35, 40, 45], next: [1714, 1850, 2000, 2150] },
];
const BASE = 690;
const PX_PER_K = 6.2;
const ARC = { x0: 440, x1: 900, y: 270, ky: 110 };
const RING = { cx: 1470, cy: 480, r: 185 };

export const Loop: React.FC = () => {
  const f = useCurrentFrame();
  const expensive = wordAt("loop", "expensive");
  const to = wordAt("loop", "to");
  const cheap = wordAt("loop", "cheap");
  const small = wordAt("loop", "Small");
  const measure = wordAt("loop", "Measure");
  const repeat = wordAt("loop", "Repeat");
  const every = wordAt("loop", "Every");
  const week = wordAt("loop", "week");

  // Three small moves: depart → arrive, then the result is measured.
  const moves = [
    { go: small, measured: measure },
    { go: repeat, measured: repeat + 24 },
    { go: week, measured: week + 22 },
  ];
  const FLY = 20;
  const departed = moves.map((m) => ramp(f, m.go, m.go + 8));
  const arrived = moves.map((m) => ramp(f, m.go + FLY - 4, m.go + FLY + 4));
  const measuredP = moves.map((m) => ramp(f, m.measured, m.measured + 12));
  const valueAt = (arr: number[], ps: number[]) => ps.reduce((v, p, i) => v + (arr[i + 1] - arr[i]) * p, arr[0]);

  const cols = rise(f, 0, 16);
  const arcDraw = ramp(f, to, cheap + 6);

  // Ring: lap 1 Move → Measure → Repeat, lap 2 for the following week.
  const lap1 = interpolate(f, [small, measure, repeat, every], [0, 1 / 3, 2 / 3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lap2 = ramp(f, week, week + 36, Easing.linear);
  const weekNo = lap2 > 0 ? 2 : 1;
  const prog = lap2 > 0 ? lap2 : lap1;
  const ringIn = rise(f, 8, 18);
  const circ = 2 * Math.PI * RING.r;
  const NODES = [
    { t: "Move", sub: "a small step", a: -90, at: small },
    { t: "Measure", sub: "cost per lead", a: 30, at: measure },
    { t: "Repeat", sub: "next step", a: 150, at: repeat },
  ];

  return (
    <AbsoluteFill>
      <Header eyebrow="The weekly loop" eyebrowAt={0} />
      <svg width={W} height={1080} style={{ position: "absolute", inset: 0 }}>
        {/* path the money takes */}
        <path
          d={`M${ARC.x0} ${ARC.y} Q${(ARC.x0 + ARC.x1) / 2} ${ARC.ky} ${ARC.x1} ${ARC.y}`}
          fill="none" stroke={c.gold} strokeOpacity={0.6} strokeWidth={2.5} strokeDasharray="8 8"
          pathLength={1000} style={{ strokeDasharray: `${arcDraw * 1000} 1000` }}
        />
        {arcDraw > 0.97 && <path d={`M${ARC.x1 - 20} ${ARC.y - 12}L${ARC.x1} ${ARC.y}L${ARC.x1 + 4} ${ARC.y - 23}`} fill="none" stroke={c.gold} strokeOpacity={0.8} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

        {/* baseline */}
        <line x1={280} x2={1060} y1={BASE} y2={BASE} stroke={c.lineStrong} strokeWidth={2} opacity={cols} />

        {/* ring */}
        <g opacity={ringIn}>
          <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={c.surface3} strokeWidth={6} />
          <circle
            cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={c.gold} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${prog * circ} ${circ}`} transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
          />
          {prog > 0 && prog < 1 && (
            <circle
              cx={RING.cx + RING.r * Math.cos(((prog * 360 - 90) * Math.PI) / 180)}
              cy={RING.cy + RING.r * Math.sin(((prog * 360 - 90) * Math.PI) / 180)}
              r={11} fill={c.gold}
            />
          )}
        </g>
      </svg>

      {/* columns */}
      {COLS.map((col, ci) => {
        const sign = ci === 0 ? -1 : 1;
        const budget = col.budget[0] + moves.reduce((v, _, i) => v + sign * 5 * (ci === 0 ? departed[i] : arrived[i]), 0);
        const nextCost = valueAt(col.next, measuredP);
        const tc = tone(nextCost);
        const h = budget * PX_PER_K * cols;
        const emph = ci === 0 ? rise(f, expensive - 2, 14) : rise(f, cheap - 2, 14);
        const pulse = 1 - clamp01(Math.abs(f - (ci === 0 ? expensive + 6 : cheap + 6)) / 14);
        const bump = Math.max(...moves.map((m) => 1 - clamp01(Math.abs(f - m.measured - 6) / 10)));
        return (
          <React.Fragment key={col.kind}>
            {/* budget bar */}
            <div
              style={{
                position: "absolute", left: col.x - 95, top: BASE - h, width: 190, height: h,
                background: `linear-gradient(${tc}48, ${tc}10)`, borderTop: `3px solid ${tc}`, borderRadius: "6px 6px 0 0",
                boxShadow: `0 -10px ${40 * pulse}px ${tc}40`,
              }}
            >
              <div style={{ position: "absolute", top: 14, left: 0, right: 0, textAlign: "center", fontFamily: font.mono, fontSize: 32, color: c.ink, opacity: cols }}>
                ${budget.toFixed(0)}k
              </div>
            </div>
            {/* name + cost of the next lead */}
            <div style={{ position: "absolute", left: col.x - 180, top: BASE + 20, width: 360, display: "flex", flexDirection: "column", alignItems: "center", opacity: cols }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Glyph kind={col.kind} size={34} color={c.muted} />
                <span style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 500, color: c.ink }}>{col.name}</span>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: 16, letterSpacing: "0.14em", color: c.muted, marginTop: 14 }}>NEXT LEAD COSTS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2 }}>
                <span style={{ fontFamily: font.mono, fontSize: 42, color: tc, transform: `translateY(${-3 * bump}px) scale(${1 + 0.06 * pulse})`, display: "inline-block" }}>{usd(nextCost)}</span>
                <span
                  style={{
                    fontFamily: font.mono, fontSize: 15, letterSpacing: "0.12em", padding: "4px 10px", borderRadius: 6,
                    color: tc, border: `1px solid ${tc}`, opacity: emph * (1 - ramp(f, measure, measure + 10)),
                  }}
                >
                  {ci === 0 ? "EXPENSIVE" : "CHEAP"}
                </span>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* the gap between the two closes week by week */}
      {(() => {
        const gap = valueAt(COLS[0].next, measuredP) - valueAt(COLS[1].next, measuredP);
        const p = ramp(f, cheap + 10, cheap + 24);
        return (
          <div style={{ position: "absolute", left: 570, top: BASE - 120, width: 200, textAlign: "center", opacity: p }}>
            <div style={{ fontFamily: font.mono, fontSize: 16, letterSpacing: "0.14em", color: c.muted }}>GAP</div>
            <div style={{ fontFamily: font.mono, fontSize: 30, color: gap < 300 ? c.ink : c.muted, marginTop: 4 }}>{usd(gap)}</div>
          </div>
        );
      })()}

      {/* flying $5k chunks */}
      {moves.map((m, i) => {
        const t = ramp(f, m.go, m.go + FLY, inOut);
        if (t <= 0 || t >= 1) return null;
        const x = qbez(t, ARC.x0, ARC.x1, (ARC.x0 + ARC.x1) / 2);
        const y = qbez(t, ARC.y, ARC.y, ARC.ky);
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: x - 48, top: y - 22, width: 96, height: 44, borderRadius: 999, background: c.gold, color: c.bg,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.mono, fontSize: 24, fontWeight: 500,
              boxShadow: "0 0 30px rgba(185,167,255,0.45)",
            }}
          >
            $5k
          </div>
        );
      })}

      {/* ring labels */}
      {NODES.map((n) => {
        const rad = (n.a * Math.PI) / 180;
        const nx = RING.cx + RING.r * Math.cos(rad);
        const ny = RING.cy + RING.r * Math.sin(rad);
        const lit = ramp(f, n.at - 2, n.at + 8);
        const flash = Math.max(1 - clamp01(Math.abs(f - n.at - 4) / 12), lap2 > 0 ? 1 - clamp01(Math.abs(lap2 - ((n.a + 90) / 360 || 0.001)) / 0.08) : 0);
        const lx = nx + Math.cos(rad) * 46;
        const ly = ny + Math.sin(rad) * 46;
        const align = n.a === -90 ? "center" : n.a === 30 ? "left" : "right";
        return (
          <React.Fragment key={n.t}>
            <div
              style={{
                position: "absolute", left: nx - 16, top: ny - 16, width: 32, height: 32, borderRadius: 999, boxSizing: "border-box",
                background: lit > 0.5 ? c.gold : c.bg, border: `3px solid ${lit > 0.5 ? c.gold : c.lineStrong}`,
                boxShadow: `0 0 ${36 * flash}px rgba(185,167,255,${0.7 * flash})`, opacity: ringIn, transform: `scale(${1 + 0.25 * flash})`,
              }}
            />
            <div
              style={{
                position: "absolute", top: n.a === -90 ? ly - 82 : ly - 22, width: 260,
                left: align === "center" ? lx - 130 : align === "left" ? lx : lx - 260, textAlign: align,
                opacity: ringIn * mix(lit, 0.45, 1),
              }}
            >
              <div style={{ fontFamily: font.sans, fontSize: 34, fontWeight: 600, color: lit > 0.5 ? c.ink : c.muted }}>{n.t}</div>
              <div style={{ fontFamily: font.mono, fontSize: 18, color: c.muted, marginTop: 2 }}>{n.sub}</div>
            </div>
          </React.Fragment>
        );
      })}

      {/* ring centre: week counter */}
      <div style={{ position: "absolute", left: RING.cx - 120, top: RING.cy - 74, width: 240, textAlign: "center", opacity: ringIn }}>
        <div style={{ fontFamily: font.mono, fontSize: 20, letterSpacing: "0.14em", color: c.muted }}>WEEK</div>
        <div style={{ position: "relative", height: 100, overflow: "hidden" }}>
          {[1, 2].map((n) => {
            const p = ramp(f, week - 4, week + 8);
            const y = n === 1 ? -p * 100 : (1 - p) * 100;
            return (
              <div key={n} style={{ position: "absolute", left: 0, right: 0, top: y, fontFamily: font.sans, fontSize: 92, fontWeight: 600, letterSpacing: "-0.04em", color: n === weekNo ? c.gold : c.ink, lineHeight: "100px" }}>
                {n}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute", left: RING.cx - 140, top: RING.cy + RING.r + 74, width: 280, display: "flex", justifyContent: "center",
          opacity: rise(f, every - 2, 14), transform: `translateY(${(1 - rise(f, every - 2, 14)) * 14}px)`,
        }}
      >
        <div style={{ padding: "10px 26px", borderRadius: 999, background: c.gold, color: c.bg, fontFamily: font.sans, fontSize: 30, fontWeight: 600 }}>Every week ↻</div>
      </div>
    </AbsoluteFill>
  );
};
