// Act 1 end + Act 2 opening: the cheap-lead trap, one currency, the weekly loop. Quick cuts on spoken words.
import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp } from "../../anim";
import { wordAt } from "../timing";
import { ArrowDot, Card, Chip, Delta, GlowLine, Glyph, IconTile, Label, Num, Title, heroGlass, usd } from "../ui";

const RED_GLOW = "rgba(255,93,93,0.35)";
const GREEN_GLOW = "rgba(63,216,138,0.28)";

/** Renders children only inside [from, to): hard cuts between shots. */
const Shot: React.FC<{ from: number; to?: number; children: React.ReactNode }> = ({ from, to = 1e9, children }) => {
  const f = useCurrentFrame();
  return f >= from && f < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

/** Quick (≤6 frame) pop-in at `at`. */
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({ at, children, style, dy = 14 }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 6);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px) scale(${mix(p, 0.97, 1)})`, ...style }}>{children}</div>;
};

const count = (f: number, at: number, v: number, d = 10) => v * ramp(f, at, at + d, Easing.out(Easing.cubic));

const CardHead: React.FC<{ kind: string; kicker: string; name: string; size?: number; right?: React.ReactNode }> = ({ kind, kicker, name, size = 1, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 * size }}>
    <IconTile size={64 * size}>
      <Glyph kind={kind} size={40 * size} />
    </IconTile>
    <div style={{ fontFamily: font.sans, lineHeight: 1.2, flex: 1 }}>
      <div style={{ fontSize: 20 * size, color: c.muted }}>{kicker}</div>
      <div style={{ fontSize: 28 * size, color: c.ink }}>{name}</div>
    </div>
    {right}
    <ArrowDot size={48 * size} />
  </div>
);

/* ───────────────────────────── TRAP ───────────────────────────── */

export const Trap: React.FC = () => {
  const f = useCurrentFrame();
  const W = (w: string) => wordAt("trap", w);
  const cutCard = W("LinkedIn") - 2;
  const cutRed = W("pricey") - 2;
  const picked = ramp(f, W("number"), W("number") + 5);
  const cheap = W("cheapest");
  return (
    <AbsoluteFill>
      {/* Shot 1: two ways to pick; the easy number gets selected and points down at LinkedIn. */}
      <Shot from={0} to={cutCard}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
          <Pop at={2}>
            <Label size={28}>How a channel gets picked</Label>
          </Pop>
          <div style={{ display: "flex", gap: 36, marginTop: 44, alignItems: "flex-start" }}>
            <Pop at={W("gut") - 4} style={{ opacity: undefined }}>
              <div style={{ opacity: mix(picked, 1, 0.38) }}>
                <Chip size={48} caret>Gut feeling</Chip>
              </div>
            </Pop>
            <Pop at={W("easiest") - 4}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Chip size={48} caret active={picked > 0.5} style={{ boxShadow: `0 0 ${50 * picked}px rgba(185,167,255,${0.5 * picked})` }}>
                  Easiest number
                </Chip>
                <div style={{ width: 2, height: 110 * ramp(f, W("number") + 4, W("number") + 12), background: `linear-gradient(${c.accent}, rgba(185,167,255,0.2))` }} />
                <Pop at={W("number") + 10}>
                  <Chip size={30}>
                    <Glyph kind="linkedin" size={30} /> LinkedIn · Cost per lead
                  </Chip>
                </Pop>
              </div>
            </Pop>
          </div>
        </AbsoluteFill>
      </Shot>

      {/* Shot 2: the easy number — cheapest leads. */}
      <Shot from={cutCard} to={cutRed}>
        <Pop at={cutCard} style={{ position: "absolute", left: 440, top: 170, width: 1040, height: 700 }}>
          <Card style={{ width: "100%", height: "100%", padding: 48, position: "relative", overflow: "hidden", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 90px -40px ${f > cheap ? GREEN_GLOW : "rgba(0,0,0,0.8)"}` }}>
            <CardHead kind="linkedin" kicker="Paid social" name="LinkedIn" right={<Chip size={22} active>Easiest number</Chip>} />
            <div style={{ marginTop: 56 }}>
              <Label size={28}>Cost per lead</Label>
              <Num prefix="$" value={Math.round(count(f, cutCard + 2, 276)).toString()} size={200} style={{ marginTop: 16 }} />
              <div style={{ marginTop: 22, height: 36 }}>
                <Pop at={cheap - 2}>
                  <Delta size={32}>Cheapest of 4</Delta>
                </Pop>
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 10 }}>
              <GlowLine points={[0.18, 0.26, 0.2, 0.34, 0.3, 0.46, 0.42, 0.6, 0.72, 0.9]} w={1040} h={240} draw={ramp(f, cheap - 4, cheap + 14)} color={c.ok} markers={[6, 9]} baseline={0.3} />
            </div>
          </Card>
        </Pop>
      </Shot>

      {/* Shot 3: hard cut — what a qualified sales lead really costs. */}
      <Shot from={cutRed}>
        <div style={{ position: "absolute", left: 440, top: 170, width: 1040, height: 700 }}>
          <Card
            style={{
              width: "100%",
              height: "100%",
              padding: 48,
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(255,93,93,0.32)",
              background: `radial-gradient(70% 60% at 75% 85%, rgba(255,93,93,0.14), transparent 70%), ${c.surface}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 100px -40px ${RED_GLOW}`,
            }}
          >
            <CardHead kind="linkedin" kicker="Paid social" name="LinkedIn" />
            <div style={{ marginTop: 56 }}>
              <Label size={28}>Cost per qualified sales lead</Label>
              <Num prefix="$" value={usd(count(f, cutRed, 3000, 8)).slice(1)} size={200} style={{ marginTop: 16 }} />
              <div style={{ marginTop: 22, height: 36, display: "flex", alignItems: "center", gap: 28 }}>
                <Pop at={cutRed + 4}>
                  <Delta size={32} good={false}>3rd of 4</Delta>
                </Pop>
                <Pop at={cutRed + 8}>
                  <span style={{ fontFamily: font.sans, fontSize: 26, color: c.faint, textDecoration: "line-through" }}>$276 per lead</span>
                </Pop>
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 10 }}>
              <GlowLine points={[0.3, 0.42, 0.56, 0.7, 0.76, 0.66, 0.5, 0.34, 0.22, 0.1]} w={1040} h={240} draw={ramp(f, cutRed, cutRed + 18)} color={c.bad} markers={[4, 9]} label="≈11× a lead" baseline={0.4} />
            </div>
          </Card>
        </div>
      </Shot>
    </AbsoluteFill>
  );
};

