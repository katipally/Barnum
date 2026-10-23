"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AskEvent, CaseId, DeepDiveMessage } from "@/lib/types";
import { type AskStep, nextSteps } from "./askSteps";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  status?: "streaming" | "done" | "error";
  model?: string;
  steps?: AskStep[];
  startedAt?: number;
  endedAt?: number;
}

export const fromDeepDive = (ms: DeepDiveMessage[]): ChatMessage[] =>
  ms.map((m, i) => ({ id: i + 1, role: m.role, text: m.text, status: "done" }));

interface Options {
  deepDiveId?: string | null; // continue this deep dive; otherwise one is created on the first question
  initial?: ChatMessage[];
  onSaved?: (deepDiveId: string) => void; // after each answer is stored
}

// Transcript for one conversation, saved as a deep dive. Mount with a key so a new conversation starts fresh.
export function useAskStream(caseId: CaseId, opts: Options = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(opts.initial ?? []);
  const [busy, setBusy] = useState(false);
  const [deepDiveId, setDeepDiveId] = useState<string | null>(opts.deepDiveId ?? null);
  const ddRef = useRef<string | null>(opts.deepDiveId ?? null);
  const nextId = useRef((opts.initial?.length ?? 0) + 1);
  const alive = useRef(true);
  const onSaved = useRef(opts.onSaved);

  useEffect(() => {
    onSaved.current = opts.onSaved;
  });

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
          if (e.type === "meta") return { ...m, model: e.model };
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
        if (!ddRef.current) {
          ddRef.current = (await api.createDeepDive(caseId, question)).id;
          if (alive.current) setDeepDiveId(ddRef.current);
        }
        const id = ddRef.current;
        await api.ask(caseId, question, onEvent, id);
        patch(agentId, (m) => (m.status === "streaming" ? cutOff(m) : m));
        onSaved.current?.(id);
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

  return { messages, busy, send, retry, deepDiveId };
}
