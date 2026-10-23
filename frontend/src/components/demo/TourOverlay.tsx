"use client";

// Spotlight overlay: dims the page, cuts a hole around the anchor and places the step card next to it.
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import type { TourStep } from "./steps";

const PAD = 8; // space between element and spotlight edge
const GAP = 14; // space between spotlight and card
const EDGE = 16; // viewport gutter
const CARD_W = 360;
const WAIT_MS = 3000;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  step: TourStep;
  index: number;
  total: number;
  arrived: boolean; // URL matches the step's route and company
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function TourOverlay({ step, index, total, arrived, onBack, onNext, onExit }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState({ w: 1280, h: 800 });
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);

  // One rAF loop per step: poll for the anchor (≤ 3 s), scroll it into view once, then track its rect
  // so the spotlight follows scrolling, resizing and late-loading content.
  useEffect(() => {
    let raf = 0;
    let last: Box | null = null;
    let lastMissing = false;
    let scrolled = false;
    const started = performance.now();
    const selector = `[data-tour="${step.anchor}"]`;

    const tick = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setView((v) => (v.w === vw && v.h === vh ? v : { w: vw, h: vh }));
      const ch = cardRef.current?.offsetHeight;
      if (ch) setCardH((h) => (h === ch ? h : ch));

      const el = arrived ? document.querySelector<HTMLElement>(selector) : null;
      let next: Box | null = null;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          const tall = el.offsetHeight > vh * 0.7;
          el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" });
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) next = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
      if (!sameBox(last, next)) {
        last = next;
        setBox(next);
      }
      const isMissing = arrived && !next && performance.now() - started > WAIT_MS;
      if (isMissing !== lastMissing) {
        lastMissing = isMissing;
        setMissing(isMissing);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.anchor, arrived, index]);

  // Arrow keys and Escape; leave typing in inputs alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onNext, onExit]);

  const hole = box && {
    top: box.top - PAD,
    left: box.left - PAD,
    width: box.width + PAD * 2,
    height: box.height + PAD * 2,
  };

  const cardW = Math.min(CARD_W, view.w - EDGE * 2);
  let cardTop: number;
  let cardLeft: number;
  if (!hole) {
    cardTop = Math.max(EDGE, (view.h - cardH) / 2);
    cardLeft = (view.w - cardW) / 2;
  } else {
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - cardH;
    if (below + cardH <= view.h - EDGE) cardTop = below;
    else if (above >= EDGE) cardTop = above;
    else cardTop = view.h - cardH - EDGE; // element fills the screen: pin card to the bottom
    cardLeft = Math.min(Math.max(hole.left, EDGE), view.w - cardW - EDGE);
  }

  const last = index === total - 1;
  const loading = !box && !missing;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000]" aria-live="polite">
      {/* Dim layer with a cut-out. Purely visual: the page stays clickable so the presenter can interact. */}
      {hole ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-1 ring-gold/60 motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(5, 6, 6, 0.72)",
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-[rgba(5,6,6,0.72)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Tour step ${index + 1} of ${total}: ${step.title}`}
        className="pointer-events-auto fixed rounded-xl border border-t-2 border-line-strong border-t-gold bg-surface-2 p-4 shadow-2xl shadow-black/50 motion-safe:transition-[top,left] motion-safe:duration-300"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium tracking-wide text-gold tabular">
            Tour · {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="rounded px-1.5 text-xs text-faint hover:bg-surface-3 hover:text-ink"
            aria-label="Exit tour"
          >
            Exit
          </button>
        </div>
        <h3 className="text-[15px] font-medium text-ink">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
        {missing && (
          <p className="mt-2 text-xs text-faint">This section is not on screen right now. Carry on with Next.</p>
        )}
        {loading && <p className="mt-2 text-xs text-faint">Opening…</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cx("h-1 w-2 rounded-full", i <= index ? "bg-gold" : "bg-line-strong")} />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={index === 0}
              className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-surface-3 hover:text-ink disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-bg transition hover:bg-gold/90"
            >
              {last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