/* ─────────────────────────── CURRENCY ─────────────────────────── */

const CPQL = [
  { kind: "conferences", name: "Conferences", kicker: "Events", unit: "Badge scans", v: 1714, good: true, rank: "1st of 4" },
  { kind: "google", name: "Google Ads", kicker: "Search", unit: "Clicks", v: 1889, good: true, rank: "2nd of 4" },
  { kind: "linkedin", name: "LinkedIn", kicker: "Paid social", unit: "Leads", v: 3000, good: false, rank: "3rd of 4" },
  { kind: "billboards", name: "Billboards", kicker: "Out-of-home", unit: "Impressions", v: 6500, good: false, rank: "4th of 4" },
];
const MESSY = [
  { x: -560, y: -150, r: -6 },
  { x: 380, y: -200, r: 5 },
  { x: -300, y: 170, r: 4 },
  { x: 520, y: 130, r: -5 },
];
const UP = [0.2, 0.3, 0.24, 0.4, 0.36, 0.55, 0.5, 0.72, 0.86];
const DOWN = [0.3, 0.46, 0.6, 0.72, 0.64, 0.48, 0.36, 0.24, 0.14];

export const Currency: React.FC = () => {
  const f = useCurrentFrame();
  const W = (w: string) => wordAt("currency", w);
  const line = ramp(f, W("every") - 2, W("every") + 6); // messy → row
  const fold = ramp(f, W("currency") - 3, W("currency") + 5, Easing.in(Easing.cubic)); // row → $
  const cut = W("Cost") - 2;
  return (
    <AbsoluteFill>
      {/* Shot 1: every channel speaks its own unit … then folds into one currency. */}
      <Shot from={0} to={cut}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", justifyContent: "center" }}>
          <Pop at={2}>
            <Label size={28} chip="4 channels">First principles</Label>
          </Pop>
        </div>
        <div style={{ position: "absolute", left: 960, top: 520 }}>
          {CPQL.map((ch, i) => {
            const m = MESSY[i];
            const x = mix(fold, mix(line, m.x, (i - 1.5) * 400), 0);
            const y = mix(fold, mix(line, m.y, 0), 0);
            return (
              <div key={ch.kind} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${mix(line, m.r, 0)}deg) scale(${mix(fold, 1, 0.3)})`, opacity: 1 - fold }}>
                <Pop at={6 + i * 3}>
                  <Chip size={34} style={{ padding: "16px 26px" }}>
                    <Glyph kind={ch.kind} size={40} /> {ch.unit}
                  </Chip>
                </Pop>
              </div>
            );
          })}
          {fold > 0.6 && (
            <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%,-50%) scale(${mix(ramp(f, W("currency") + 2, W("currency") + 8), 0.6, 1)})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
              <div style={{ width: 220, height: 220, borderRadius: 60, ...heroGlass, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 120px -10px rgba(185,167,255,0.55)` }}>
                <span style={{ fontFamily: font.sans, fontWeight: 300, fontSize: 150, color: c.ink, lineHeight: 1 }}>$</span>
              </div>
              <Title size={72} at={W("currency")} style={{ whiteSpace: "nowrap" }}>One currency</Title>
            </div>
          )}
        </div>
      </Shot>

      {/* Shot 2: cost per qualified sales lead, sorted ascending. */}
      <Shot from={cut}>
        <div style={{ position: "absolute", left: 120, top: 150, right: 120, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Pop at={cut}>
            <Label size={24} chip="4 channels">First principles</Label>
            <Title size={68} style={{ marginTop: 10 }}>One currency</Title>
          </Pop>
          <div style={{ display: "flex", gap: 14, paddingBottom: 8 }}>
            <Pop at={cut + 2}>
              <Chip size={24} caret active>Cost per qualified sales lead</Chip>
            </Pop>
            <Pop at={cut + 4}>
              <Chip size={24} caret>Q4</Chip>
            </Pop>
            <Pop at={cut + 6}>
              <Chip size={24} caret>Asc</Chip>
            </Pop>
          </div>
        </div>
        {CPQL.map((ch, i) => {
          const at = cut + 2 + i * 2;
          return (
            <Pop key={ch.kind} at={at} style={{ position: "absolute", left: 120 + i * 427, top: 330, width: 399, height: 540 }}>
              <Card style={{ width: "100%", height: "100%", padding: 30, position: "relative", overflow: "hidden" }}>
                <CardHead kind={ch.kind} kicker={ch.kicker} name={ch.name} size={0.82} />
                <Label size={21} style={{ marginTop: 48 }}>Cost per qualified sales lead</Label>
                <Num prefix="$" value={usd(count(f, at, ch.v, 12)).slice(1)} size={104} style={{ marginTop: 14 }} />
                <div style={{ marginTop: 18 }}>
                  <Delta size={24} good={ch.good}>{ch.rank}</Delta>
                </div>
                <div style={{ position: "absolute", left: 0, bottom: 6 }}>
                  <GlowLine points={ch.good ? UP : DOWN} w={399} h={150} draw={ramp(f, at + 2, at + 16)} color={ch.good ? c.ok : c.bad} markers={[ch.good ? 8 : 8]} baseline={0.35} />
                </div>
              </Card>
            </Pop>
          );
        })}
      </Shot>
    </AbsoluteFill>
  );
};

/* ───────────────────────────── LOOP ───────────────────────────── */

const curve = (x: number) => (1 - Math.exp(-3.2 * x)) / (1 - Math.exp(-3.2));
const N = 24;
const CURVE = Array.from({ length: N }, (_, i) => 0.06 + 0.86 * curve(i / (N - 1)));

const Step: React.FC<{ n: string; label: string; on: number; size?: number }> = ({ n, label, on, size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 * size, opacity: mix(on, 0.35, 1) }}>
    <div style={{ width: 56 * size, height: 56 * size, borderRadius: "50%", border: `1.5px solid ${on > 0.5 ? c.ink : "rgba(255,255,255,0.3)"}`, background: on > 0.5 ? "rgba(255,255,255,0.14)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.sans, fontSize: 24 * size, color: c.ink, boxShadow: `0 0 ${30 * on}px rgba(255,255,255,${0.3 * on})` }}>
      {n}
    </div>
    <div style={{ fontFamily: font.sans, fontSize: 44 * size, fontWeight: 300, color: c.ink, letterSpacing: "-0.02em" }}>{label}</div>
  </div>
);

export const Loop: React.FC = () => {
  const f = useCurrentFrame();
  const W = (w: string) => wordAt("loop", w);
  const cutMove = W("Move") - 2;
  const cutMeasure = W("Measure") - 2;
  const cutRepeat = W("Repeat") - 2;

  // Shot 1 chart geometry.
  const CW = 1080, CH = 400, pad = 14;
  const t = mix(ramp(f, 10, W("buys") + 8, Easing.inOut(Easing.cubic)), 0.16, 0.7);
  const px = (x: number) => pad + x * (CW - pad * 2);
  const py = (x: number) => pad + (1 - (0.06 + 0.86 * curve(x))) * (CH - pad * 2);
  const dx = 0.12;
  const mx = px(t), my = py(t), nx = px(t + dx), ny = py(t + dx);

  // Shot 2: small steps between two bars; Shot 4: one more step per week.
  const week = f >= W("weekly") + 12 ? 3 : f >= W("weekly") ? 2 : 1;
  const step = ramp(f, W("small") - 2, W("steps") + 6);

  return (
    <AbsoluteFill>
      {/* Shot 1: what does the next dollar buy? Diminishing returns. */}
      <Shot from={0} to={cutMove}>
        <Pop at={0} style={{ position: "absolute", left: 360, top: 160, width: 1200, height: 720 }}>
          <Card style={{ width: "100%", height: "100%", padding: "44px 60px", position: "relative" }}>
            <Label size={24} chip="Diminishing returns">Ask</Label>
            <Title size={60} style={{ marginTop: 10 }}>What the next dollar buys</Title>
            <div style={{ position: "absolute", left: 60, top: 250 }}>
              <svg width={CW} height={CH} style={{ position: "absolute", overflow: "visible" }}>
                <line x1={0} x2={CW} y1={CH - 2} y2={CH - 2} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 6" strokeWidth={1.5} />
              </svg>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <GlowLine points={CURVE} w={CW} h={CH} draw={ramp(f, 2, 14)} color={c.accent} />
              </div>
              <svg width={CW} height={CH} style={{ position: "absolute", overflow: "visible", opacity: ramp(f, 10, 15) }}>
                {/* slope triangle: one more step of spend → how much more it buys */}
                <path d={`M ${mx} ${my} H ${nx}`} stroke="rgba(255,255,255,0.45)" strokeDasharray="5 6" strokeWidth={2} />
                <path d={`M ${nx} ${my} V ${ny}`} stroke={c.accent} strokeWidth={4} strokeLinecap="round" />
                <circle cx={nx} cy={ny} r={5} fill={c.accent} />
                <circle cx={mx} cy={my} r={14} fill={c.bg} stroke={c.ink} strokeWidth={3} />
                <circle cx={mx} cy={my} r={5} fill={c.ink} />
                <text x={mx} y={my - 30} textAnchor="middle" fill={c.ink} style={{ fontFamily: font.sans, fontSize: 28 }}>next $</text>
              </svg>
              <div style={{ position: "absolute", left: 0, top: CH + 18, width: CW, display: "flex", justifyContent: "space-between", fontFamily: font.sans, fontSize: 22, color: c.muted }}>
                <span>Qualified sales leads ↑</span>
                <span>Spend →</span>
              </div>
            </div>
          </Card>
        </Pop>
      </Shot>

      {/* Shot 2: move money in small steps. */}
      <Shot from={cutMove} to={cutMeasure}>
        <Pop at={cutMove} style={{ position: "absolute", left: 410, top: 250, width: 1100, height: 500 }}>
          <div style={{ ...heroGlass, width: "100%", height: "100%", padding: "48px 64px" }}>
            <Step n="1" label="Move" on={1} />
            <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 44 }}>
              {[
                { kind: "linkedin", name: "LinkedIn", from: 0.62, to: 0.55, good: false },
                { kind: "conferences", name: "Conferences", from: 0.38, to: 0.45, good: true },
              ].map((b) => (
                <div key={b.kind}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: font.sans, fontSize: 30, color: c.ink, marginBottom: 14 }}>
                    <Glyph kind={b.kind} size={36} /> {b.name}
                    <span style={{ marginLeft: "auto", opacity: step }}>
                      <Delta size={24} good={b.good}>small step</Delta>
                    </span>
                  </div>
                  <div style={{ height: 30, borderRadius: 15, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${mix(step, b.from, b.to) * 100}%`, borderRadius: 15, background: b.good ? `linear-gradient(90deg, #cdbfff, ${c.accent})` : "rgba(255,255,255,0.55)", boxShadow: b.good ? `0 0 30px rgba(185,167,255,0.6)` : "none" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Pop>
      </Shot>

      {/* Shot 3: measure. */}
      <Shot from={cutMeasure} to={cutRepeat}>
        <Pop at={cutMeasure} style={{ position: "absolute", left: 460, top: 210, width: 1000, height: 600 }}>
          <Card style={{ width: "100%", height: "100%", padding: "48px 60px", position: "relative", overflow: "hidden" }}>
            <Step n="2" label="Measure" on={1} size={1.3} />
            <div style={{ marginTop: 34 }}>
              <Chip size={26} caret>Cost per qualified sales lead</Chip>
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 20 }}>
              <GlowLine points={[0.3, 0.38, 0.34, 0.5, 0.46, 0.6, 0.56, 0.74]} w={1000} h={250} draw={ramp(f, cutMeasure, cutMeasure + 14)} markers={[5, 7]} baseline={0.4} />
            </div>
          </Card>
        </Pop>
      </Shot>

      {/* Shot 4: repeat weekly — the loop. */}
      <Shot from={cutRepeat}>
        <Pop at={cutRepeat} style={{ position: "absolute", left: 360, top: 200, width: 1200, height: 640 }}>
          <div style={{ ...heroGlass, width: "100%", height: "100%", padding: "52px 64px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Label size={26} style={{ color: "rgba(243,242,250,0.75)" }}>Our method</Label>
              <Chip size={26} style={{ background: "rgba(255,255,255,0.1)" }}>
                {[1, 2, 3].map((n) => (
                  <span key={n} style={{ color: n === week ? c.ink : "rgba(243,242,250,0.4)", fontWeight: n === week ? 500 : 400 }}>
                    {n === 1 ? "Week 1" : `→ ${n}`}
                  </span>
                ))}
              </Chip>
            </div>
            <Title size={84} style={{ marginTop: 30 }}>The weekly loop</Title>
            <div style={{ position: "absolute", left: 64, right: 64, bottom: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Step n="1" label="Move" on={0.75} />
              <span style={{ fontFamily: font.sans, fontSize: 36, color: "rgba(243,242,250,0.5)" }}>→</span>
              <Step n="2" label="Measure" on={0.75} />
              <span style={{ fontFamily: font.sans, fontSize: 36, color: "rgba(243,242,250,0.5)" }}>→</span>
              <Step n="↻" label="Repeat" on={ramp(f, W("Repeat") - 2, W("Repeat") + 4)} />
            </div>
          </div>
        </Pop>
      </Shot>
    </AbsoluteFill>
  );
};
