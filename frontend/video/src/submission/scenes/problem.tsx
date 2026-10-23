// Act 1 "The problem": quick-cut shots, hard cuts on spoken words.
import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { ramp } from "../../anim";
import { wordAt } from "../timing";
import { ArrowDot, Card, Chip, Glyph, GLOW, GlowLine, heroGlass, IconTile, Label, Num, glass } from "../ui";

// ≤6-frame entrance: fade + small lift.
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 6);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px) scale(${0.97 + 0.03 * p})`, ...style }}>{children}</div>;
};

/** Hard cut: shows children only in [from, to). */
const Shot: React.FC<{ from: number; to?: number; children: React.ReactNode }> = ({ from, to = 1e9, children }) => {
  const f = useCurrentFrame();
  if (f < from || f >= to) return null;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

const Center: React.FC<{ children: React.ReactNode; gap?: number; dir?: "row" | "column" }> = ({ children, gap = 40, dir = "column" }) => (
  <AbsoluteFill style={{ top: 130, bottom: 170, display: "flex", flexDirection: dir, alignItems: "center", justifyContent: "center", gap }}>{children}</AbsoluteFill>
);

const stroke = (color: string) => ({ fill: "none", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
const Icon: React.FC<{ kind: "money" | "customers" | "marketing"; size?: number; color?: string }> = ({ kind, size = 44, color = c.ink }) => {
  const p = stroke(color);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {kind === "money" && (<><circle cx="32" cy="32" r="22" {...p} /><path d="M40 23c-2-3-5-4-8-4-5 0-8 3-8 6 0 8 16 5 16 13 0 4-4 7-8 7-4 0-7-2-9-5M32 14v6M32 44v6" {...p} /></>)}
      {kind === "customers" && (<><circle cx="24" cy="22" r="8" {...p} /><path d="M8 52c1-11 8-16 16-16s15 5 16 16" {...p} /><circle cx="44" cy="24" r="6" {...p} /><path d="M42 36c8 0 13 5 14 14" {...p} /></>)}
      {kind === "marketing" && (<><path d="M10 26v12h8l20 12V14L18 26z" {...p} /><path d="M18 38l4 14h6l-3-13M46 24c3 2 4 5 4 8s-1 6-4 8M52 18c5 4 7 9 7 14s-2 10-7 14" {...p} /></>)}
    </svg>
  );
};

/* ───────────── MONEY: chain built backwards, one link per cut ───────────── */

const LINKS = [
  { kind: "marketing" as const, label: "The source", name: "Marketing", line: [0.2, 0.3, 0.25, 0.45, 0.4, 0.62, 0.7] },
  { kind: "customers" as const, label: "Brings in", name: "Customers", line: [0.25, 0.22, 0.4, 0.35, 0.55, 0.5, 0.72] },
  { kind: "money" as const, label: "The outcome", name: "Money", line: [0.2, 0.32, 0.28, 0.5, 0.46, 0.66, 0.8] },
];

const LinkCard: React.FC<{ i: number; at: number; root?: boolean }> = ({ i, at, root }) => {
  const f = useCurrentFrame();
  const l = LINKS[i];
  const hot = root ? ramp(f, at + 6, at + 14) : 0;
  return (
    <Pop at={at}>
      <div style={{ ...(root ? heroGlass : glass), width: 440, height: 330, padding: "28px 30px", position: "relative", overflow: "hidden", boxShadow: root ? `0 0 ${80 * hot}px -10px ${GLOW}, inset 0 1px 0 rgba(255,255,255,0.08)` : glass.boxShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <IconTile size={68} tint={root ? "rgba(255,255,255,0.14)" : c.accentSoft}>
            <Icon kind={l.kind} color={root ? "#fff" : c.accent} />
          </IconTile>
          <div style={{ flex: 1, fontFamily: font.sans }}>
            <div style={{ fontSize: 20, color: root ? "rgba(255,255,255,0.7)" : c.muted }}>{l.label}</div>
            <div style={{ fontSize: 40, color: c.ink, letterSpacing: "-0.02em", fontWeight: 400 }}>{l.name}</div>
          </div>
          <ArrowDot size={46} />
        </div>
        <div style={{ position: "absolute", left: 10, bottom: 18 }}>
          <GlowLine points={l.line} w={420} h={150} draw={ramp(f, at, at + 14)} color={root ? "#fff" : c.accent} markers={[6]} baseline={0.3} />
        </div>
      </div>
    </Pop>
  );
};

const Connector: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const d = ramp(f, at, at + 6);
  const dot = ((f - at) % 24) / 24;
  return (
    <svg width={110} height={40} style={{ overflow: "visible", flexShrink: 0 }}>
      <line x1={110 - 100 * d} x2={102} y1={20} y2={20} stroke={c.accent} strokeWidth={8} opacity={0.35} style={{ filter: "blur(5px)" }} />
      <line x1={110 - 100 * d} x2={100} y1={20} y2={20} stroke={c.accent} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M92 12l10 8-10 8" fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={d} />
      {d >= 1 && <circle cx={10 + 82 * dot} cy={20} r={4} fill="#fff" />}
    </svg>
  );
};

export const Money: React.FC = () => {
  const tCust = wordAt("money", "customers");
  const tMkt = wordAt("money", "marketing");
  return (
    <AbsoluteFill>
      <Shot from={0} to={tCust}>
        <Center gap={36}>
          <Pop at={0}><Label size={26} chip="1 link">What a business runs on</Label></Pop>
          <LinkCard i={2} at={2} />
        </Center>
      </Shot>
      <Shot from={tCust} to={tMkt}>
        <Center gap={36}>
          <Label size={26} chip="2 links">Money comes from customers</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LinkCard i={1} at={tCust} />
            <Connector at={tCust + 2} />
            <LinkCard i={2} at={-99} />
          </div>
        </Center>
      </Shot>
      <Shot from={tMkt}>
        <Center gap={36}>
          <Label size={26} chip="3 links">Follow it back to the source</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LinkCard i={0} at={tMkt} root />
            <Connector at={tMkt + 2} />
            <LinkCard i={1} at={-99} />
            <Connector at={-99} />
            <LinkCard i={2} at={-99} />
          </div>
        </Center>
      </Shot>
    </AbsoluteFill>
  );
};

/* ───────────── QUESTION: decision → 1 question → where does the next dollar go ───────────── */

const SLOTS = 6;
const SW = 190, SG = 26;
const slotX = (i: number) => 960 - (SLOTS * SW + (SLOTS - 1) * SG) / 2 + i * (SW + SG) + SW / 2;

export const Question: React.FC = () => {
  const f = useCurrentFrame();
  const tOne = wordAt("question", "one");
  const tWhere = wordAt("question", "where");
  const tNext = wordAt("question", "next");
  // The $1 token hops between slots without settling.
  const hops = [2.5, 3, 1, 4, 0, 5];
  const seg = (f - tWhere - 4) / 11;
  const k = Math.max(0, Math.floor(seg));
  const a = hops[Math.min(k, hops.length - 1)];
  const b = hops[Math.min(k + 1, hops.length - 1)];
  const e = seg < 0 ? 0 : ramp(seg - k, 0, 0.55);
  const pos = a + (b - a) * e;
  const tx = slotX(0) + pos * (SW + SG);
  const ty = 400 + Math.sin(f / 6) * 6;
  const near = seg < 0 ? -1 : Math.round(pos);
  const accentT = ramp(f, tNext, tNext + 5);
  const hl = interpolateColors(accentT, [0, 1], [c.ink, c.accent]);
  return (
    <AbsoluteFill>
      <Shot from={0} to={tOne}>
        <Center gap={30}>
          <Pop at={2}><div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 64, color: c.muted, letterSpacing: "-0.02em" }}>Every</div></Pop>
          <Pop at={wordAt("question", "marketing") - 2}>
            <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <IconTile size={110}><Icon kind="marketing" size={64} color={c.accent} /></IconTile>
              <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 120, letterSpacing: "-0.035em", color: c.ink }}>marketing decision</div>
            </div>
          </Pop>
        </Center>
      </Shot>
      <Shot from={tOne} to={tWhere}>
        <Center gap={10} dir="row">
          <Pop at={tOne}><Num value="1" size={300} color={c.accent} style={{ textShadow: `0 0 60px ${GLOW}` }} /></Pop>
          <Pop at={tOne + 3}>
            <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 110, color: c.ink, letterSpacing: "-0.03em", marginLeft: 30 }}>question</div>
          </Pop>
        </Center>
      </Shot>
      <Shot from={tWhere}>
        <Pop at={tWhere} style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <Label chip="1 question">Every marketing decision</Label>
          <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 92, letterSpacing: "-0.03em", color: c.ink }}>
            Where does the <span style={{ color: hl, textShadow: accentT ? `0 0 40px rgba(185,167,255,${0.5 * accentT})` : "none" }}>next dollar</span> go?
          </div>
        </Pop>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: SLOTS }, (_, i) => {
            const on = i === near;
            const x = slotX(i);
            return <path key={i} d={`M ${tx} ${ty + 150} C ${tx} ${ty + 230}, ${x} ${ty + 200}, ${x} 690`} fill="none" stroke={on ? c.accent : "rgba(255,255,255,0.3)"} strokeWidth={on ? 3 : 1.8} strokeDasharray="5 8" opacity={ramp(f, tWhere + 3, tWhere + 9)} />;
          })}
        </svg>
        {Array.from({ length: SLOTS }, (_, i) => {
          const on = i === near;
          return (
            <Pop key={i} at={tWhere + 2} style={{ position: "absolute", left: slotX(i) - SW / 2, top: 690, width: SW, height: 170 }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 20, border: `2px dashed ${on ? c.accent : "rgba(255,255,255,0.18)"}`, background: on ? c.accentSoft : "rgba(255,255,255,0.015)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontWeight: 300, fontSize: 64, color: on ? c.accent : c.faint, boxShadow: on ? `0 0 40px -10px ${GLOW}` : "none" }}>?</div>
            </Pop>
          );
        })}
        <Pop at={tWhere} style={{ position: "absolute", left: tx - 75, top: ty, width: 150, height: 150 }}>
          <div style={{ ...heroGlass, width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 70px -6px ${GLOW}, inset 0 1px 0 rgba(255,255,255,0.1)` }}>
            <Num value="1" prefix="$" size={84} color="#fff" />
          </div>
        </Pop>
      </Shot>
    </AbsoluteFill>
  );
};

