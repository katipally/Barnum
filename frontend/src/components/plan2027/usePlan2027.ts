"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CaseId, PlanEvent, PlanInputs, SavedPlan } from "@/lib/types";
import { type AskStep, nextSteps } from "@/components/chat/askSteps";
import { applyEvent, emptyView, fromSaved, type PlanView } from "./plan";

export interface PlanRun {
  status: "running" | "done" | "error";
  steps: AskStep[];
  startedAt: number;
  endedAt?: number;
  model?: string;
  error?: string;
}

function stepRun(r: PlanRun, e: PlanEvent, now: number): PlanRun {
  switch (e.type) {
    case "meta":
      return { ...r, model: e.model };
    case "error":
      return { ...r, status: "error", error: e.message, endedAt: now, steps: nextSteps(r.steps, e, now) };
    case "done":
      return { ...r, status: r.status === "error" ? "error" : "done", endedAt: r.endedAt ?? now, steps: nextSteps(r.steps, e, now) };
    case "status":
    case "tool":
    case "tool_done":
      return { ...r, steps: nextSteps(r.steps, e, now) };
    default:
      return r;
  }
}

// The plan on screen plus the live run that builds it. Mount with a key so each company starts fresh.
export function usePlan2027(caseId: CaseId, saved: SavedPlan | null) {
  const [view, setView] = useState<PlanView | null>(saved ? fromSaved(saved) : null);
  const [run, setRun] = useState<PlanRun | null>(null);
  const last = useRef<PlanInputs | null>(null);
  const running = run?.status === "running";

  const start = useCallback(
    async (inputs: PlanInputs) => {
      last.current = inputs;
      const startedAt = Date.now();
      setView(emptyView);
      setRun({ status: "running", startedAt, steps: [{ label: "Thinking", startedAt, thinking: true }] });
      const onEvent = (e: PlanEvent) => {
        setView((v) => applyEvent(v ?? emptyView, e));
        setRun((r) => r && stepRun(r, e, Date.now()));
      };
      try {
        await api.runPlan2027(caseId, inputs, onEvent);
        setRun((r) => (r?.status === "running" ? stepRun(r, { type: "done" }, Date.now()) : r));
      } catch (e) {
        setRun((r) => r && stepRun(r, { type: "error", message: e instanceof Error ? e.message : "unknown error" }, Date.now()));
      }
    },
    [caseId],
  );

  const retry = useCallback(() => {
    if (last.current) void start(last.current);
  }, [start]);

  return { view, run, running, start, retry };
}
