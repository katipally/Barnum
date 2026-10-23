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
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink shadow-[0_8px_24px_-10px_rgba(139,109,255,0.9)] transition hover:bg-accent/90"
    >
      <span className="whitespace-nowrap">Ask the CMO</span>
      <kbd className="hidden rounded border border-accent-ink/20 bg-accent-ink/10 px-1 font-mono text-[11px] leading-4 text-accent-ink/80 sm:inline">/</kbd>
    </button>
  );
}
