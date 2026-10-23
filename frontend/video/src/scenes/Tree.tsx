import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Dot, Headline, Scene } from "../components";
import { c, font } from "../theme";
import { ramp, rise } from "../anim";

type Node = {
  id: string;
  op?: string;
  label: string;
  value: string;
  x: number;
  y: number;
  w: number;
  status: string;
  delay: number;
};

const H = 104;
const NODES: Node[] = [
  { id: "root", label: "Net new ARR", value: "$2.2M", x: 140, y: 640, w: 440, status: c.warn, delay: 20 },
  { id: "new", op: "+", label: "New ARR", value: "$1.6M", x: 700, y: 450, w: 400, status: c.warn, delay: 48 },
  { id: "exp", op: "+", label: "Expansion", value: "$0.9M", x: 700, y: 640, w: 400, status: c.ok, delay: 56 },
  { id: "churn", op: "−", label: "Churn", value: "$0.3M", x: 700, y: 830, w: 400, status: c.ok, delay: 64 },
  { id: "sql", label: "SQLs", value: "400 / yr", x: 1240, y: 330, w: 380, status: c.bad, delay: 92 },
  { id: "win", op: "×", label: "Win rate", value: "20%", x: 1240, y: 450, w: 380, status: c.ok, delay: 100 },
  { id: "acv", op: "×", label: "ACV", value: "$20k", x: 1240, y: 570, w: 380, status: c.ok, delay: 108 },
];

const EDGES: [string, string, number][] = [
  ["root", "new", 36],
  ["root", "exp", 42],
  ["root", "churn", 48],
  ["new", "sql", 80],
  ["new", "win", 86],
  ["new", "acv", 92],
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const Tree: React.FC = () => {
  const frame = useCurrentFrame();
  const alarm = ramp(frame, 150, 165);
  const pulse = frame > 150 ? 0.5 + 0.5 * Math.sin((frame - 150) / 5) : 0;
  const callout = rise(frame, 172);

  return (
    <Scene>
      <Headline step="02" label="Revenue tree" title="The agent breaks them into a revenue tree" />
      <AbsoluteFill>
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          {EDGES.map(([a, b, d]) => {
            const A = byId[a];
            const B = byId[b];
            const x1 = A.x + A.w;
            const x2 = B.x;
            const mx = (x1 + x2) / 2;
            const t = ramp(frame, d, d + 22);
            const hot = b === "sql" || (a === "root" && b === "new");
            return (
              <path
                key={a + b}
                d={`M${x1} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${x2} ${B.y}`}
                fill="none"
                stroke={hot && alarm > 0 ? c.bad : c.lineStrong}
                strokeOpacity={hot && alarm > 0 ? 0.4 + 0.5 * alarm : 1}
                strokeWidth={2}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - t}
              />
            );
          })}
          {/* callout leader from SQLs to the alert card */}
          <path
            d={`M1620 330 L 1700 330 L 1700 720`}
            fill="none"
            stroke={c.bad}
            strokeWidth={2}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - ramp(frame, 160, 178)}
          />
        </svg>

        {NODES.map((n) => {
          const t = rise(frame, n.delay, 20);
          const isSql = n.id === "sql";
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: n.x,
                top: n.y - H / 2,
                width: n.w,
                height: H,
                boxSizing: "border-box",
                background: isSql && alarm > 0 ? `rgba(229,83,75,${0.06 + 0.08 * pulse * alarm})` : c.surface,
                border: `1px solid ${isSql && alarm > 0 ? c.bad : c.lineStrong}`,
                boxShadow: isSql && alarm > 0 ? `0 0 ${24 + 30 * pulse}px rgba(229,83,75,${0.35 * alarm})` : "none",
                padding: "0 28px",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: Math.min(1, t * 1.5),
                transform: `translateX(${(1 - t) * -40}px)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {n.op && (
                  <span style={{ fontFamily: font.mono, fontSize: 30, color: c.gold, width: 22 }}>{n.op}</span>
                )}
                <span style={{ fontSize: 32, color: n.id === "root" ? c.ink : c.muted }}>{n.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 34, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{n.value}</span>
                <Dot color={isSql ? (alarm > 0 ? c.bad : c.faint) : n.status} />
              </div>
            </div>
          );
        })}

        {/* alert card */}
        <div
          style={{
            position: "absolute",
            left: 1200,
            top: 720,
            width: 580,
            boxSizing: "border-box",
            background: c.surface2,
            border: `1px solid ${c.lineStrong}`,
            borderLeft: `4px solid ${c.bad}`,
            padding: "26px 30px",
            opacity: callout,
            transform: `translateY(${(1 - callout) * 30}px)`,
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 600, color: c.bad }}>SQLs 18% behind pace</div>
          <div style={{ marginTop: 10, fontSize: 26, color: c.muted }}>
            312 of 380 expected by week 9 — the driver to fix first
          </div>
        </div>

        {/* formula strip */}
        <div
          style={{
            position: "absolute",
            left: 140,
            top: 960,
            fontFamily: font.mono,
            fontSize: 26,
            color: c.faint,
            display: "flex",
            gap: 60,
          }}
        >
          <span style={{ opacity: ramp(frame, 60, 80) }}>Net new ARR = New ARR + Expansion − Churn</span>
          <span style={{ opacity: ramp(frame, 110, 130) }}>New ARR = SQLs × Win rate × ACV</span>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
