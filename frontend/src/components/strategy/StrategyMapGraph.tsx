"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Action, Contribution, MarketingObjective, Status } from "@/lib/types";
import { Term } from "@/components/ui/Term";
import { ActionNode, ObjectiveNode } from "./MapNodes";
import { type Focus, isLessSure, verdictOf } from "./model";

type Link = { key: string; d: string; c: Contribution };

const linkKey = (c: Contribution) => `${c.objectiveId}->${c.actionId}`;

// Spread several link ends across a node edge so they don't all meet in one point.
function portOffsets(ids: string[], ys: Map<string, number>, height: number) {
  const sorted = [...ids].sort((a, b) => (ys.get(a) ?? 0) - (ys.get(b) ?? 0));
  const step = sorted.length > 1 ? Math.min(7, (height - 16) / (sorted.length - 1)) : 0;
  const out = new Map<string, number>();
  sorted.forEach((id, i) => out.set(id, (i - (sorted.length - 1) / 2) * Math.max(step, 0)));
  return out;
}

export function StrategyMapGraph({
  objectives,
  actions,
  contributions,
  focus,
  onFocus,
  minTestWeeks,
}: {
  objectives: (MarketingObjective & { status: Status })[];
  actions: Action[];
  contributions: Contribution[];
  focus: Focus;
  onFocus: (f: Focus) => void;
  minTestWeeks: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<Link[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const setNode = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    [],
  );

  const layout = useCallback(() => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const rect = (key: string) => {
      const r = nodes.current.get(key)?.getBoundingClientRect();
      return r ? { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height } : null;
    };
    const mid = new Map<string, number>();
    for (const o of objectives) {
      const r = rect(`o:${o.id}`);
      if (r) mid.set(`o:${o.id}`, r.y + r.h / 2);
    }
    for (const a of actions) {
      const r = rect(`a:${a.id}`);
      if (r) mid.set(`a:${a.id}`, r.y + r.h / 2);
    }

    const next: Link[] = [];
    for (const c of contributions) {
      const o = rect(`o:${c.objectiveId}`);
      const a = rect(`a:${c.actionId}`);
      if (!o || !a) continue;
      const fromIds = contributions.filter((x) => x.objectiveId === c.objectiveId && mid.has(`a:${x.actionId}`));
      const toIds = contributions.filter((x) => x.actionId === c.actionId && mid.has(`o:${x.objectiveId}`));
      const oOff = portOffsets(fromIds.map((x) => `a:${x.actionId}`), mid, o.h).get(`a:${c.actionId}`) ?? 0;
      const aOff = portOffsets(toIds.map((x) => `o:${x.objectiveId}`), mid, a.h).get(`o:${c.objectiveId}`) ?? 0;
      const x1 = o.x + o.w;
      const y1 = o.y + o.h / 2 + oOff;
      const x2 = a.x;
      const y2 = a.y + a.h / 2 + aOff;
      const dx = Math.max((x2 - x1) / 2, 16);
      next.push({ key: linkKey(c), c, d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` });
    }
    setLinks(next);
    setSize({ w: box.width, h: box.height });
  }, [objectives, actions, contributions]);

  useLayoutEffect(() => {
    layout();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => layout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const touches = (c: Contribution) =>
    !focus || (focus.kind === "objective" ? c.objectiveId === focus.id : c.actionId === focus.id);
  const related = new Set<string>();
  if (focus) {
    related.add(`${focus.kind === "objective" ? "o" : "a"}:${focus.id}`);
    for (const c of contributions) {
      if (!touches(c)) continue;
      related.add(`o:${c.objectiveId}`);
      related.add(`a:${c.actionId}`);
    }
  }
  const dimmed = (key: string) => !!focus && !related.has(key);
  const toggle = (f: NonNullable<Focus>) =>
    onFocus(focus && focus.kind === f.kind && focus.id === f.id ? null : f);

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={size.w}
        height={size.h}
        aria-hidden="true"
      >
        {links.map(({ key, d, c }) => {
          const on = touches(c);
          return (
            <path
              key={key}
              d={d}
              fill="none"
              className="stroke-ink transition-[stroke-opacity] duration-200"
              strokeWidth={0.5 + Math.min(Math.max(c.weight, 0), 1) * 3.5}
              strokeOpacity={on ? (focus ? 0.45 : 0.15) + c.confidence * 0.5 : 0.04}
              strokeDasharray={isLessSure(c) ? "4 4" : undefined}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_96px_minmax(0,1.15fr)]">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-faint">Goals</div>
        <div />
        <div className="mb-2 text-[11px] uppercase tracking-wider text-faint">Channels</div>

        <div className="flex flex-col justify-around gap-3 py-6">
          {objectives.map((o) => (
            <ObjectiveNode
              key={o.id}
              objective={o}
              nodeRef={setNode(`o:${o.id}`)}
              onClick={() => toggle({ kind: "objective", id: o.id })}
              selected={focus?.kind === "objective" && focus.id === o.id}
              dimmed={dimmed(`o:${o.id}`)}
            />
          ))}
        </div>
        <div />
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <ActionNode
              key={a.id}
              action={a}
              verdict={verdictOf(a, minTestWeeks)}
              nodeRef={setNode(`a:${a.id}`)}
              onClick={() => toggle({ kind: "action", id: a.id })}
              selected={focus?.kind === "action" && focus.id === a.id}
              dimmed={dimmed(`a:${a.id}`)}
            />
          ))}
                  </div>
      </div>
    </div>
  );
}

export function MapLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span>Each line means a channel helps a goal.</span>
      <svg width="34" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="15" y2="5" className="stroke-ink" strokeOpacity={0.5} strokeWidth={1} />
        <line x1="19" y1="5" x2="33" y2="5" className="stroke-ink" strokeOpacity={0.5} strokeWidth={3.5} />
      </svg>
      <span>Thicker line = more <Term k="attribution">credit</Term>.</span>
      <svg width="24" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="23" y2="5" className="stroke-ink" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" />
      </svg>
      <span>Dashed = less sure. Click a goal or channel to follow its lines.</span>
    </p>
  );
}
