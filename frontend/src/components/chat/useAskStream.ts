"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CaseId, DeepDiveMessage } from "@/lib/types";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  status?: "streaming" | "done" | "error";
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
      setBusy(true);
      setMessages((ms) => [
        ...ms,
        { id: userId, role: "user", text: question },
        { id: agentId, role: "agent", text: "", status: "streaming" },
      ]);
      try {
        if (!ddRef.current) {
          ddRef.current = (await api.createDeepDive(caseId, question)).id;
          if (alive.current) setDeepDiveId(ddRef.current);
        }
        const id = ddRef.current;
        await api.ask(caseId, question, (chunk) => patch(agentId, (m) => ({ ...m, text: m.text + chunk })), id);
        patch(agentId, (m) => ({ ...m, status: "done" }));
        onSaved.current?.(id);
      } catch {
        patch(agentId, (m) => ({ ...m, status: "error" }));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [busy, caseId, patch],
  );

  return { messages, busy, send, deepDiveId };
}
