// Generator 2 owns this file: menu, languages, trap, linkedin.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp, rise } from "../../anim";
import { wordAt } from "../timing";
import { Card, Eyebrow, Glyph } from "../ui";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const mono: React.CSSProperties = { fontFamily: font.mono, letterSpacing: "0.12em", textTransform: "uppercase" };

/* ───────────────────────────── MENU ───────────────────────────── */

// The seven named channels sit in a centre cluster (world coords, camera-scaled).
const NAMED = [
  { kind: "conferences", name: "Conferences", word: "Conferences" },
  { kind: "billboards", name: "Billboards", word: "Billboards" },
  { kind: "google", name: "Google Ads", word: "Google" },
  { kind: "email", name: "Cold email", word: "Cold" },
  { kind: "linkedin", name: "LinkedIn", word: "LinkedIn" },
  { kind: "seo", name: "SEO", word: "S.E.O." },
  { kind: "ai", name: "AI answers", word: "answers" },
];
const TW = 300, TH = 92, TG = 16;
// Centred layout for the first n tiles: one row up to four, then a second row.
const layout = (n: number, i: number) => {
  const two = n > 4;
  const row = i < 4 ? 0 : 1;
  const count = row ? n - 4 : Math.min(n, 4);
  const k = row ? i - 4 : i;
  const w = count * TW + (count - 1) * TG;
  return { x: -w / 2 + k * (TW + TG), y: two ? (row ? TG / 2 : -TH - TG / 2) : -TH / 2 };
};

const MORE = [
  "Podcasts", "TikTok", "YouTube", "Webinars", "Newsletters", "Meta Ads", "Reddit", "Direct mail", "Trade press",
  "Retargeting", "Referrals", "Partnerships", "Influencers", "PR", "Radio", "Sponsorships", "Affiliates", "Review sites",
  "Cold calls", "Product Hunt", "Community", "Meetups", "Case studies", "White papers", "Free tools", "Display ads",
  "Bing Ads", "Instagram", "Podcast ads", "TV spots", "Print ads", "Out-of-home", "Field events", "Roundtables",
  "Co-marketing", "Swag", "Gifting", "Intent data", "Account-based", "Analyst relations", "Awards", "Speaking slots",
  "Hackathons", "Open source", "Dev relations", "Ambassadors", "Marketplaces", "App stores", "Comparison pages",
  "Quora", "Discord", "Twitch", "Spotify Ads", "Transit ads", "SMS", "WhatsApp", "Programmatic", "Ebooks",
  "Free trial", "Loyalty", "X Ads", "Slack groups", "Trade fairs", "Pinterest", "Snapchat", "Threads", "Substack",
  "G2 reviews", "Capterra", "Google Maps", "Local SEO", "Video ads", "Workshops", "Roadshows", "Client dinners",
  "User groups", "Certifications", "Templates", "Calculators", "Integrations", "Partner directory", "Resellers",
  "Agencies", "Employee advocacy", "Founder posts", "Short-form video", "Live streams", "Hacker News",
  "Explainer videos", "Stadium ads", "Cinema ads", "Catalogues", "Postcards", "Coupons", "Golf days", "Trade shows",
];
const CH = 58, PY = 74, XMAX = 1090, CGAP = 12;
const chipW = (label: string) => Math.round(66 + label.length * 12.4);
const CHIPS = (() => {
  const out: { x: number; y: number; w: number; label: string; d: number }[] = [];
  let li = 0;
  const next = () => MORE[(li++ * 37) % MORE.length];
  const rnd = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
  for (let r = 0; r < 11; r++) {
    const y = (r - 5) * PY;
    const hw = r === 4 || r === 5 ? 624 + 20 : r === 6 ? 466 + 20 : 0;
    const push = (x: number, w: number, label: string) => out.push({ x, y, w, label, d: Math.hypot(x, y * 2.2) + rnd(out.length + 3) * 140 });
    if (hw) {
      for (const dir of [1, -1]) {
        let x = hw;
        while (x < XMAX) {
          const label = next(), w = chipW(label);
          push(dir * (x + w / 2), w, label);
          x += w + CGAP;
        }
      }
    } else {
      let x = -XMAX - rnd(r) * 160;
      while (x < XMAX) {
        const label = next(), w = chipW(label);
        push(x + w / 2, w, label);
        x += w + CGAP;
      }
    }
  }
  out.sort((a, b) => a.d - b.d);
  const S0 = 246, SPAN = 150;
  return out.map((p, k) => ({ ...p, at: Math.round(S0 + SPAN * Math.sqrt((k + 1) / out.length)) }));
})();

