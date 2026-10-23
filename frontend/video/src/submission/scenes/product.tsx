// Act 3: the real web app in a browser frame (quick cuts: dashboard → decision close-up → result), then the end card.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { c, font } from "../../theme";
import { mix, ramp, rise } from "../../anim";
import { wordAt } from "../timing";
import { Button, Card, Chip, Delta, GLOW, GlowLine, Label, Num, glass, heroGlass } from "../ui";

// ─────────────────────────────────────────────────────────── app pieces ──

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.27, background: `linear-gradient(160deg, ${c.accent}, ${c.accentStrong})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px -8px rgba(139,109,255,0.6)", flexShrink: 0 }}>
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
      <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke={c.accentInk} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" fill={c.accentInk} />
    </svg>
  </div>
);

const NavIcon: React.FC<{ i: number; color: string }> = ({ i, color }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const shapes = [
    <><rect x="3" y="4" width="14" height="12" rx="2.5" {...p} /><path d="M8 4v12" {...p} /></>,
    <><circle cx="10" cy="4.5" r="2" {...p} /><circle cx="4.5" cy="15" r="2" {...p} /><circle cx="15.5" cy="15" r="2" {...p} /><path d="M10 6.5v3M10 9.5l-4.5 4M10 9.5l4.5 4" {...p} /></>,
    <><path d="M3 17h14M5 14V9M8.5 14V6M12 14v-4M15.5 14V4" {...p} /></>,
    <><path d="M3 15l5-5 3 3 6-7" {...p} /><path d="M13 6h4v4" {...p} /></>,
    <><circle cx="10" cy="10" r="7" {...p} /><circle cx="10" cy="10" r="3" {...p} /></>,
    <><circle cx="9" cy="9" r="5.5" {...p} /><path d="M13 13l4 4" {...p} /></>,
    <><ellipse cx="10" cy="5" rx="6.5" ry="2.5" {...p} /><path d="M3.5 5v10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V5M3.5 10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5" {...p} /></>,
  ];
  return <svg width="22" height="22" viewBox="0 0 20 20">{shapes[i]}</svg>;
};

const NAV = ["This week", "How we reach the goal", "Where the money goes", "Numbers we watch", "Goals and limits", "Deep dives", "Data sources"];
const sans = (size: number, color: string = c.ink, extra: React.CSSProperties = {}): React.CSSProperties => ({ fontFamily: font.sans, fontSize: size, color, lineHeight: 1.3, ...extra });

const Sidebar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 300, height: APP_H, borderRight: `1px solid ${c.line}`, background: "rgba(10,10,18,0.9)", padding: "24px 20px", boxSizing: "border-box" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <Mark size={46} />
      <div>
        <div style={sans(21)}>Agentic CMO</div>
        <div style={sans(14, c.muted)}>The CEO steers, the agent runs marketing</div>
      </div>
    </div>
    <div style={{ ...glass, borderRadius: 16, marginTop: 26, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${c.lineStrong}`, background: c.surface3, display: "flex", alignItems: "center", justifyContent: "center", ...sans(15, c.ink, { fontWeight: 600 }) }}>DF</div>
      <div style={{ flex: 1 }}>
        <div style={sans(17, c.ink, { whiteSpace: "nowrap" })}>Datasaur Foundry</div>
        <div style={sans(14, c.muted)}>Growing company</div>
      </div>
      <span style={sans(14, c.muted)}>⌃⌄</span>
    </div>
    <div style={{ ...sans(14, c.muted, { letterSpacing: "0.2em" }), marginTop: 34, marginLeft: 10 }}>WORKSPACE</div>
    <div style={{ marginTop: 12 }}>
      {NAV.map((n, i) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 14, height: 50, padding: "0 14px", borderRadius: 12, marginBottom: 4, background: i === 0 ? "rgba(255,255,255,0.05)" : "transparent", border: `1px solid ${i === 0 ? c.lineStrong : "transparent"}`, position: "relative" }}>
          <NavIcon i={i} color={i === 0 ? c.ink : c.muted} />
          <span style={sans(17, i === 0 ? c.ink : "#b6b5c9", { whiteSpace: "nowrap" })}>{n}</span>
          {i === 0 && <div style={{ position: "absolute", right: -1, top: 12, width: 2, height: 26, background: c.accent, borderRadius: 2 }} />}
        </div>
      ))}
    </div>
    <div style={{ ...glass, borderRadius: 16, position: "absolute", left: 20, right: 20, bottom: 22, padding: "16px 18px" }}>
      <div style={sans(18)}><span style={{ color: c.accent }}>✦</span>&nbsp; Ask the CMO agent</div>
      <div style={{ ...sans(14, c.muted), marginTop: 6 }}>Why it decided, what happens if you say no.</div>
    </div>
  </div>
);

