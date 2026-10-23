"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { withCase } from "@/lib/case";
import type { CaseId } from "@/lib/types";
import { useAskCmo } from "./AskCmoContext";
import { ChatBubble } from "./ChatBubble";
import { Composer } from "./Composer";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { suggestionsFor } from "./suggestions";
import { useAskStream } from "./useAskStream";

// Transcript + input for one conversation; the drawer remounts it per case or when a new conversation starts.
export function ChatPanel({ caseId, caseName, onNew }: { caseId: CaseId; caseName?: string; onNew?: () => void }) {
  const { isOpen, request, clearRequest } = useAskCmo();
  const { messages, busy, send, deepDiveId } = useAskStream(caseId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const remaining = suggestionsFor(caseId).filter((q) => !asked.has(q));

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Questions asked from elsewhere in the app (useAskCmo().ask or the ask-cmo:open event).
  useEffect(() => {
    if (!request || busy) return;
    clearRequest();
    void send(request.question);
  }, [request, busy, clearRequest, send]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-accent">
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-accent" />
              CMO agent
            </div>
            <p className="text-sm leading-relaxed text-ink/90">
              Ask me anything in plain words{caseName ? ` about ${caseName}` : ""}: why I made a call, what would happen if we
              spent more, or how we&apos;re doing against the goal. I answer from this week&apos;s numbers.
            </p>
            <SuggestedQuestions className="mt-4" questions={remaining} onPick={send} disabled={busy} />
          </div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} message={m} />)
        )}
      </div>
      <div className="space-y-2.5 border-t border-line px-5 py-4">
        {deepDiveId && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <Link href={withCase(`/deep-dives?dd=${deepDiveId}`, caseId)} className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Saved in Deep dives
            </Link>
            {onNew && (
              <button type="button" onClick={onNew} disabled={busy} className="text-muted transition hover:text-ink disabled:opacity-50">
                New conversation
              </button>
            )}
          </div>
        )}
        {messages.length > 0 && <SuggestedQuestions questions={remaining} onPick={send} disabled={busy} />}
        <Composer ref={inputRef} onSend={send} busy={busy} />
        <p className="text-[11px] leading-snug text-faint">
          Every number comes straight from your data. When I&apos;m guessing, I say so.
        </p>
      </div>
    </div>
  );
}
