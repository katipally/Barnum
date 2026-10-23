"use client";

import { useAskCmo } from "./AskCmoContext";

export function AskButton() {
  const { isOpen, toggle } = useAskCmo();
  return (
    <button
      type="button"
      data-tour="ask-cmo"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-controls="ask-cmo-drawer"
      className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold-soft px-3 py-1.5 text-sm text-gold transition hover:border-gold/70"
    >
      <span className="whitespace-nowrap">Ask the CMO</span>
      <kbd className="hidden rounded border border-gold/30 px-1 font-mono text-[11px] leading-4 text-gold/80 sm:inline">/</kbd>
    </button>
  );
}
