import { Button, cx } from "@/components/ui";
import { AgentText } from "./AgentText";
import { AskProgress } from "./AskProgress";
import type { ChatMessage } from "./useAskStream";

export function ChatBubble({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          {message.text}
        </p>
      </div>
    );
  }

  const failed = message.status === "error";
  const empty = message.status === "done" && !message.text.trim();
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-accent">
        <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-accent" />
        CMO agent
      </div>
      {message.startedAt !== undefined && message.steps && (
        <AskProgress steps={message.steps} startedAt={message.startedAt} endedAt={message.endedAt} failed={failed} />
      )}
      <div className={cx("text-sm leading-relaxed text-ink/90", failed && "text-bad")}>
        {message.text && <AgentText text={message.text} />}
        {(failed || empty) && (
          <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2", message.text && "mt-2")}>
            <p className="min-w-0 break-words text-sm text-bad">
              {failed ? "I couldn't answer just now. Try again in a moment." : "I finished without an answer. Try asking again."}
            </p>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry} className="text-xs">
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
