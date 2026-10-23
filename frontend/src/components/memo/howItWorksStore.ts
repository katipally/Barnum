"use client";

import { useSyncExternalStore } from "react";

// Whether the "How this works" card on the home page is shown. Dismissal survives reloads via localStorage.
const KEY = "cmo:how-it-works-dismissed";
const listeners = new Set<() => void>();
let visible: boolean | null = null;

function read(): boolean {
  if (visible === null) {
    try {
      visible = localStorage.getItem(KEY) !== "1";
    } catch {
      visible = true;
    }
  }
  return visible;
}

function set(next: boolean) {
  visible = next;
  try {
    if (next) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "1");
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const howItWorks = {
  show: () => set(true),
  dismiss: () => set(false),
};

export function useHowItWorksVisible(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
