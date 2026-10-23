"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { CaseSummary } from "@/lib/types";

// One shared company list for the switcher, drawer and manage page; refreshCases() after create/delete.
interface CasesState {
  cases: CaseSummary[] | null;
  error: string | null;
}

const EMPTY: CasesState = { cases: null, error: null };
let state: CasesState = EMPTY;
let pending: Promise<CaseSummary[]> | null = null;
let generation = 0; // only the latest request may write, so a stale response can't undo a refresh
const listeners = new Set<() => void>();

function set(next: CasesState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function load(): Promise<CaseSummary[]> {
  if (pending) return pending;
  const gen = ++generation;
  pending = api
    .cases()
    .then((cases) => {
      if (gen === generation) set({ cases, error: null });
      return cases;
    })
    .catch((e: Error) => {
      if (gen === generation) {
        pending = null; // retry on the next mount
        set({ ...state, error: e.message });
      }
      throw e;
    });
  return pending;
}

export function refreshCases(): Promise<CaseSummary[]> {
  pending = null;
  return load();
}

// Optimistic local updates after create/delete, followed by a refetch that supersedes older requests.
export function rememberCase(c: CaseSummary) {
  const rest = (state.cases ?? []).filter((x) => x.id !== c.id);
  set({ ...state, cases: [...rest, c] });
  refreshCases().catch(() => {});
}

export function forgetCase(id: string) {
  if (state.cases) set({ ...state, cases: state.cases.filter((x) => x.id !== id) });
  refreshCases().catch(() => {});
}

export function useCasesState(): CasesState {
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    load().catch(() => {});
  }, []);
  return s;
}

export function useCases(): CaseSummary[] | null {
  return useCasesState().cases;
}

// Sample companies keep the shipped order; user companies come first in the order they were created.
export function splitCases(cases: CaseSummary[]) {
  return { own: cases.filter((c) => !c.sample), samples: cases.filter((c) => c.sample) };
}