const NamedTile: React.FC<{ i: number; ats: number[]; isNew?: boolean }> = ({ i, ats, isNew }) => {
  const f = useCurrentFrame();
  const at = ats[i];
  const p = rise(f, at, 14);
  const flash = 1 - ramp(f, at, at + 24);
  let { x, y } = layout(i + 1, i);
  for (let j = i + 1; j < ats.length; j++) {
    const t = rise(f, ats[j], 22);
    const nx = layout(j + 1, i);
    x = mix(t, x, nx.x);
    y = mix(t, y, nx.y);
  }
  return (
    <div style={{ position: "absolute", left: x, top: y, width: TW, height: TH, opacity: clamp01(p * 1.5), transform: `translateY(${(1 - p) * 28}px) scale(${mix(p, 0.86, 1)})` }}>
      <div
        style={{
          width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "0 24px",
          background: c.surface, border: `1px solid ${flash > 0.02 ? `rgba(243,242,250,${0.16 + 0.5 * flash})` : c.lineStrong}`, borderRadius: 14,
          boxShadow: `0 0 ${40 * flash}px rgba(243,242,250,${0.12 * flash})`,
        }}
      >
        <Glyph kind={NAMED[i].kind} size={46} />
        <div style={{ fontFamily: font.sans, fontSize: 31, fontWeight: 600, color: c.ink, letterSpacing: "-0.01em" }}>{NAMED[i].name}</div>
      </div>
      {isNew && (
        <div style={{ position: "absolute", right: 14, top: -13, padding: "3px 10px", borderRadius: 6, background: c.bg, border: `1px solid ${c.warn}`, color: c.warn, ...mono, fontSize: 15, opacity: ramp(f, at + 8, at + 16) }}>
          New
        </div>
      )}
    </div>
  );
};

