"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { useCaseId } from "@/lib/case";
import { useCases } from "@/components/shell/useCases";
import { useAskCmo } from "./AskCmoContext";
import { ChatPanel } from "./ChatPanel";

// Right-hand panel. Stays mounted while closed so the transcript survives; resets per case via key.
export function AskDrawer() {
  const { isOpen, close } = useAskCmo();
  const caseId = useCaseId();
  const cases = useCases();
  const caseName = cases?.find((c) => c.id === caseId)?.name;
  const [conversation, setConversation] = useState(0);

  return (
    <>
      <div
        aria-hidden
        onClick={close}
        className={cx(
          "fixed inset-0 z-40 bg-black/50 transition-opacity min-[900px]:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        id="ask-cmo-drawer"
        role="dialog"
        aria-label="Ask Barnum"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cx(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-2xl shadow-black/60 transition-transform duration-200 sm:w-[420px]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-medium text-ink">Ask Barnum</h2>
            <p className="text-xs text-faint">{caseName ? `Talking about ${caseName}` : "Your marketing agent"}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-3 hover:text-ink"
          >
            Close <kbd className="ml-1 font-mono text-[11px] text-faint">Esc</kbd>
          </button>
        </header>
        <ChatPanel key={`${caseId}-${conversation}`} caseId={caseId} caseName={caseName} onNew={() => setConversation((n) => n + 1)} />
      </aside>
    </>
  );
}
