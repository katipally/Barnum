"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CaseId, DeepDive, DeepDiveArtifact } from "@/lib/types";
import { Button, ErrorNote, Skeleton } from "@/components/ui";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { Composer } from "@/components/chat/Composer";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { fromDeepDive, useAskStream, type ChatMessage } from "@/components/chat/useAskStream";
import { ArtifactCard } from "./ArtifactCard";

interface Props {
  caseId: CaseId;
  deepDiveId: string | null; // null: a new deep dive, created on the first question
  starters: string[];
  onSaved: (id: string) => void;
  onDeleted: () => void;
}

// One deep dive: its write-up on top, then the conversation and a box to keep pushing back.
export function DeepDiveThread({ caseId, deepDiveId, starters, onSaved, onDeleted }: Props) {
  const [dd, setDd] = useState<DeepDive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deepDiveId) return;
    api.deepDive(caseId, deepDiveId).then(setDd, (e: Error) => setError(e.message));
  }, [caseId, deepDiveId]);

  if (error) return <ErrorNote message={`Could not open this deep dive. ${error}`} />;
  if (deepDiveId && !dd) return <Skeleton className="h-96" />;
  return (
    <ThreadBody
      caseId={caseId}
      initial={dd}
      starters={starters}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  );
}

function ThreadBody({ caseId, initial, starters, onSaved, onDeleted }: Omit<Props, "deepDiveId"> & { initial: DeepDive | null }) {
  const [artifact, setArtifact] = useState<DeepDiveArtifact | undefined>(initial?.artifact);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const { messages, busy, send, deepDiveId } = useAskStream(caseId, {
    deepDiveId: initial?.id ?? null,
    initial: initial ? fromDeepDive(initial.messages) : [],
    onSaved,
  });

  const saved = messages.filter((m: ChatMessage) => m.status !== "error" && m.text).length;
  const stale = !!artifact && artifact.messageCount < saved;
  const canWrite = !busy && !!deepDiveId && messages.some((m) => m.role === "agent" && m.status === "done");

  useEffect(() => {
    if (messages.length) scrollEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const write = async () => {
    if (!deepDiveId) return;
    setWriting(true);
    setWriteError(null);
    try {
      setArtifact(await api.writeUp(caseId, deepDiveId));
      onSaved(deepDiveId);
    } catch (e) {
      setWriteError((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const remove = async () => {
    if (!deepDiveId) return;
    await api.deleteDeepDive(caseId, deepDiveId);
    onDeleted();
  };

  return (
    <div className="space-y-6">
      {artifact && <ArtifactCard artifact={artifact} stale={stale} />}

      <section className="rounded-xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-medium text-ink">{messages.length ? "Our conversation" : "Start a deep dive"}</h2>
          <div className="flex items-center gap-2">
            {deepDiveId &&
              (confirmDelete ? (
                <>
                  <span className="text-xs text-muted">Delete this deep dive?</span>
                  <Button variant="ghost" onClick={remove}>Delete</Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy || writing}>Delete</Button>
              ))}
            {messages.length > 0 && (!artifact || stale) && (
              <Button variant="primary" onClick={write} disabled={!canWrite || writing}>
                {writing ? "Writing it up…" : artifact ? "Update the write-up" : "Write up what we found"}
              </Button>
            )}
          </div>
        </header>
        <div className="space-y-5 px-5 py-5" aria-live="polite">
          {messages.length === 0 ? (
            <div>
              <p className="max-w-[640px] text-sm leading-relaxed text-ink/90">
                Challenge a call I made or dig into one topic. When we&apos;re done, I write up what we found, and I read that
                write-up before every later answer.
              </p>
              <SuggestedQuestions className="mt-4" questions={starters} onPick={send} disabled={busy} />
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} />)
          )}
          <div ref={scrollEnd} />
        </div>
        <div className="space-y-2 border-t border-line px-5 py-4">
          {writeError && <ErrorNote message={`Could not write this up. ${writeError}`} />}
          <Composer
            onSend={send}
            busy={busy}
            inputId="deep-dive-input"
            placeholder={messages.length ? "Push back or ask a follow-up" : "What do you want to dig into?"}
          />
        </div>
      </section>
    </div>
  );
}