export const Menu: React.FC = () => {
  const f = useCurrentFrame();
  const menu = wordAt("menu", "menu");
  const conf = wordAt("menu", "Conferences");
  const ats = NAMED.map((n) => wordAt("menu", n.word) - 3);
  const zoom = ramp(f, 250, 400, inOut);
  const cam = mix(zoom, mix(ramp(f, conf, 250), 1.3, 1.36), 0.93);
  const title = rise(f, menu - 4, 18);
  const titleOut = ramp(f, conf - 12, conf + 2);
  const count = ats.filter((a) => f >= a).length + CHIPS.filter((ch) => f >= ch.at).length;
  const countColor = count > 45 ? c.bad : count > 18 ? c.warn : c.ink;
  return (
    <AbsoluteFill>
      {/* opening line */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140, opacity: Math.min(title, 1 - titleOut) }}>
        <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 108, letterSpacing: "-0.03em", color: c.ink, transform: `translateY(${(1 - title) * 40 - titleOut * 30}px) scale(${1 - titleOut * 0.06})` }}>
          The menu is <span style={{ color: c.muted }}>overwhelming.</span>
        </div>
      </AbsoluteFill>

      {/* camera: centre cluster, then the wall of everything else */}
      <div style={{ position: "absolute", left: 960, top: 490, transform: `scale(${cam})` }}>
        {CHIPS.map((ch, k) => {
          const p = rise(f, ch.at, 16);
          if (p <= 0.001) return null;
          const flash = 1 - ramp(f, ch.at, ch.at + 18);
          return (
            <div
              key={k}
              style={{
                position: "absolute", left: ch.x - ch.w / 2, top: ch.y - CH / 2, width: ch.w, height: CH, boxSizing: "border-box",
                display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderRadius: 10,
                background: c.surface, border: `1px solid rgba(243,242,250,${0.08 + 0.3 * flash})`,
                opacity: clamp01(p * 1.6) * (0.62 + 0.38 * flash), transform: `scale(${mix(p, 0.7, 1)})`,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, background: c.faint, flexShrink: 0 }} />
              <div style={{ fontFamily: font.sans, fontSize: 21, fontWeight: 500, color: c.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.label}</div>
            </div>
          );
        })}
        {NAMED.map((_, i) => (
          <NamedTile key={i} i={i} ats={ats} isNew={i === 6} />
        ))}
      </div>

      {/* HUD */}
      <div style={{ position: "absolute", left: 120, top: 52, opacity: ramp(f, conf - 6, conf + 8) }}>
        <Eyebrow at={conf - 6}>The marketing menu</Eyebrow>
      </div>
      <div style={{ position: "absolute", right: 120, top: 44, display: "flex", alignItems: "baseline", gap: 14, opacity: ramp(f, conf - 6, conf + 8) }}>
        <span style={{ ...mono, fontSize: 20, color: c.muted }}>Channels</span>
        <span style={{ fontFamily: font.mono, fontSize: 40, fontWeight: 500, color: countColor, fontVariantNumeric: "tabular-nums", minWidth: 52, textAlign: "right" }}>{String(count).padStart(2, "0")}</span>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────────────────────── LANGUAGES ─────────────────────────── */

// Each channel reports in its own unit, and pays off on its own clock (days).
const LANES = [
  { kind: "conferences", name: "Conferences", word: "Badge", value: 1240, fmt: (v: number) => Math.round(v).toLocaleString("en-US"), unit: "badge scans", days: 90, lag: "3 months" },
  { kind: "billboards", name: "Billboards", word: "Impressions", value: 2.4, fmt: (v: number) => `${v.toFixed(1)}M`, unit: "impressions", days: 180, lag: "6 months" },
  { kind: "google", name: "Google Ads", word: "Clicks", value: 18300, fmt: (v: number) => Math.round(v).toLocaleString("en-US"), unit: "clicks", days: 2, lag: "2 days" },
  { kind: "email", name: "Cold email", word: "Replies", value: 212, fmt: (v: number) => String(Math.round(v)), unit: "replies", days: 7, lag: "1 week" },
  { kind: "linkedin", name: "LinkedIn", word: "Leads", value: 640, fmt: (v: number) => String(Math.round(v)), unit: "leads", days: 14, lag: "2 weeks" },
  { kind: "seo", name: "SEO", word: "Rankings", value: 3, fmt: (v: number) => `#${Math.max(1, Math.round(mix(v / 3, 40, 3)))}`, unit: "ranking", days: 150, lag: "5 months" },
  { kind: "ai", name: "AI answers", word: "", value: 86, fmt: (v: number) => String(Math.round(v)), unit: "citations", days: 60, lag: "2 months" },
];
const LANE_H = 84, LANE_G = 12, NAME_W = 340, METRIC_W = 470, TL_W = 720, TL_X = NAME_W + METRIC_W + 30;
const tScale = (d: number) => Math.log(1 + d) / Math.log(1 + 200);
const lagTone = (d: number) => (d <= 14 ? c.ok : d <= 60 ? c.warn : c.bad);

export const Languages: React.FC = () => {
  const f = useCurrentFrame();
  const some = wordAt("languages", "Some");
  const days = wordAt("languages", "days");
  const others = wordAt("languages", "Others");
  const months = wordAt("languages", "months");
  const rankings = wordAt("languages", "Rankings");
  const shift = ramp(f, some - 14, some + 10, inOut);
  const offset = mix(shift, (TL_W + 30) / 2, 0);
  const axis = ramp(f, some - 2, some + 14);
  const total = NAME_W + METRIC_W + 30 + TL_W;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 52 }}>
        <Eyebrow at={wordAt("languages", "channel")}>Every channel, its own language</Eyebrow>
      </div>
      <div style={{ position: "absolute", right: 120, top: 48, padding: "6px 14px", border: `1px solid ${c.bad}`, borderRadius: 8, color: c.bad, ...mono, fontSize: 19, opacity: ramp(f, rankings + 22, rankings + 32) }}>
        Units in common: 0
      </div>

      <div style={{ position: "absolute", left: (1920 - total) / 2, top: 128, width: total }}>
        {/* column heads */}
        <div style={{ position: "relative", height: 34, ...mono, fontSize: 17, color: c.faint }}>
          <div style={{ position: "absolute", left: offset + 4, opacity: ramp(f, 4, 20) }}>Channel</div>
          <div style={{ position: "absolute", left: offset + NAME_W, opacity: ramp(f, wordAt("languages", "Badge") - 6, wordAt("languages", "Badge") + 8) }}>Reports in</div>
          <div style={{ position: "absolute", left: TL_X, width: TL_W, opacity: axis }}>Pays off in</div>
        </div>

        {/* time axis */}
        <div style={{ position: "absolute", left: TL_X, top: 34, width: TL_W, height: 7 * LANE_H + 6 * LANE_G + 40, opacity: axis }}>
          {[
            { d: 1, t: "1 day" },
            { d: 7, t: "1 week" },
            { d: 30, t: "1 month" },
            { d: 180, t: "6 months" },
          ].map((tk) => (
            <div key={tk.t} style={{ position: "absolute", left: tScale(tk.d) * TL_W, top: 0, bottom: 0, width: 1, background: c.line }}>
              <div style={{ position: "absolute", bottom: -2, left: 8, whiteSpace: "nowrap", fontFamily: font.mono, fontSize: 17, color: c.faint }}>{tk.t}</div>
            </div>
          ))}
        </div>

        {LANES.map((ln, i) => {
          const enter = rise(f, 8 + i * 4, 18);
          const at = ln.word ? wordAt("languages", ln.word) : rankings + 14;
          const m = ramp(f, at - 2, at + 16);
          const hl = ramp(f, at - 2, at + 4) * (1 - ramp(f, at + 14, at + 34));
          const fast = ln.days <= 14;
          const g0 = fast ? days - 10 : others - 4;
          const g1 = fast ? days + 10 : months + 18;
          const grow = fast ? ramp(f, g0, g1) : interpolate(f, [g0, g1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0.1, 0.4, 1) });
          const w = tScale(ln.days) * TL_W * grow;
          const done = ramp(f, g1 - 2, g1 + 8);
          const tone = lagTone(ln.days);
          const pulse = grow > 0 && grow < 1 ? 0.5 + 0.5 * Math.sin(f / 2.5) : 0;
          return (
            <div key={ln.kind} style={{ position: "relative", height: LANE_H, marginBottom: LANE_G, opacity: clamp01(enter * 1.4), transform: `translateY(${(1 - enter) * 24}px)` }}>
              <div
                style={{
                  position: "absolute", left: offset, top: 0, width: NAME_W + METRIC_W, height: LANE_H, boxSizing: "border-box",
                  display: "flex", alignItems: "center", background: c.surface, borderRadius: 14,
                  border: `1px solid rgba(243,242,250,${0.12 + 0.45 * hl})`,
                }}
              >
                <div style={{ width: NAME_W, display: "flex", alignItems: "center", gap: 16, paddingLeft: 22, boxSizing: "border-box" }}>
                  <Glyph kind={ln.kind} size={40} color={c.ink} />
                  <div style={{ fontFamily: font.sans, fontSize: 30, fontWeight: 600, color: c.ink }}>{ln.name}</div>
                </div>
                <div style={{ width: 1, height: 44, background: c.line }} />
                <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 14, paddingLeft: 28, opacity: m, transform: `translateY(${(1 - m) * 12}px)` }}>
                  <span style={{ fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{ln.fmt(ln.value * m)}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 24, color: hl > 0.05 ? c.ink : c.muted }}>{ln.unit}</span>
                </div>
              </div>
              {/* payoff bar */}
              <div style={{ position: "absolute", left: TL_X, top: LANE_H / 2 - 5, width: TL_W, height: 10, opacity: axis }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 4, height: 2, background: c.surface3 }} />
                <div style={{ position: "absolute", left: 0, top: 0, width: w, height: 10, borderRadius: 5, background: tone, opacity: 0.9 }} />
                {grow > 0 && (
                  <div style={{ position: "absolute", left: w - 9, top: -4, width: 18, height: 18, borderRadius: 9, background: tone, boxShadow: `0 0 ${10 + 14 * pulse}px ${tone}` }} />
                )}
                <div style={{ position: "absolute", left: w + 20, top: -11, whiteSpace: "nowrap", fontFamily: font.mono, fontSize: 22, color: tone, opacity: done }}>{ln.lag}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────────── TRAP ───────────────────────────── */

