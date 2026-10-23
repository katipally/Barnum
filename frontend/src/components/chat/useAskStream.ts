"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CaseId } from "@/lib/types";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  status?: "streaming" | "done" | "error";
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
      setBusy(true);
      setMessages((ms) => [
        ...ms,
        { id: userId, role: "user", text: question },
        { id: agentId, role: "agent", text: "", status: "streaming" },
      ]);
      try {
        await api.ask(caseId, question, (chunk) => patch(agentId, (m) => ({ ...m, text: m.text + chunk })));
        patch(agentId, (m) => ({ ...m, status: "done" }));
      } catch {
        patch(agentId, (m) => ({ ...m, status: "error" }));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [busy, caseId, patch],
  );

  return { messages, busy, send };
}
