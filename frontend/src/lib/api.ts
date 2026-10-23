"use client";

// Typed client for the server layer. UI code talks to the backend only through these functions.
import { useCallback, useEffect, useState } from "react";
import type {
  AskEvent,
  CaseId,
  CaseSummary,
  CompanyInput,
  Decision,
  Metric,
  StrategyMap,
  SteeringUpdate,
  WeeklyBrief,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  cases: () => fetch("/api/companies").then(json<CaseSummary[]>),
  createCompany: (input: CompanyInput) =>
    fetch("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then(json<CaseSummary>),
  deleteCompany: (c: CaseId) => fetch(`/api/companies/${c}`, { method: "DELETE" }).then(json<{ ok: true }>),
  brief: (c: CaseId) => fetch(`/api/companies/${c}/brief`).then(json<WeeklyBrief>),
  strategy: (c: CaseId) => fetch(`/api/companies/${c}/strategy`).then(json<StrategyMap>),
  metrics: (c: CaseId) => fetch(`/api/companies/${c}/metrics`).then(json<Metric[]>),
  decide: (c: CaseId, id: string, status: "approved" | "rejected", note?: string) =>
    fetch(`/api/companies/${c}/decisions/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note }),
    }).then(json<Decision>),
  steer: (c: CaseId, update: SteeringUpdate) =>
    fetch(`/api/companies/${c}/steering`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    }).then(json<WeeklyBrief>),
  // Streams the CMO agent's work and answer as events (NDJSON).
  ask: async (c: CaseId, question: string, onEvent: (e: AskEvent) => void) => {
    const res = await fetch(`/api/companies/${c}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok || !res.body) throw new Error(`${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const flush = (line: string) => {
      if (line.trim()) onEvent(JSON.parse(line) as AskEvent);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        flush(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    flush(buf);
  },
};

// Minimal data hook: refetches when deps change; `reload` after mutations.
export function useApi<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    fn()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(load, [load]);
  return { data, error, loading, reload: load, setData };
}
