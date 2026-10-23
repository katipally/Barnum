"use client";

// Module-level tour state so the tour survives the launcher remounting during route changes.
import { useSyncExternalStore } from "react";

export interface TourState {
  active: boolean;
  index: number;
}

const INACTIVE: TourState = { active: false, index: 0 };
let state: TourState = INACTIVE;
const listeners = new Set<() => void>();

function set(next: TourState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useTourState(): TourState {
  return useSyncExternalStore(subscribe, () => state, () => INACTIVE);
}

export const tour = {
  start: (index = 0) => set({ active: true, index }),
  go: (index: number) => set({ ...state, index }),
  exit: () => set(INACTIVE),
};
