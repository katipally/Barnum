// Act 2 "Our method", how it is built: quick-cut shots synced to the narration (agents, guard).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp } from "../../anim";
import { wordAt } from "../timing";
import { Card, Chip, GLOW, Glyph, IconTile, Label, Num, glass, heroGlass, usd } from "../ui";

/** Quick entrance (≤6 frames): opacity + small lift. */
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; lift?: number }> = ({ at, children, style, lift = 12 }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 6);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * lift}px)`, ...style }}>{children}</div>;
};

/** Hard-cut shot: visible only in [from, to). */
const Shot: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

const Snowflake: React.FC<{ size: number; color?: string }> = ({ size, color = c.ink }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a} 32 32)`}>
          <path d="M32 32V6" {...p} />
          <path d="M32 16l-6-6M32 16l6-6M32 24l-5-4M32 24l5-4" {...p} />
        </g>
      ))}
    </svg>
  );
};

const Lock: React.FC<{ size: number; color?: string }> = ({ size, color = c.ink }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <rect x="14" y="28" width="36" height="28" rx="5" fill="none" stroke={color} strokeWidth={3} />
    <path d="M22 28v-8a10 10 0 0 1 20 0v8" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <circle cx="32" cy="41" r="3" fill={color} />
  </svg>
);

const mono = (size: number, color: string = c.muted): React.CSSProperties => ({ fontFamily: font.mono, fontSize: size, color, letterSpacing: "0.04em" });

/** The single "SQL" provenance badge shown under every number. */
const SqlBadge: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, padding: `${size * 0.3}px ${size * 0.7}px`, borderRadius: size * 0.55, border: `1px solid rgba(63,216,138,0.4)`, background: "rgba(63,216,138,0.08)", ...mono(size, c.ok) }}>
    <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: "50%", background: c.ok, boxShadow: `0 0 ${size * 0.5}px ${c.ok}` }} />
    SQL
  </span>
);

const AGENTS = [
  { kind: "conferences", name: "Conferences", table: "CONFERENCES_LEADS" },
  { kind: "google", name: "Google Ads", table: "GOOGLE_ADS_SPEND" },
  { kind: "linkedin", name: "LinkedIn", table: "LINKEDIN_LEADS" },
  { kind: "billboards", name: "Billboards", table: "BILLBOARD_FLIGHTS" },
];
const SHADES = ["#e4dcff", "#b9a7ff", "#8b6dff", "#5a43b5"];

// ──────────────────────────────────────────────────────────── agents ──