const ObjCard: React.FC<{ n: number; title: string; label: string; value: React.ReactNode; status: React.ReactNode; line: number[]; color?: string }> = ({ n, title, label, value, status, line, color = c.accent }) => (
  <Card style={{ width: 316, height: 282, padding: "20px 20px 0", position: "relative", overflow: "hidden" }}>
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${c.lineStrong}`, background: c.surface3, display: "flex", alignItems: "center", justifyContent: "center", ...sans(18, c.accent) }}>{n}</div>
      <div>
        <div style={sans(14, c.muted)}>Objective</div>
        <div style={sans(17)}>{title}</div>
      </div>
    </div>
    <div style={{ ...sans(14, c.muted), marginTop: 18 }}>{label}</div>
    <div style={{ marginTop: 8 }}>{value}</div>
    <div style={{ marginTop: 12 }}>{status}</div>
    <div style={{ position: "absolute", left: 0, bottom: 4 }}>
      <GlowLine points={line} w={316} h={64} markers={[line.length - 1]} color={color} strokeWidth={2.5} />
    </div>
  </Card>
);

const StatusChip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = c.ok }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: `${color}1f`, ...sans(15, color) }}>
    <span style={{ width: 7, height: 7, borderRadius: 4, background: color, boxShadow: `0 0 8px ${color}` }} />
    {children}
  </span>
);

// Layout of the app canvas (= browser content area, 1:1 with the wide shot).
const APP_W = 1800;
const APP_H = 818;
const D = { x: 888, y: 520, w: 868, h: 286 }; // "What I need from you"
const IN = { x: D.x + 20, y: D.y + 70, w: D.w - 40, h: 196 }; // the decision item inside it
const APPROVE = { x: IN.x + 24, y: IN.y + 128, w: 132, h: 46 };

const App: React.FC<{ approved: number; press: number; item: number }> = ({ approved, press, item }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: APP_W, height: APP_H, background: "#09090f" }}>
    <Sidebar />
    {/* top bar */}
    <div style={{ position: "absolute", left: 300, right: 0, top: 0, height: 64, borderBottom: `1px solid ${c.line}`, display: "flex", alignItems: "center", padding: "0 44px", gap: 16 }}>
      <span style={sans(20)}>This week</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 9, border: `1px solid ${c.lineStrong}`, background: "rgba(255,255,255,0.03)", ...sans(15, "#c9c8da") }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: c.ok, boxShadow: `0 0 8px ${c.ok}` }} />Live data
      </span>
      <div style={{ flex: 1 }} />
      <Button primary size={18} style={{ padding: "10px 18px", gap: 10 }}>Ask the CMO <span style={{ border: `1px solid ${c.accentInk}55`, borderRadius: 6, padding: "0 6px", fontSize: 14 }}>/</span></Button>
    </div>
    {/* heading */}
    <div style={{ position: "absolute", left: 344, top: 86 }}>
      <Label size={17}>Weekly memo from your CMO agent</Label>
      <div style={{ ...sans(50, c.ink, { letterSpacing: "-0.025em", lineHeight: 1.1 }), marginTop: 6 }}>Datasaur Foundry's week</div>
      <Label size={17} chip="3 objectives" style={{ marginTop: 12 }}>What marketing is working on</Label>
    </div>
    {/* objectives + agent card */}
    <div style={{ position: "absolute", left: 344, top: 222, display: "flex", gap: 20 }}>
      <ObjCard n={1} title="More qualified leads for the same budget" label="Qualified sales leads, projected" value={<Num value="24.9" size={54} />} status={<StatusChip>On track</StatusChip>} line={[0.45, 0.47, 0.44, 0.48, 0.5, 0.52]} />
      <ObjCard n={2} title="Lower cost per qualified lead" label="Cheapest channel per qualified lead" value={<Num prefix="$" value="1,714" size={54} />} status={<Chip size={15}>Conferences</Chip>} line={[0.6, 0.58, 0.55, 0.52, 0.5, 0.46]} />
      <ObjCard n={3} title="Stay inside the Q4 budget" label="Q4 budget left" value={<Num prefix="$" value="62" unit="k" size={54} />} status={<StatusChip>Limit $6.2k a move</StatusChip>} line={[0.7, 0.66, 0.6, 0.55, 0.5, 0.45]} />
      <div style={{ ...heroGlass, width: 412, height: 282, marginLeft: 4, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={sans(16, c.accent)}>CMO agent · this week</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: c.accent, ...sans(14, c.accentInk, { fontWeight: 500 }) }}>Needs you</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 8 }}>
          <Num value="1" size={78} />
          <span style={{ ...sans(21), marginBottom: 8 }}>call needs your yes or no</span>
        </div>
        <div style={{ ...sans(16, "#cfc9ec"), marginTop: 8 }}>Needs approval: move $14k from LinkedIn to Conferences</div>
        <div style={{ marginTop: 14, height: 42, borderRadius: 12, background: `linear-gradient(180deg, #cdbfff, ${c.accent})`, display: "flex", alignItems: "center", justifyContent: "center", ...sans(17, c.accentInk, { fontWeight: 500 }) }}>Review decisions</div>
      </div>
    </div>
    {/* Monday brief */}
    <Card style={{ position: "absolute", left: 344, top: D.y, width: 520, height: D.h, padding: "22px 26px" }}>
      <div style={sans(21)}>Monday brief</div>
      <div style={sans(14, c.faint)}>Written by the CMO agent · new one every Monday</div>
      <div style={{ ...sans(16, "#d6d5e4", { lineHeight: 1.6 }), marginTop: 12 }}>
        <span style={{ color: c.accent }}>Cost per qualified sales lead:</span>
        <br />– Conferences $1,714 · Google Ads $1,889
        <br />– LinkedIn $3,000 (3rd of 4) · Billboards $6,500
        <br />LinkedIn has the cheapest lead ($276), not the cheapest qualified one. Every number comes from SQL.
      </div>
    </Card>
    {/* What I need from you */}
    <Card style={{ position: "absolute", left: D.x, top: D.y, width: D.w, height: D.h }}>
      <div style={{ position: "absolute", left: 28, top: 22, ...sans(21) }}>What I need from you</div>
      <div style={{ position: "absolute", right: 22, top: 22 }}><Chip size={14}>Bigger calls that need your yes or no</Chip></div>
    </Card>
    <div style={{ position: "absolute", left: IN.x, top: IN.y, width: IN.w, height: IN.h, borderRadius: 16, border: `1px solid ${approved > 0.5 ? "rgba(63,216,138,0.35)" : c.lineStrong}`, background: "rgba(255,255,255,0.025)", opacity: item, transform: `translateY(${(1 - item) * 12}px)` }}>
      <div style={{ position: "absolute", left: 24, top: 22, ...sans(23, c.ink, { letterSpacing: "-0.01em" }) }}>
        Needs approval: Move <span style={{ color: c.accent }}>$14k</span> from LinkedIn to Conferences
      </div>
      <div style={{ position: "absolute", left: 24, top: 66, ...sans(18, "#c3c2d4") }}>
        24.9 → 26.5 qualified sales leads, same budget · above your $6.2k limit
      </div>
      <div style={{ position: "absolute", right: 22, top: 20, ...sans(20, c.faint) }}>×</div>
    </div>
    {/* buttons */}
    <div style={{ position: "absolute", left: APPROVE.x, top: APPROVE.y, height: APPROVE.h, display: "flex", gap: 12, opacity: item }}>
      <div style={{ width: APPROVE.w, height: APPROVE.h, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 - press * 0.08})`, ...(approved > 0.5 ? { background: "rgba(63,216,138,0.14)", border: `1px solid ${c.ok}`, ...sans(19, c.ok, { fontWeight: 500 }) } : { background: `linear-gradient(180deg, #cdbfff, ${c.accent})`, border: "1px solid rgba(255,255,255,0.25)", boxShadow: `0 10px 30px -10px ${GLOW}`, ...sans(19, c.accentInk, { fontWeight: 500 }) }) }}>
        {approved > 0.5 ? "Approved ✓" : "Approve"}
      </div>
      <div style={{ height: APPROVE.h, padding: "0 18px", borderRadius: 12, border: `1px solid ${c.lineStrong}`, display: "flex", alignItems: "center", gap: 8, ...sans(19), opacity: 1 - approved * 0.6 }}><svg width="18" height="18" viewBox="0 0 20 20"><path d="M4 4h12a1 1 0 011 1v8a1 1 0 01-1 1H9l-4 3v-3H4a1 1 0 01-1-1V5a1 1 0 011-1z" fill="none" stroke={c.ink} strokeWidth="1.6" strokeLinejoin="round" /></svg> Discuss</div>
      <div style={{ width: 470, height: APPROVE.h, borderRadius: 12, border: `1px solid ${c.line}`, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", padding: "0 16px", boxSizing: "border-box", ...sans(16, c.faint), opacity: 1 - approved * 0.6 }}>Or answer in your own words…</div>
    </div>
  </div>
);

// Browser window (reference: macOS chrome with traffic lights and a centred address pill).
const WIN = { x: 60, y: 40, w: 1800, bar: 52 };
const Browser: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.bar + APP_H, borderRadius: 22, overflow: "hidden", border: `1px solid ${c.lineStrong}`, background: "#0b0b13", boxShadow: "0 60px 120px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.6)" }}>
    <div style={{ height: WIN.bar, display: "flex", alignItems: "center", padding: "0 22px", gap: 10, borderBottom: `1px solid ${c.line}`, background: "#0e0e17", position: "relative" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((col) => <div key={col} style={{ width: 13, height: 13, borderRadius: 7, background: col }} />)}
      <span style={{ ...sans(20, c.faint), marginLeft: 26 }}>‹ &nbsp;›</span>
      <div style={{ position: "absolute", left: WIN.w / 2 - 280, top: 10, width: 560, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...sans(16, "#c9c8da") }}>
        <svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="6" width="10" height="7" rx="1.5" fill="#c9c8da" /><path d="M3.5 6V4a2.5 2.5 0 015 0v2" fill="none" stroke="#c9c8da" strokeWidth="1.5" /></svg>
        agentic-cmo.app
      </div>
    </div>
    <div style={{ position: "relative", width: WIN.w, height: APP_H, overflow: "hidden" }}>{children}</div>
  </div>
);

const Cursor: React.FC<{ x: number; y: number; press: number; opacity: number }> = ({ x, y, press, opacity }) => (
  <svg width="40" height="50" viewBox="0 0 22 27" style={{ position: "absolute", left: x - 3, top: y - 3, opacity, transform: `scale(${1 - press * 0.12})`, transformOrigin: "3px 3px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.6))" }}>
    <path d="M2 2l17 11-8 2 5 9-3 2-5-9-6 5z" fill={c.ink} stroke={c.bg} strokeWidth="1.5" />
  </svg>
);

// ─────────────────────────────────────────────────────────────── product ──

export const Product: React.FC = () => {
  const f = useCurrentFrame();
  const id = "product";
  const CUT1 = wordAt(id, "from"); // dashboard → decision close-up
  const APPR = wordAt(id, "Approve");
  const SIX = wordAt(id, "Six"); // → result
  const SAME = wordAt(id, "same");
  const MORE = wordAt(id, "more");

  const press = f >= APPR ? 1 - ramp(f, APPR + 2, APPR + 9) : ramp(f, APPR - 3, APPR);
  const approved = f >= APPR + 2 ? 1 : 0;

  if (f < SIX) {
    const close = f >= CUT1;
    // Close-up camera: decision item centred, slow push for life.
    const s = close ? mix(ramp(f, CUT1, SIX, (t) => t), 1.9, 2.0) : mix(ramp(f, 0, CUT1, (t) => t), 1, 1.03);
    const fx = close ? IN.x + IN.w / 2 : APP_W / 2;
    const fy = close ? D.y + D.h / 2 : APP_H / 2;
    const tx = APP_W / 2 - fx * s;
    const ty = APP_H / 2 - fy * s;
    // Cursor in screen space, gliding onto Approve.
    const ax = WIN.x + tx + (APPROVE.x + APPROVE.w / 2) * s;
    const ay = WIN.y + WIN.bar + ty + (APPROVE.y + APPROVE.h / 2) * s;
    const glide = ramp(f, CUT1 + 14, APPR - 4);
    const cx = mix(glide, 1500, ax);
    const cy = mix(glide, 880, ay);
    const ring = ramp(f, APPR, APPR + 16);
    return (
      <AbsoluteFill>
        <Browser>
          <div style={{ position: "absolute", left: 0, top: 0, width: APP_W, height: APP_H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
            <App approved={approved} press={press} item={close ? 1 : rise(f, wordAt(id, "Move") - 2, 18)} />
          </div>
        </Browser>
        {close && (
          <>
            {f >= APPR && <div style={{ position: "absolute", left: ax - 70, top: ay - 70, width: 140, height: 140, borderRadius: 70, border: `3px solid ${c.accent}`, opacity: 0.8 * (1 - ring), transform: `scale(${mix(ring, 0.4, 1.6)})` }} />}
            <Cursor x={cx} y={cy} press={press} opacity={ramp(f, CUT1 + 6, CUT1 + 14)} />
          </>
        )}
      </AbsoluteFill>
    );
  }

  // Result shot.
  const count = ramp(f, SIX, SIX + 20);
  const draw = ramp(f, SIX + 2, SIX + 40);
  const same = rise(f, SAME - 3, 16);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 960 - 650, top: 120, width: 1300, height: 760, background: "radial-gradient(ellipse at center, rgba(139,109,255,0.16), transparent 65%)" }} />
      <Card style={{ position: "absolute", left: 210, top: 190, width: 1500, height: 640, padding: "52px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label size={26} chip="Projected">Qualified sales leads · after the move</Label>
          <div style={{ opacity: same, transform: `translateY(${(1 - same) * 14}px) scale(${mix(same, 0.92, 1)})` }}>
            <Chip size={28} active>Same budget</Chip>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 50, gap: 40 }}>
          <div style={{ width: 560 }}>
            <Num value={`+${Math.round(6 * count)}`} unit="%" size={230} />
            <Delta size={30} style={{ marginTop: 22 }}>qualified sales leads</Delta>
            <div style={{ ...sans(44, c.ink, { fontWeight: 300, letterSpacing: "-0.02em" }), marginTop: 40, opacity: rise(f, MORE - 4, 16) }}>
              <span style={{ color: c.muted }}>24.9</span> <span style={{ color: c.accent }}>→</span> 26.5
            </div>
          </div>
          <div style={{ position: "relative", flex: 1, marginTop: 20 }}>
            <GlowLine points={[0.3, 0.32, 0.29, 0.31, 0.3, 0.38, 0.5, 0.63, 0.74, 0.82]} w={760} h={380} draw={draw} markers={[4, 9]} label="26.5" baseline={0.3} />
            <div style={{ position: "absolute", left: 8, top: 380 + 14, ...sans(20, c.muted) }}>Today · 24.9</div>
            <div style={{ position: "absolute", right: 8, top: 380 + 14, ...sans(20, c.muted), opacity: draw }}>Move $14k LinkedIn → Conferences</div>
          </div>
        </div>
      </Card>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────── end ──

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const id = "end";
  const name = wordAt(id, "Agentic");
  const cmo = wordAt(id, "C.M.O.");
  const ceo = wordAt(id, "C.E.O.");
  const agent = wordAt(id, "agent");
  const runs = wordAt(id, "runs");
  const p = (at: number) => rise(f, at, 20);
  const line = (at: number): React.CSSProperties => ({ opacity: p(at), transform: `translateY(${(1 - p(at)) * 20}px)`, display: "inline-block" });
  const rule = ramp(f, runs + 4, runs + 30);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
      <div style={{ position: "absolute", left: 960 - 760, top: 470 - 400, width: 1520, height: 800, background: "radial-gradient(ellipse at center, rgba(139,109,255,0.18) 0%, rgba(139,109,255,0) 62%)", opacity: ramp(f, 0, 40) }} />
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ opacity: p(name - 6), transform: `scale(${mix(p(name - 6), 0.8, 1)})` }}>
          <Mark size={120} />
        </div>
        <div style={{ fontFamily: font.sans, fontWeight: 400, fontSize: 150, lineHeight: 1, letterSpacing: "-0.035em", color: c.ink, display: "flex", gap: "0.22em" }}>
          <span style={line(name - 2)}>Agentic</span>
          <span style={{ ...line(cmo - 2), color: c.accent }}>CMO</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 64, fontFamily: font.sans, fontSize: 52, fontWeight: 400, letterSpacing: "-0.02em" }}>
        <span style={{ ...line(ceo - 4), color: c.muted }}>The CEO steers.</span>
        <span style={{ ...line(agent - 6), color: c.ink }}>The agent runs marketing.</span>
      </div>
      <div style={{ width: 720 * rule, height: 1, background: c.lineStrong, marginTop: 60 }} />
      <div style={{ fontFamily: font.mono, fontSize: 22, color: c.muted, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 28, opacity: ramp(f, runs + 12, runs + 30) }}>
        Built on <span style={{ color: c.ink }}>Snowflake</span>
        <span style={{ color: c.faint, margin: "0 18px" }}>·</span>
        Reasoned by <span style={{ color: c.ink }}>Claude</span>
      </div>
    </AbsoluteFill>
  );
};
