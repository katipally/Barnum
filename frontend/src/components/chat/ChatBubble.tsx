import { cx } from "@/components/ui";
import { AgentText } from "./AgentText";
import type { ChatMessage } from "./useAskStream";

export function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          {message.text}
        </p>
      </div>
    );
  }

  const waiting = message.status === "streaming" && !message.text;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-accent">
        <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-accent" />
        CMO agent
      </div>
      <div className={cx("text-sm leading-relaxed text-ink/90", message.status === "error" && "text-bad")}>
        {waiting ? (
          <span className="inline-flex items-center gap-1 text-muted" aria-label="Thinking">
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
          </span>
        ) : (
          <AgentText text={message.text} />
        )}
        {message.status === "error" && (
          <p className="mt-1 text-sm text-bad">I couldn&apos;t answer just now. Try again in a moment.</p>
        )}
      </div>
    </div>
  );
}