export const Agents: React.FC = () => {
  const f = useCurrentFrame();
  const snow = wordAt("agents", "Snowflake");
  const one = wordAt("agents", "one");
  const agent = wordAt("agents", "agent");
  const own = wordAt("agents", "own");
  const a = wordAt("agents", "A", 1); // nth=1: "agent" also matches the prefix "a"
  const cmo = wordAt("agents", "C.M.O.");
  const alloc = wordAt("agents", "allocates");

  return (
    <AbsoluteFill>
      {/* 1 · Snowflake */}
      <Shot from={0} to={one}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
          <Pop at={0}>
            <div style={{ filter: `drop-shadow(0 0 30px ${GLOW})` }}>
              <Snowflake size={220} color={c.accent} />
            </div>
          </Pop>
          <Pop at={snow - 4}>
            <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 120, letterSpacing: "-0.035em", color: c.ink, lineHeight: 1 }}>Snowflake</div>
          </Pop>
          <Pop at={snow + 4}>
            <Chip size={28}>Cortex Agents · Claude</Chip>
          </Pop>
        </div>
      </Shot>

      {/* 2 · one agent per channel, lighting up in parallel */}
      <Shot from={one} to={own}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Snowflake size={44} color={c.accent} />
          <Label size={28}>Snowflake</Label>
          <Chip size={22}>Cortex Agents · Claude</Chip>
        </div>
        {AGENTS.map((ag, i) => {
          const lit = ramp(f, agent + i * 3, agent + i * 3 + 6);
          return (
            <div key={ag.kind} style={{ position: "absolute", left: 135 + i * 420, top: 340, width: 390, height: 340 }}>
              <Pop at={one + i * 2}>
                <Card style={{ height: 340, padding: 34, display: "flex", flexDirection: "column", justifyContent: "space-between", border: `1px solid ${lit > 0.5 ? "rgba(185,167,255,0.5)" : c.line}`, boxShadow: `${glass.boxShadow}, 0 0 ${lit * 50}px -10px ${GLOW}` }}>
                  <IconTile size={84} tint={lit > 0.5 ? c.accentSoft : "rgba(255,255,255,0.03)"}>
                    <Glyph kind={ag.kind} size={50} color={lit > 0.5 ? c.accent : c.ink} />
                  </IconTile>
                  <div>
                    <div style={{ fontFamily: font.sans, fontSize: 40, color: c.ink, letterSpacing: "-0.02em" }}>{ag.name}</div>
                    <div style={{ fontFamily: font.sans, fontSize: 24, color: c.muted, marginTop: 4 }}>Channel agent</div>
                  </div>
                  <div style={{ ...mono(20, c.muted), padding: "8px 12px", border: `1px solid ${c.lineStrong}`, borderRadius: 10, alignSelf: "flex-start" }}>{ag.table}</div>
                </Card>
              </Pop>
            </div>
          );
        })}
      </Shot>

      {/* 3 · reads only its own data */}
      <Shot from={own} to={a}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
          <Pop at={own}>
            <IconTile size={150} tint={c.accentSoft}>
              <Lock size={90} color={c.accent} />
            </IconTile>
          </Pop>
          <Pop at={own + 2}>
            <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 104, letterSpacing: "-0.035em", color: c.ink, lineHeight: 1 }}>Own data only</div>
          </Pop>
          <Pop at={own + 5}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Glyph kind="linkedin" size={40} />
              <span style={{ fontFamily: font.sans, fontSize: 30, color: c.muted }}>LinkedIn agent</span>
              <span style={{ ...mono(24, c.faint) }}>→</span>
              <span style={{ ...mono(24, c.ink), padding: "8px 14px", border: `1px dashed rgba(185,167,255,0.6)`, borderRadius: 10 }}>LINKEDIN_LEADS</span>
            </div>
          </Pop>
        </div>
      </Shot>

      {/* 4 · CMO agent, fed by the four channel agents */}
      <Shot from={a} to={alloc}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {AGENTS.map((_, i) => {
            const y0 = 290 + i * 150 + 45;
            const y1 = 450 + i * 40;
            const d = `M 610 ${y0} C 800 ${y0}, 840 ${y1}, 1020 ${y1}`;
            const p = ramp(f, cmo - 2 + i, cmo + 6 + i);
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={c.accent} strokeWidth={8} opacity={0.35 * p} style={{ filter: "blur(6px)" }} />
                <path d={d} fill="none" stroke={c.accent} strokeWidth={2.5} pathLength={1} strokeDasharray={`${p} 1`} />
              </g>
            );
          })}
        </svg>
        {AGENTS.map((ag, i) => (
          <div key={ag.kind} style={{ position: "absolute", left: 300, top: 290 + i * 150, width: 310 }}>
            <Pop at={a + i}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <IconTile size={90} tint={c.accentSoft}>
                  <Glyph kind={ag.kind} size={52} color={c.accent} />
                </IconTile>
                <span style={{ fontFamily: font.sans, fontSize: 30, color: c.ink }}>{ag.name}</span>
              </div>
            </Pop>
          </div>
        ))}
        <div style={{ position: "absolute", left: 1020, top: 330, width: 640, height: 400 }}>
          <Pop at={cmo}>
            <div style={{ ...heroGlass, height: 400, padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <IconTile size={96} tint="rgba(255,255,255,0.08)">
                <Glyph kind="ai" size={58} color={c.ink} />
              </IconTile>
              <div>
                <div style={{ fontFamily: font.sans, fontWeight: 400, fontSize: 84, letterSpacing: "-0.03em", color: c.ink, lineHeight: 1 }}>CMO agent</div>
                <div style={{ fontFamily: font.sans, fontSize: 28, color: "rgba(243,242,250,0.7)", marginTop: 12 }}>Reads every channel agent</div>
              </div>
            </div>
          </Pop>
        </div>
      </Shot>

      {/* 5 · allocates the Q4 budget */}
      <Shot from={alloc} to={10_000}>
        <div style={{ position: "absolute", left: 210, top: 250, width: 1500, height: 520 }}>
          <Pop at={alloc}>
            <div style={{ ...heroGlass, height: 520, padding: 60, boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Label size={28} style={{ color: "rgba(243,242,250,0.75)" }}>CMO agent allocates</Label>
                <SqlBadge />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 30 }}>
                <Num value="62k" prefix="$" size={150} />
                <span style={{ fontFamily: font.sans, fontSize: 40, color: "rgba(243,242,250,0.75)" }}>left in Q4</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 48, height: 34 }}>
                {[38, 30, 20, 12].map((w, i) => (
                  <div key={i} style={{ flex: `${w * ramp(f, alloc + 2 + i * 3, alloc + 8 + i * 3) + 0.001} 0 0`, borderRadius: 6, background: SHADES[i], boxShadow: `0 0 24px -6px ${GLOW}` }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 48, marginTop: 26 }}>
                {AGENTS.map((ag, i) => (
                  <span key={ag.kind} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: font.sans, fontSize: 28, color: c.ink, opacity: ramp(f, alloc + 4 + i * 3, alloc + 10 + i * 3) }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: SHADES[i] }} />
                    {ag.name}
                  </span>
                ))}
              </div>
            </div>
          </Pop>
        </div>
      </Shot>
    </AbsoluteFill>
  );
};