/* ───────────── MENU: 6 channels light up → 6 languages → 6 clocks ───────────── */

const MENU = [
  { kind: "conferences", name: "Conferences", word: "Conferences", value: "1,240", unit: "badge scans", clock: "months", speed: 0.6 },
  { kind: "billboards", name: "Billboards", word: "billboards", value: "2.4M", unit: "impressions", clock: "months", speed: 0.45 },
  { kind: "google", name: "Google Ads", word: "Google", value: "38,200", unit: "clicks", clock: "days", speed: 5 },
  { kind: "linkedin", name: "LinkedIn", word: "LinkedIn", value: "860", unit: "leads", clock: "weeks", speed: 1.6 },
  { kind: "email", name: "Cold email", word: "LinkedIn", value: "312", unit: "replies", clock: "weeks", speed: 2.1 },
  { kind: "seo", name: "SEO", word: "S.E.O.", value: "#3", unit: "ranking", clock: "months", speed: 0.35 },
];
const TW = 268, TG = 22;
const tileX = (i: number) => 960 - (6 * TW + 5 * TG) / 2 + i * (TW + TG);

const Clock: React.FC<{ speed: number; phase: number; size?: number }> = ({ speed, phase, size = 34 }) => {
  const f = useCurrentFrame();
  const ang = Math.floor((f * speed + phase) / 3) * 30; // ticks in 30° steps
  return (
    <svg width={size} height={size} viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="14" fill="none" stroke={c.accent} strokeWidth="2" />
      <line x1="17" y1="17" x2="17" y2="7" stroke={c.ink} strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${ang} 17 17)`} />
      <circle cx="17" cy="17" r="2.2" fill={c.accent} />
    </svg>
  );
};

const Tile: React.FC<{ i: number; lit: number; mode: "name" | "language" | "clock"; at: number }> = ({ i, lit, mode, at }) => {
  const f = useCurrentFrame();
  const m = MENU[i];
  const wob = Array.from({ length: 7 }, (_, k) => 0.45 + 0.28 * Math.sin(k * (1.1 + i * 0.37) + f / (6 + i * 2.3) + i));
  return (
    <div style={{ position: "absolute", left: tileX(i), top: 0, width: TW }}>
      <Card style={{ width: TW, height: mode === "name" ? 230 : 300, padding: "24px 22px", position: "relative", overflow: "hidden", opacity: 0.25 + 0.75 * lit, borderColor: lit > 0.5 && mode === "name" ? "rgba(185,167,255,0.35)" : c.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IconTile size={58} tint={lit > 0.5 ? c.accentSoft : "rgba(255,255,255,0.03)"}>
            <Glyph kind={m.kind} size={36} color={lit > 0.5 ? c.accent : c.faint} />
          </IconTile>
          <div style={{ flex: 1, fontFamily: font.sans, minWidth: 0 }}>
            <div style={{ fontSize: 18, color: c.muted }}>Channel</div>
            <div style={{ fontSize: 25, color: c.ink, whiteSpace: "nowrap" }}>{m.name}</div>
          </div>
        </div>
        {mode === "name" && (
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Chip size={18} active={lit > 0.5}>{lit > 0.5 ? "On the menu" : "—"}</Chip>
            <ArrowDot size={42} />
          </div>
        )}
        {mode === "language" && (
          <Pop at={at + i * 2} style={{ marginTop: 30 }}>
            <Num value={m.value} size={64} />
            <div style={{ fontFamily: font.sans, fontSize: 22, color: c.accent, marginTop: 8 }}>{m.unit}</div>
            <div style={{ position: "absolute", left: -12, top: 120 }}>
              <GlowLine points={wob} w={TW} h={80} fill={false} strokeWidth={2.5} />
            </div>
          </Pop>
        )}
        {mode === "clock" && (
          <Pop at={at + i * 2} style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
            <div style={{ fontFamily: font.sans, fontSize: 20, color: c.muted }}>Pays off in</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Clock speed={m.speed} phase={i * 17} size={44} />
              <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 48, color: c.ink, letterSpacing: "-0.03em" }}>{m.clock}</div>
            </div>
          </Pop>
        )}
      </Card>
    </div>
  );
};

export const Menu: React.FC = () => {
  const f = useCurrentFrame();
  const tEach = wordAt("menu", "Each");
  const tAnd = wordAt("menu", "and");
  const litAt = MENU.map((m, i) => wordAt("menu", m.word) - 2 + (i === 4 ? 5 : 0));
  const count = litAt.filter((t) => f >= t).length;
  const header = (label: string, chip: string, at: number) => (
    <Pop at={at} style={{ position: "absolute", left: 0, right: 0, top: 200, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <Num value={chip} size={120} color={c.accent} style={{ textShadow: `0 0 50px ${GLOW}` }} />
        <div style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 64, color: c.ink, letterSpacing: "-0.025em" }}>{label}</div>
      </div>
    </Pop>
  );
  return (
    <AbsoluteFill>
      <Shot from={0} to={tEach}>
        {header(count === 1 ? "channel" : "channels", String(count), 0)}
        <div style={{ position: "absolute", left: 0, top: 440 }}>
          {MENU.map((_, i) => (
            <Tile key={i} i={i} lit={ramp(f, litAt[i], litAt[i] + 5)} mode="name" at={0} />
          ))}
        </div>
      </Shot>
      <Shot from={tEach} to={tAnd}>
        {header("languages", "6", tEach)}
        <div style={{ position: "absolute", left: 0, top: 420 }}>
          {MENU.map((_, i) => <Tile key={i} i={i} lit={1} mode="language" at={tEach} />)}
        </div>
      </Shot>
      <Shot from={tAnd}>
        {header("clocks", "6", tAnd)}
        <div style={{ position: "absolute", left: 0, top: 420 }}>
          {MENU.map((_, i) => <Tile key={i} i={i} lit={1} mode="clock" at={tAnd} />)}
        </div>
      </Shot>
    </AbsoluteFill>
  );
};
