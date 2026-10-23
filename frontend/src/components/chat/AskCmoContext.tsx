"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Open the drawer from anywhere without importing React context: dispatch this on `document`,
// optionally with `detail: { question }` to ask straight away (used by the demo tour).
export const ASK_CMO_EVENT = "ask-cmo:open";

interface AskRequest {
  question: string;
  n: number;
}

interface AskCmoValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  ask: (question: string) => void;
  request: AskRequest | null;
  clearRequest: () => void;
}

const AskCmoContext = createContext<AskCmoValue | null>(null);

export function useAskCmo() {
  const ctx = useContext(AskCmoContext);
  if (!ctx) throw new Error("useAskCmo must be used inside AskCmoProvider");
  return ctx;
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function AskCmoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [request, setRequest] = useState<AskRequest | null>(null);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const clearRequest = useCallback(() => setRequest(null), []);
  const ask = useCallback((question: string) => {
    setOpen(true);
    setRequest((r) => ({ question, n: (r?.n ?? 0) + 1 }));
  }, []);

  // "/" opens the drawer unless the user is typing; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onEvent = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string } | undefined>).detail?.question;
      if (q) ask(q);
      else setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener(ASK_CMO_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener(ASK_CMO_EVENT, onEvent);
    };
  }, [ask]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle, ask, request, clearRequest }),
    [isOpen, open, close, toggle, ask, request, clearRequest],
  );
  return <AskCmoContext.Provider value={value}>{children}</AskCmoContext.Provider>;
}
