import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline, Scene } from "../components";
import { c, font } from "../theme";
import { ramp, rise } from "../anim";

const OBJ = [
  { id: "sql", label: "Grow SQLs +18%", driver: "SQLs", y: 400 },
  { id: "win", label: "Win rate to 22%", driver: "Win rate", y: 560 },
  { id: "churn", label: "Churn below 6%", driver: "Churn", y: 720 },
];

const ACT = [
  { id: "core", label: "Core keywords", budget: 60, y: 340 },
  { id: "nlp", label: "NLP labeling search", budget: 40, y: 460 },
  { id: "web", label: "Webinar series", budget: 25, y: 580 },
  { id: "cmp", label: "Comparison pages", budget: 15, y: 700 },
  { id: "cust", label: "Customer marketing", budget: 20, y: 820 },
];

// [objective, action, credit 0..1]
const LINKS: [string, string, number][] = [
  ["sql", "core", 0.35],
  ["sql", "nlp", 0.9],
  ["sql", "web", 0.5],
  ["win", "web", 0.45],
  ["win", "cmp", 0.8],
  ["sql", "cmp", 0.25],
  ["churn", "cust", 0.85],
  ["win", "cust", 0.2],
];

const OX = 140;
const OW = 480;
const AX = 1260;
const AW = 520;
const H = 92;

export const MapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const flag = ramp(frame, 170, 190);
  const callout = rise(frame, 186);
  const oy = (id: string) => OBJ.find((o) => o.id === id)!.y;
  const ay = (id: string) => ACT.find((a) => a.id === id)!.y;

  return (
    <Scene>
      <Headline step="03" label="Objectives × actions" title="…and maps every dollar to the goals" />
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: OX,
            top: 300,
            fontFamily: font.mono,
            fontSize: 20,
            letterSpacing: 3,
            color: c.faint,
            textTransform: "uppercase",
            opacity: ramp(frame, 18, 30),
          }}
        >
          Marketing objectives
        </div>
        <div
          style={{
            position: "absolute",
            left: AX,
            top: 240,
            width: AW,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: font.mono,
            fontSize: 20,
            letterSpacing: 3,
            color: c.faint,
            textTransform: "uppercase",
            opacity: ramp(frame, 30, 42),
          }}
        >
          <span>Actions</span>
          <span>Budget / qtr</span>
        </div>

        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          {LINKS.map(([o, a, w], i) => {
            const t = ramp(frame, 60 + i * 7, 90 + i * 7);
            const x1 = OX + OW;
            const x2 = AX;
            const y1 = oy(o);
            const y2 = ay(a);
            const isCore = a === "core";
            const stroke = isCore && flag > 0 ? c.bad : c.ink;
            const op = isCore ? 0.35 + (0.35 - 0.35) * flag : 0.22 + w * 0.25;
            return (
              <path
                key={o + a}
                d={`M${x1} ${y1} C ${x1 + 260} ${y1}, ${x2 - 260} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={stroke}
                strokeOpacity={isCore ? (flag > 0 ? 0.9 - 0.45 * flag : op) : op}
                strokeWidth={2 + w * 16 * (isCore ? 1 - 0.75 * flag : 1)}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - t}
              />
            );
          })}
        </svg>

        {OBJ.map((o, i) => {
          const t = rise(frame, 18 + i * 8, 20);
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: OX,
                top: o.y - H / 2 + 0,
                width: OW,
                height: H + 20,
                boxSizing: "border-box",
                background: c.surface,
                border: `1px solid ${c.lineStrong}`,
                padding: "0 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                opacity: Math.min(1, t * 1.5),
                transform: `translateX(${(1 - t) * -40}px)`,
                marginTop: -10,
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 600 }}>{o.label}</div>
              <div style={{ marginTop: 4, fontFamily: font.mono, fontSize: 20, color: c.faint }}>
                driver · {o.driver}
              </div>
            </div>
          );
        })}

        {ACT.map((a, i) => {
          const t = rise(frame, 30 + i * 6, 20);
          const isCore = a.id === "core";
          return (
            <div
              key={a.id}
              style={{
                position: "absolute",
                left: AX,
                top: a.y - H / 2,
                width: AW,
                height: H,
                boxSizing: "border-box",
                background: c.surface,
                border: `1px solid ${isCore && flag > 0 ? c.bad : c.lineStrong}`,
                padding: "0 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: Math.min(1, t * 1.5) * (isCore ? 1 - 0.25 * flag : 1),
                transform: `translateX(${(1 - t) * 40}px)`,
              }}
            >
              <span style={{ fontSize: 30 }}>{a.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 60, height: 6, background: c.surface3, position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(a.budget / 60) * 100 * ramp(frame, 50, 80)}%`,
                      background: isCore && flag > 0 ? c.bad : c.muted,
                    }}
                  />
                </span>
                <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", width: 72, textAlign: "right" }}>
                  ${a.budget}k
                </span>
              </span>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 680,
            top: 830,
            width: 520,
            fontFamily: font.mono,
            fontSize: 20,
            color: c.faint,
            textAlign: "center",
            opacity: ramp(frame, 120, 140) * (1 - callout),
          }}
        >
          Line width = share of credit · N:N
        </div>

        <div
          style={{
            position: "absolute",
            left: 140,
            top: 900,
            width: 1640,
            boxSizing: "border-box",
            background: c.surface2,
            border: `1px solid ${c.lineStrong}`,
            borderLeft: `4px solid ${c.bad}`,
            padding: "24px 32px",
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            opacity: callout,
            transform: `translateY(${(1 - callout) * 30}px)`,
          }}
        >
          <span style={{ fontSize: 38, fontWeight: 600, color: c.bad }}>Core keywords: $946 per conversion</span>
          <span style={{ fontSize: 32, color: c.muted }}>— 10× our best search campaign</span>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