const TrapIcon: React.FC<{ kind: "gut" | "voice" | "count"; color: string }> = ({ kind, color }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={60} height={60} viewBox="0 0 64 64">
      {kind === "gut" && (<><path d="M32 54C14 42 6 32 6 22a12 12 0 0 1 26-6 12 12 0 0 1 26 6c0 10-8 20-26 32z" {...p} /><path d="M14 30h10l4-8 6 16 4-8h12" {...p} /></>)}
      {kind === "voice" && (<><path d="M8 26v12h10l20 12V14L18 26z" {...p} /><path d="M46 24c4 4 4 12 0 16M52 18c8 8 8 20 0 28" {...p} /></>)}
      {kind === "count" && (<><path d="M12 12v40M22 12v40M32 12v40M42 12v40" {...p} /><path d="M6 44L50 18" {...p} /></>)}
    </svg>
  );
};

const Teeth: React.FC<{ flip?: boolean; width: number }> = ({ flip, width }) => {
  const n = 22, tw = width / n, h = 34;
  let d = `M0 0`;
  for (let i = 0; i < n; i++) d += ` L${i * tw + tw / 2} ${h} L${(i + 1) * tw} 0`;
  return (
    <svg width={width} height={h + 8} viewBox={`-2 -4 ${width + 4} ${h + 8}`} style={{ display: "block", transform: flip ? "scaleY(-1)" : undefined }}>
      <path d={`M-2 0H${width + 2}`} stroke={c.bad} strokeWidth={6} strokeLinecap="round" />
      <path d={d} fill="rgba(255,93,93,0.16)" stroke={c.bad} strokeWidth={3.5} strokeLinejoin="round" />
    </svg>
  );
};

