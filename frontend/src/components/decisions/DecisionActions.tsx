"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Decision } from "@/lib/types";
import { Button, cx } from "@/components/ui";
import { useAskCmo } from "@/components/chat/AskCmoContext";
import { IconChat, IconCheck, IconSend, IconX } from "./icons";

export const NOT_NOW = "Not now";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function isDismissed(d: Pick<Decision, "status" | "note">) {
  return d.status === "rejected" && d.note === NOT_NOW;
}

export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={NOT_NOW}
      title="Not now — dismiss for this week"
      className={cx("-mr-1.5 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition hover:bg-surface-3 hover:text-ink", FOCUS)}
    >
      <IconX />
    </button>
  );
}

// Approve, discuss in chat, or answer with your own call. A custom reply goes to the agent in chat
// and leaves the decision pending so it can come back with a revised proposal.
export function DecisionActions({ decision: d, onApprove }: { decision: Decision; onApprove: () => void }) {
  const { ask } = useAskCmo();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<string | null>(null);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    ask(`Regarding "${d.title}": ${text}`);
    setReply(text);
    setDraft("");
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" className={FOCUS} onClick={onApprove}>
          Approve
        </Button>
        <Button
          className={FOCUS}
          onClick={() => ask(`About "${d.title}": why do you recommend it, and what could go wrong?`)}
        >
          <IconChat className="text-muted" />
          Discuss
        </Button>
        <form onSubmit={send} className="relative min-w-[240px] flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`Your own response to: ${d.title}`}
            placeholder="Or answer in your own words… (e.g. do half, wait two weeks)"
            className="w-full rounded-md border border-line bg-transparent py-1.5 pl-3 pr-9 text-sm text-ink transition placeholder:text-faint hover:border-line-strong focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
          <button
            type="submit"
            aria-label="Send reply"
            disabled={!draft.trim()}
            className={cx(
              "absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-gold transition hover:bg-gold-soft disabled:pointer-events-none disabled:text-faint disabled:opacity-0",
              FOCUS,
            )}
          >
            <IconSend width={14} height={14} />
          </button>
        </form>
      </div>
      {reply && (
        <p className="mt-2.5 text-xs text-muted" aria-live="polite">
          <span className="text-faint">You replied:</span> {reply}
        </p>
      )}
    </div>
  );
}

// What a card collapses to once settled.
export function DecidedLine({ title, status }: { title: string; status: "approved" | "rejected" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const approved = status === "approved";
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={cx(
        "flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm outline-none",
        approved ? "bg-surface" : "bg-transparent",
      )}
    >
      {approved ? <IconCheck className="shrink-0 text-ok" /> : <IconX className="shrink-0 text-faint" />}
      <span className={cx("shrink-0", approved ? "text-ok" : "text-faint")}>{approved ? "Approved" : "Dismissed for this week"}</span>
      <span className="text-faint">—</span>
      <span className={cx("min-w-0 truncate", approved ? "text-muted" : "text-faint")}>{title}</span>
    </div>
  );
}
