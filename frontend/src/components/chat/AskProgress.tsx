"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import type { AskStep } from "./askSteps";

const seconds = (ms: number) => `${Math.max(0, Math.round(ms / 1000))}s`;

// Live list while the agent works; collapses to a one-line summary (expandable) once the answer is in.
export function AskProgress({ steps, startedAt, endedAt, failed }: { steps: AskStep[]; startedAt: number; endedAt?: number; failed?: boolean }) {
  const live = endedAt === undefined;
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  const tools = steps.filter((s) => !s.thinking).length;
  const open = live || expanded;
  if (!live && tools === 0) return null;

  const total = seconds((endedAt ?? now) - startedAt);
  const summary = live
    ? `Working, ${total}`
    : `${failed ? "Stopped after" : "Worked for"} ${total}${tools ? ` · ${tools} ${tools === 1 ? "step" : "steps"}` : ""}`;

  return (
    <div className="mb-2.5 text-xs text-muted" aria-live="off">
      {live ? (
        <p className="tabular-nums">{summary}</p>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 rounded text-left tabular-nums transition hover:text-ink"
        >
          <span aria-hidden className={cx("inline-block transition-transform", expanded && "rotate-90")}>
            ›
          </span>
          {summary}
        </button>
      )}
      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-line pl-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              {s.endedAt ? (
                <span aria-hidden className="w-3 shrink-0 text-center text-ok">
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden
                  className="mt-[3px] h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-gold/30 border-t-gold motion-reduce:animate-pulse"
                />
              )}
              <span className={cx("min-w-0 flex-1 break-words", s.endedAt ? "text-muted" : "text-ink/90")}>{s.label}</span>
              <span className="shrink-0 tabular-nums text-faint">{seconds((s.endedAt ?? now) - s.startedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