export const Trap: React.FC = () => {
  const f = useCurrentFrame();
  const rows = [
    { t: "Gut feeling", k: "gut" as const, at: wordAt("trap", "gut") },
    { t: "The loudest voice", k: "voice" as const, at: wordAt("trap", "loudest") },
    { t: "The easiest number to count", k: "count" as const, at: wordAt("trap", "easiest") },
  ];
  const thats = wordAt("trap", "That's");
  const trap = wordAt("trap", "trap");
  const recede = ramp(f, thats - 8, thats + 8);
  const word = rise(f, thats, 16);
  const close = interpolate(f, [trap - 3, trap + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const jawOpen = ramp(f, thats - 4, thats + 10);
  const hit = f >= trap + 3 ? Math.exp(-(f - trap - 3) / 5) : 0;
  const shake = hit * 14 * Math.sin((f - trap) * 2.6);
  const gap = mix(close, 300, 132);
  const counter = Math.round(interpolate(f, [rows[2].at, thats], [1180, 1412], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const active = rows.reduce((a, r, i) => (f >= r.at - 4 ? i : a), -1);
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
      {/* the three ways money gets decided */}
      <AbsoluteFill style={{ opacity: 1 - recede * 0.94, filter: `blur(${recede * 10}px)`, transform: `scale(${1 - recede * 0.08})` }}>
        <div style={{ position: "absolute", left: 120, top: 52 }}>
          <Eyebrow at={wordAt("trap", "decisions")}>How the money gets decided</Eyebrow>
        </div>
        <div style={{ position: "absolute", left: 300, top: 236, display: "flex", flexDirection: "column", gap: 34 }}>
          {rows.map((r, i) => {
            const p = rise(f, r.at - 4, 16);
            const on = i === active;
            const col = on ? c.ink : c.faint;
            return (
              <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 36, opacity: clamp01(p * 1.4), transform: `translateX(${(1 - p) * -40}px)` }}>
                <div style={{ width: 112, height: 112, borderRadius: 18, background: c.surface, border: `1px solid ${on ? c.lineStrong : c.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrapIcon kind={r.k} color={col} />
                </div>
                <div style={{ fontFamily: font.sans, fontWeight: 600, fontSize: 80, letterSpacing: "-0.03em", color: on ? c.ink : c.muted, opacity: on ? 1 : 0.55 }}>{r.t}</div>
                {i === 2 && (
                  <div style={{ marginLeft: 6, padding: "8px 16px", borderRadius: 10, border: `1px solid ${c.lineStrong}`, fontFamily: font.mono, fontSize: 26, color: c.muted, fontVariantNumeric: "tabular-nums", opacity: ramp(f, r.at + 6, r.at + 14) }}>
                    likes <span style={{ color: c.ink }}>{counter.toLocaleString("en-US")}</span> <span style={{ color: c.ok }}>▲</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* red flash on the snap */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 45% at 50% 44%, rgba(255,93,93,${0.22 * hit}) 0%, rgba(255,93,93,0) 70%)` }} />

      {/* the trap: jaws snap shut around the words */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, height: 0 }}>
        <div style={{ position: "absolute", left: 310, top: -gap - 42, opacity: jawOpen }}>
          <Teeth width={1300} />
        </div>
        <div style={{ position: "absolute", left: 310, top: gap, opacity: jawOpen }}>
          <Teeth width={1300} flip />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: -100, textAlign: "center", fontFamily: font.sans, fontWeight: 600, fontSize: 190, lineHeight: 1, letterSpacing: "-0.04em", color: c.ink, opacity: clamp01(word * 1.4), transform: `translateY(${(1 - word) * 40}px) scale(${1 + hit * 0.04})` }}>
          The <span style={{ color: f >= trap ? c.bad : c.ink }}>trap.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────────────────────── LINKEDIN ─────────────────────────── */

// Demo company: cost per lead (LinkedIn cheapest) vs cost per qualified sales lead (LinkedIn 3rd of 4).
const BOARD = [
  { kind: "linkedin", name: "LinkedIn", cpl: 276, cpsql: 3000 },
  { kind: "google", name: "Google Ads", cpl: 410, cpsql: 1889 },
  { kind: "conferences", name: "Conferences", cpl: 520, cpsql: 1714 },
  { kind: "billboards", name: "Billboards", cpl: 1300, cpsql: 6500 },
];
const rankOf = (key: "cpl" | "cpsql", i: number) => [...BOARD].sort((a, b) => a[key] - b[key]).indexOf(BOARD[i]);
const ROW_H = 98, ROW_G = 14;

export const LinkedIn: React.FC = () => {
  const f = useCurrentFrame();
  const li = wordAt("linkedin", "LinkedIn");
  const cheap = wordAt("linkedin", "cheapest");
  const and = wordAt("linkedin", "And");
  const exp = wordAt("linkedin", "expensive");
  const cust = wordAt("linkedin", "customers");
  const swap = ramp(f, exp - 10, exp + 14, inOut);
  const head = ramp(f, and + 2, and + 20);
  const maxV = mix(swap, 1300, 6500);
  const badgeFlip = ramp(f, exp - 2, exp + 8);
  const tag = ramp(f, cheap - 2, cheap + 8);
  const tagFlip = ramp(f, cust - 4, cust + 6);
  const BW = 1360;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 52 }}>
        <Eyebrow at={li - 6}>Same channel, two numbers</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: (1920 - BW) / 2, top: 250, width: BW, opacity: ramp(f, 0, 10) }}>
        {/* header: what we rank by */}
        <div style={{ position: "relative", height: 70, marginBottom: 10, borderBottom: `1px solid ${c.line}` }}>
          <span style={{ position: "absolute", left: 0, top: 18, ...mono, fontSize: 19, color: c.faint }}>Ranked by</span>
          <div style={{ position: "absolute", left: 170, top: 6, fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, opacity: 1 - ramp(head, 0, 0.5), transform: `translateY(${-head * 26}px)` }}>
            Cost per lead
          </div>
          <div style={{ position: "absolute", left: 170, top: 6, fontFamily: font.sans, fontSize: 40, fontWeight: 600, color: c.ink, opacity: ramp(head, 0.45, 1), transform: `translateY(${(1 - head) * 26}px)` }}>
            Cost per <span style={{ color: c.gold }}>qualified sales lead</span>
          </div>
          <span style={{ position: "absolute", right: 0, top: 18, ...mono, fontSize: 19, color: c.faint }}>cheapest first</span>
        </div>
        <div style={{ position: "relative", height: 4 * ROW_H + 3 * ROW_G }}>
          {BOARD.map((r, i) => {
            const isLi = r.kind === "linkedin";
            const enter = rise(f, isLi ? li - 4 : li + 2 + i * 3, 16);
            const y = mix(swap, rankOf("cpl", i), rankOf("cpsql", i)) * (ROW_H + ROW_G);
            const v = mix(swap, r.cpl, r.cpsql);
            const lift = isLi ? Math.sin(swap * Math.PI) : 0;
            const tone = isLi ? (badgeFlip < 0.5 ? c.ok : c.bad) : c.lineStrong;
            const rank = Math.round(mix(badgeFlip, rankOf("cpl", i), rankOf("cpsql", i))) + 1;
            const flipScale = Math.abs(Math.cos(badgeFlip * Math.PI));
            return (
              <div
                key={r.kind}
                style={{
                  position: "absolute", left: 0, top: y, width: BW, height: ROW_H, boxSizing: "border-box", zIndex: isLi ? 2 : 1,
                  display: "flex", alignItems: "center", gap: 24, padding: "0 28px", borderRadius: 16,
                  background: isLi ? c.surface2 : c.surface, border: `1px solid ${isLi ? tone : c.line}`,
                  boxShadow: isLi ? `0 ${12 + 20 * lift}px ${40 + 30 * lift}px rgba(0,0,0,${0.35 + 0.25 * lift})` : undefined,
                  opacity: clamp01(enter * 1.4), transform: `translateX(${(1 - enter) * 40}px) scale(${1 + 0.025 * lift})`,
                }}
              >
                <div style={{ width: 96, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 34, fontWeight: 500, color: isLi ? tone : c.faint, display: "inline-block", transform: isLi ? `scaleY(${Math.max(0.05, flipScale)})` : undefined }}>#{rank}</span>
                  {isLi && <span style={{ fontFamily: font.mono, fontSize: 18, color: c.bad, opacity: ramp(f, exp + 10, exp + 18) }}>▼2</span>}
                </div>
                <div style={{ width: 530, display: "flex", alignItems: "center", gap: 18 }}>
                  <Glyph kind={r.kind} size={46} color={isLi ? c.ink : c.muted} />
                  <div style={{ fontFamily: font.sans, fontSize: 34, fontWeight: 600, color: isLi ? c.ink : c.muted }}>{r.name}</div>
                  {isLi && (
                    <div style={{ position: "relative", height: 34, marginLeft: 6, opacity: tag }}>
                      <div style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", padding: "4px 12px", borderRadius: 7, border: `1px solid ${c.ok}`, color: c.ok, ...mono, fontSize: 17, opacity: 1 - tagFlip, transform: `translateY(${-tagFlip * 14}px)` }}>
                        Cheapest leads
                      </div>
                      <div style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", padding: "4px 12px", borderRadius: 7, border: `1px solid ${c.bad}`, color: c.bad, ...mono, fontSize: 17, opacity: tagFlip, transform: `translateY(${(1 - tagFlip) * 14}px)` }}>
                        Expensive customers
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, height: 14, borderRadius: 7, background: c.surface3, position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 14, borderRadius: 7, width: `${(v / maxV) * 100 * ramp(f, li + i * 3, li + i * 3 + 20)}%`, background: isLi ? tone : c.faint }} />
                </div>
                <div style={{ width: 150, textAlign: "right", fontFamily: font.mono, fontSize: 34, color: isLi ? c.ink : c.muted, fontVariantNumeric: "tabular-nums" }}>{usd(v)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
