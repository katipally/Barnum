import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { c, font } from "../theme";
import { mix, ramp, rise } from "../anim";
import { wordAt } from "./timing";
import { Big, Card, CHANNELS, Eyebrow, Glyph, Sweep } from "./ui";

const center: React.CSSProperties = { alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28, paddingBottom: 120 };

export const Money: React.FC = () => {
  const a = wordAt("money", "Every");
  const b = wordAt("money", "make");
  return (
    <AbsoluteFill style={center}>
      <Big at={a} size={64} color={c.muted}>Every business exists for one reason.</Big>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Big at={b} size={168}>Make money.</Big>
        <Sweep at={b + 10} width={760} />
      </div>
    </AbsoluteFill>
  );
};

const Node: React.FC<{ at: number; label: string; sub: string; gold?: boolean }> = ({ at, label, sub, gold }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 16);
  return (
    <Card style={{ width: 380, padding: "34px 36px", opacity: p, transform: `scale(${mix(p, 0.85, 1)})`, borderColor: gold ? c.gold : c.lineStrong }}>
      <div style={{ fontFamily: font.sans, fontSize: 56, fontWeight: 600, color: gold ? c.gold : c.ink, letterSpacing: "-0.02em" }}>{label}</div>
      <div style={{ fontFamily: font.sans, fontSize: 26, color: c.muted, marginTop: 6 }}>{sub}</div>
    </Card>
  );
};

