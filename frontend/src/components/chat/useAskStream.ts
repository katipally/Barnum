"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AskEvent, CaseId } from "@/lib/types";
import { type AskStep, nextSteps } from "./askSteps";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  status?: "streaming" | "done" | "error";
  steps?: AskStep[];
  startedAt?: number;
  endedAt?: number;
}

// Transcript for one case. Mount with key={caseId} so switching case starts a fresh conversation.
export function useAskStream(caseId: CaseId) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = useCallback((id: number, fn: (m: ChatMessage) => ChatMessage) => {
    if (!alive.current) return;
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      const userId = nextId.current++;
      const agentId = nextId.current++;
      const now = Date.now();
      setBusy(true);
      setMessages((ms) => [
        ...ms,
        { id: userId, role: "user", text: question },
        {
          id: agentId,
          role: "agent",
          text: "",
          status: "streaming",
          startedAt: now,
          steps: [{ label: "Thinking", startedAt: now, thinking: true }],
        },
      ]);
      const onEvent = (e: AskEvent) =>
        patch(agentId, (m) => {
          const at = Date.now();
          const steps = nextSteps(m.steps ?? [], e, at);
          if (e.type === "text") return { ...m, steps, text: m.text + e.text };
          if (e.type === "error") return { ...m, steps, status: "error", endedAt: at };
          if (e.type === "done") return { ...m, steps, status: m.status === "error" ? "error" : "done", endedAt: at };
          return { ...m, steps };
        });
      const cutOff = (m: ChatMessage): ChatMessage => {
        const at = Date.now();
        return { ...m, status: "error", endedAt: at, steps: nextSteps(m.steps ?? [], { type: "done" }, at) };
      };
      try {
        await api.ask(caseId, question, onEvent);
        patch(agentId, (m) => (m.status === "streaming" ? cutOff(m) : m));
      } catch {
        patch(agentId, cutOff);
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [busy, caseId, patch],
  );

  // Drops a failed exchange and asks the same question again.
  const retry = useCallback(
    (agentId: number) => {
      const question = messages.find((m) => m.id === agentId - 1)?.text;
      if (!question || busy) return;
      setMessages((ms) => ms.filter((m) => m.id !== agentId && m.id !== agentId - 1));
      void send(question);
    },
    [messages, busy, send],
  );

  return { messages, busy, send, retry };
}
