"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

const TIP_WIDTH = 256; // w-64

// A jargon word with a dotted underline; hover, focus or tap shows a one-line plain explanation.
export function Term({ k, children, explain }: { k?: GlossaryKey; children?: ReactNode; explain?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const entry = k ? GLOSSARY[k] : undefined;
  const text = explain ?? entry?.short;
  if (!text) return <>{children}</>;
  // Near the right edge the tooltip opens leftwards so it never widens the page.
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left + TIP_WIDTH + 16 > window.innerWidth);
    setOpen(true);
  };
  return (
    <span className="relative inline">
      <button
        ref={btn}
        type="button"
        aria-describedby={id}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
        className="cursor-help underline decoration-dotted decoration-muted/60 underline-offset-[3px] focus:outline-none focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-accent/60"
      >
        {children ?? entry?.term}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-50 mb-2 w-64 rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-lg ${alignRight ? "right-0" : "left-0"} ${open ? "block" : "hidden"}`}
      >
        {entry && <span className="mb-0.5 block font-medium text-accent">{entry.term}</span>}
        {text}
      </span>
    </span>
  );
}