const Arrow: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const w = ramp(f, at, at + 12);
  return (
    <svg width="120" height="40" viewBox="0 0 120 40">
      <path d={`M10 20H${10 + 92 * w}`} stroke={c.lineStrong} strokeWidth="4" strokeLinecap="round" />
      {w > 0.95 && <path d="M92 8l14 12-14 12" fill="none" stroke={c.lineStrong} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
};

export const Customers: React.FC = () => {
  const money = wordAt("customers", "Money");
  const cust = wordAt("customers", "customers");
  const mkt = wordAt("customers", "marketing");
  return (
    <AbsoluteFill style={center}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Node at={mkt} label="Marketing" sub="finds and convinces" gold />
        <Arrow at={mkt + 8} />
        <Node at={cust} label="Customers" sub="choose to buy" />
        <Arrow at={cust + 8} />
        <Node at={money} label="Money" sub="revenue" />
      </div>
    </AbsoluteFill>
  );
};

export const Question: React.FC = () => {
  const f = useCurrentFrame();
  const today = wordAt("question", "today");
  const tomorrow = wordAt("question", "tomorrow");
  const q = wordAt("question", "Where");
  const shift = ramp(f, q - 12, q + 6);
  const coin = rise(f, today, 12);
  return (
    <AbsoluteFill style={center}>
      <div style={{ display: "flex", alignItems: "center", gap: 60, opacity: 1 - shift * 0.75, transform: `translateY(${-shift * 120}px) scale(${1 - shift * 0.25})` }}>
        <div style={{ textAlign: "center", opacity: coin }}>
          <div style={{ width: 150, height: 150, borderRadius: 999, border: `5px solid ${c.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontSize: 84, fontWeight: 600, color: c.gold, margin: "0 auto" }}>$</div>
          <div style={{ fontFamily: font.mono, fontSize: 26, color: c.muted, marginTop: 16 }}>TODAY</div>
        </div>
        <Arrow at={today + 10} />
        <div style={{ textAlign: "center", opacity: rise(f, tomorrow, 14) }}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 60, height: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: rise(f, tomorrow + i * 5, 14) }}>
                <div style={{ width: 46, height: 46, borderRadius: 999, background: c.ink }} />
                <div style={{ width: 60, height: 90, borderRadius: "30px 30px 8px 8px", background: c.ink }} />
              </div>
            ))}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 26, color: c.muted, marginTop: 16 }}>TOMORROW</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 520, textAlign: "center" }}>
        <Big at={q} size={104}>
          Where should the <span style={{ color: c.gold }}>next dollar</span> go?
        </Big>
      </div>
    </AbsoluteFill>
  );
};

const words = ["Conferences", "Billboards", "Google", "Cold", "LinkedIn", "S.E.O.", "answers"];

const ChannelTile: React.FC<{ i: number; at: number; flipAt?: number; lagAt?: number; chaos?: number }> = ({ i, at, flipAt, lagAt, chaos = 0 }) => {
  const f = useCurrentFrame();
  const ch = CHANNELS[i];
  const p = rise(f, at, 13);
  const flip = flipAt === undefined ? 0 : ramp(f, flipAt, flipAt + 10);
  const jitterX = Math.sin(f / 7 + i * 1.7) * 14 * chaos;
  const jitterR = Math.sin(f / 9 + i) * 4 * chaos;
  const lag = lagAt === undefined ? 0 : ramp(f, lagAt + i * 3, lagAt + i * 3 + 24);
  return (
    <div style={{ width: 360, opacity: p, transform: `translate(${jitterX}px, ${(1 - p) * 50}px) rotate(${jitterR}deg) scale(${mix(p, 0.8, 1)})` }}>
      <Card style={{ padding: "26px 28px", display: "flex", gap: 22, alignItems: "center" }}>
        <Glyph kind={ch.kind} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.sans, fontSize: 36, fontWeight: 600, color: c.ink }}>{ch.name}</div>
          <div style={{ fontFamily: font.mono, fontSize: 24, color: c.gold, height: 30, opacity: flip, transform: `translateY(${(1 - flip) * 10}px)` }}>{ch.metric}</div>
        </div>
      </Card>
      {lagAt !== undefined && (
        <div style={{ marginTop: 12, height: 10, borderRadius: 5, background: c.surface3 }}>
          <div style={{ height: 10, borderRadius: 5, width: `${(ch.lag / 4) * 100 * lag}%`, background: ch.lag < 1.5 ? c.ok : ch.lag < 3.3 ? c.warn : c.bad }} />
        </div>
      )}
    </div>
  );
};

const TileGrid: React.FC<{ scene: "menu" | "languages" }> = ({ scene }) => {
  const f = useCurrentFrame();
  const menu = scene === "menu";
  const chaos = menu ? ramp(f, wordAt("menu", "answers") + 10, wordAt("menu", "answers") + 40) : 0;
  const metrics = ["Badge", "Impressions", "Clicks", "Replies", "Leads", "Rankings", "Rankings"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 26, justifyContent: "center", width: 1600 }}>
      {CHANNELS.map((_, i) => (
        <ChannelTile
          key={i}
          i={i}
          at={menu ? wordAt("menu", words[i]) : 0}
          flipAt={menu ? undefined : wordAt("languages", metrics[i], i === 6 ? 0 : 0) + (i === 6 ? 8 : 0)}
          lagAt={menu ? undefined : wordAt("languages", "Some")}
          chaos={chaos}
        />
      ))}
    </div>
  );
};

export const Menu: React.FC = () => {
  const f = useCurrentFrame();
  const end = wordAt("menu", "answers") + 10;
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={wordAt("menu", "menu")}>Where could the money go?</Eyebrow>
      <TileGrid scene="menu" />
      <div style={{ fontFamily: font.mono, fontSize: 28, color: c.bad, opacity: ramp(f, end + 14, end + 26) }}>…and dozens more</div>
    </AbsoluteFill>
  );
};

export const Languages: React.FC = () => {
  const f = useCurrentFrame();
  const some = wordAt("languages", "Some");
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={0}>Every channel reports in its own currency</Eyebrow>
      <TileGrid scene="languages" />
      <div style={{ display: "flex", gap: 40, fontFamily: font.mono, fontSize: 24, opacity: ramp(f, some, some + 12) }}>
        <span style={{ color: c.ok }}>■ pays off in days</span>
        <span style={{ color: c.warn }}>■ weeks</span>
        <span style={{ color: c.bad }}>■ months</span>
      </div>
    </AbsoluteFill>
  );
};

export const Trap: React.FC = () => {
  const f = useCurrentFrame();
  const items = [
    { t: "Gut feeling", at: wordAt("trap", "gut") },
    { t: "The loudest voice", at: wordAt("trap", "loudest") },
    { t: "The easiest number to count", at: wordAt("trap", "easiest") },
  ];
  const trap = wordAt("trap", "That's");
  const stamp = rise(f, trap, 10);
  return (
    <AbsoluteFill style={center}>
      <Eyebrow at={0}>How the money gets decided today</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
        {items.map((x) => (
          <Big key={x.t} at={x.at} size={84} color={f > trap ? c.muted : c.ink}>
            {x.t}
          </Big>
        ))}
      </div>
      <div
        style={{
          position: "absolute", right: 210, top: 270, padding: "14px 34px", border: `6px solid ${c.bad}`, borderRadius: 12,
          fontFamily: font.mono, fontSize: 64, fontWeight: 500, color: c.bad, letterSpacing: "0.1em",
          opacity: stamp, transform: `rotate(-9deg) scale(${mix(stamp, 1.8, 1)})`,
        }}
      >
        THE TRAP
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ at: number; label: string; value: string; note: string; tone: string }> = ({ at, label, value, note, tone }) => {
  const f = useCurrentFrame();
  const p = rise(f, at, 15);
  return (
    <Card style={{ width: 640, padding: "40px 44px", opacity: p, transform: `translateY(${(1 - p) * 40}px)`, borderColor: tone }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Glyph kind="linkedin" size={48} />
        <div style={{ fontFamily: font.mono, fontSize: 26, color: c.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      </div>
      <div style={{ fontFamily: font.sans, fontSize: 120, fontWeight: 600, color: c.ink, letterSpacing: "-0.03em", marginTop: 12 }}>{value}</div>
      <div style={{ fontFamily: font.sans, fontSize: 34, fontWeight: 500, color: tone, marginTop: 4 }}>{note}</div>
    </Card>
  );
};

export const LinkedIn: React.FC = () => {
  const cheap = wordAt("linkedin", "cheapest");
  const exp = wordAt("linkedin", "expensive");
  return (
    <AbsoluteFill style={{ ...center, flexDirection: "row", gap: 48 }}>
      <Stat at={cheap - 6} label="Cost per lead" value="$276" note="Cheapest of 4 channels" tone={c.ok} />
      <Stat at={exp - 4} label="Cost per qualified lead" value="$3,000" note="3rd of 4 channels" tone={c.bad} />
    </AbsoluteFill>
  );
};