// ───────────────────────────────────────────────────────────── guard ──

const BUDGET = 62000;
const LIMIT = 6200;
const TRACK = { x: 200, w: 1520, y: 470 };
const tx = (v: number) => TRACK.x + (v / BUDGET) * TRACK.w;

/** Autonomy slider after the reference's "Investment Period": tick track, round handle, floating value bubble. */
const Slider: React.FC<{ value: number; over: number }> = ({ value, over }) => {
  const hx = tx(value);
  const lx = tx(LIMIT);
  const col = over > 0.5 ? c.accent : c.ink;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 77 }).map((_, i) => {
          const x = TRACK.x + (i / 76) * TRACK.w;
          const h = i % 4 === 0 ? 34 : 16;
          return <line key={i} x1={x} x2={x} y1={TRACK.y - h / 2} y2={TRACK.y + h / 2} stroke={x <= hx ? (x > lx ? c.accent : c.ink) : "rgba(255,255,255,0.16)"} strokeWidth={x <= hx ? 2 : 1.5} opacity={x <= hx ? 0.8 : 1} />;
        })}
        <line x1={TRACK.x} x2={TRACK.x + TRACK.w} y1={TRACK.y} y2={TRACK.y} stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
        <line x1={TRACK.x} x2={Math.min(hx, lx)} y1={TRACK.y} y2={TRACK.y} stroke={c.ink} strokeWidth={3} />
        {hx > lx && <line x1={lx} x2={hx} y1={TRACK.y} y2={TRACK.y} stroke={c.accent} strokeWidth={4} style={{ filter: `drop-shadow(0 0 8px ${GLOW})` }} />}
        {/* the CEO's limit */}
        <line x1={lx} x2={lx} y1={TRACK.y - 60} y2={TRACK.y + 50} stroke={c.ok} strokeWidth={2} strokeDasharray="5 6" />
        <rect x={TRACK.x} y={TRACK.y - 60} width={lx - TRACK.x} height={110} fill="rgba(63,216,138,0.06)" />
      </svg>
      <div style={{ position: "absolute", left: lx + 14, top: TRACK.y + 26, fontFamily: font.sans, fontSize: 26, color: c.ok, whiteSpace: "nowrap" }}>Your limit · 10%</div>
      <div style={{ position: "absolute", left: TRACK.x, top: TRACK.y + 70, ...mono(22, c.faint) }}>$0</div>
      <div style={{ position: "absolute", right: 1920 - TRACK.x - TRACK.w, top: TRACK.y + 70, ...mono(22, c.muted) }}>$62k left in Q4</div>
      {/* handle + bubble */}
      <div style={{ position: "absolute", left: hx - 24, top: TRACK.y - 24, width: 48, height: 48, borderRadius: "50%", background: c.surface2, border: `2px solid ${col}`, boxShadow: `0 0 24px ${over > 0.5 ? GLOW : "rgba(243,242,250,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span style={{ width: 4, height: 16, borderRadius: 2, background: col }} />
        <span style={{ width: 4, height: 16, borderRadius: 2, background: col }} />
      </div>
      <div style={{ position: "absolute", left: hx - 80, width: 160, top: TRACK.y - 104, display: "flex", justifyContent: "center" }}>
        <span style={{ padding: "8px 18px", borderRadius: 12, fontFamily: font.sans, fontSize: 30, color: over > 0.5 ? c.accentInk : c.ink, background: over > 0.5 ? c.accent : c.surface3, border: `1px solid ${c.lineStrong}`, fontVariantNumeric: "tabular-nums" }}>
          {usd(Math.round(value / 100) * 100).replace(/,(\d)00$/, ".$1k").replace(".0k", "k")}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const Guard: React.FC = () => {
  const f = useCurrentFrame();
  const sql = wordAt("guard", "S.Q.L.");
  const never = wordAt("guard", "never");
  const small = wordAt("guard", "Small");
  const alone = wordAt("guard", "alone");
  const big = wordAt("guard", "Big");
  const ceo = wordAt("guard", "C.E.O.");
  const ev = wordAt("guard", "evidence");

  const value = f < big ? mix(ramp(f, small + 2, small + 14), 0, 2000) : mix(ramp(f, big + 2, big + 20), 2000, 14000);
  const over = value > LIMIT ? 1 : 0;

  return (
    <AbsoluteFill>
      {/* 1 · the number comes from SQL */}
      <Shot from={0} to={never}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <Pop at={0}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <IconTile size={64}>
                <Glyph kind="conferences" size={40} />
              </IconTile>
              <Label size={32}>Conferences · cost per qualified sales lead</Label>
            </div>
          </Pop>
          <Pop at={2}>
            <Num value="1,714" prefix="$" size={240} />
          </Pop>
          <Pop at={sql - 3}>
            <SqlBadge size={30} />
          </Pop>
          <Pop at={sql + 2}>
            <div style={mono(26, c.faint)}>SUM(spend) / COUNT(qualified_leads)</div>
          </Pop>
        </div>
      </Shot>

      {/* 2 · never the model */}
      <Shot from={never} to={small}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <Pop at={never}>
            <div style={{ position: "relative", padding: "24px 56px", borderRadius: 40, border: `1px dashed ${c.lineStrong}`, fontFamily: font.sans, fontWeight: 300, fontSize: 110, color: c.faint, letterSpacing: "-0.03em" }}>
              Model guess
              <div style={{ position: "absolute", left: 30, top: "52%", height: 5, borderRadius: 3, background: c.bad, width: `${ramp(f, never + 3, never + 10) * 92}%`, boxShadow: `0 0 12px ${c.bad}` }} />
            </div>
          </Pop>
          <Pop at={never + 6}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: font.sans, fontSize: 34, color: c.muted }}>
              Every number <SqlBadge size={28} />
            </div>
          </Pop>
        </div>
      </Shot>

      {/* 3+4 · the CEO's 10% limit splits small moves from the big ask */}
      <Shot from={small} to={ev}>
        <div style={{ position: "absolute", left: 160, top: 210, width: 1600, height: 390 }}>
          <Pop at={small}>
            <Card style={{ height: 390, padding: "40px 48px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: font.sans, fontSize: 48, color: c.ink, letterSpacing: "-0.02em" }}>Autonomy limit</div>
                <Chip size={26}>10% of what's left</Chip>
              </div>
            </Card>
          </Pop>
        </div>
        <Pop at={small}>
          <Slider value={value} over={over} />
        </Pop>
        {f < big ? (
          <div style={{ position: "absolute", left: 160, top: 650, width: 1600, height: 170 }}>
            <Pop at={small + 6}>
              <Card style={{ height: 170, padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
                  <span style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 80, color: c.ink, letterSpacing: "-0.03em" }}>Move $2k</span>
                  <span style={{ fontFamily: font.sans, fontSize: 30, color: c.muted }}>under your limit</span>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: font.sans, fontSize: 36, color: c.ok, opacity: ramp(f, alone - 6, alone) }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", background: c.ok, color: c.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, boxShadow: `0 0 20px ${c.ok}` }}>✓</span>
                  Done on its own
                </span>
              </Card>
            </Pop>
          </div>
        ) : (
          <div style={{ position: "absolute", left: 160, top: 650, width: 1600, height: 170 }}>
            <Pop at={big + 4}>
              <div style={{ ...heroGlass, height: 170, padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 58, color: c.ink, letterSpacing: "-0.025em" }}>Move $14k from LinkedIn to Conferences</span>
                <span style={{ opacity: ramp(f, ceo - 4, ceo + 2) }}>
                  <Chip size={30} active>Needs the CEO's OK →</Chip>
                </span>
              </div>
            </Pop>
          </div>
        )}
      </Shot>

      {/* 5 · with evidence */}
      <Shot from={ev} to={10_000}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 200, display: "flex", justifyContent: "center" }}>
          <Pop at={ev}>
            <Chip size={28} active>Needs the CEO's OK · Evidence</Chip>
          </Pop>
        </div>
        {[
          { kind: "linkedin", name: "LinkedIn", v: "3,000", hero: false },
          { kind: "conferences", name: "Conferences", v: "1,714", hero: true },
        ].map((e, i) => (
          <div key={e.kind} style={{ position: "absolute", left: 230 + i * 760, top: 310, width: 700, height: 460 }}>
            <Pop at={ev + i * 3}>
              <div style={{ ...(e.hero ? heroGlass : glass), height: 460, padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <IconTile size={72} tint={e.hero ? "rgba(255,255,255,0.08)" : c.accentSoft}>
                    <Glyph kind={e.kind} size={44} />
                  </IconTile>
                  <span style={{ fontFamily: font.sans, fontSize: 40, color: c.ink }}>{e.name}</span>
                </div>
                <div>
                  <Num value={e.v} prefix="$" size={150} />
                  <div style={{ fontFamily: font.sans, fontSize: 28, color: e.hero ? "rgba(243,242,250,0.75)" : c.muted, marginTop: 10 }}>per qualified sales lead</div>
                </div>
                <span style={{ alignSelf: "flex-start" }}>
                  <SqlBadge size={24} />
                </span>
              </div>
            </Pop>
          </div>
        ))}
        <div style={{ position: "absolute", left: 930, top: 510, width: 60, textAlign: "center", fontFamily: font.sans, fontSize: 32, color: c.faint, opacity: ramp(f, ev + 2, ev + 8) }}>vs</div>
      </Shot>
    </AbsoluteFill>
  );
};
