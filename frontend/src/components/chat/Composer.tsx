"use client";

import { forwardRef, useState } from "react";
import { Button } from "@/components/ui";

export const Composer = forwardRef<HTMLTextAreaElement, { onSend: (q: string) => void; busy: boolean; inputId?: string; placeholder?: string }>(
  function Composer({ onSend, busy, inputId = "ask-cmo-input", placeholder }, ref) {
    const [value, setValue] = useState("");
    const submit = () => {
      if (!value.trim() || busy) return;
      onSend(value);
      setValue("");
    };
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface-2 p-1.5 focus-within:border-ink/30"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask Barnum
        </label>
        <textarea
          id={inputId}
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Ask anything, e.g. where is the money working best?"}
          className="max-h-32 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-faint [field-sizing:content]"
        />
        <Button type="submit" variant="primary" disabled={busy || !value.trim()}>
          {busy ? "Answering" : "Send"}
        </Button>
      </form>
    );
  },
);
