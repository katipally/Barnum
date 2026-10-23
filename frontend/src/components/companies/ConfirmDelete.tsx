"use client";

import { useEffect, useRef } from "react";
import { Button, ErrorNote } from "@/components/ui";

// Modal confirm for deleting a company; native <dialog> handles focus and Escape.
export function ConfirmDelete({
  name,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => e.target === ref.current && !busy && onCancel()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface-2 p-5 text-ink shadow-2xl shadow-black/50 backdrop:bg-black/60"
    >
      <h2 id="delete-title" className="text-[15px] font-medium">
        Delete {name}?
      </h2>
      <p className="mt-1.5 text-sm text-muted">This removes its goals, plan and history. It can&apos;t be undone.</p>
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center rounded-md border border-bad/50 px-3 py-1.5 text-sm text-bad transition hover:bg-bad/10 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </dialog>
  );
}
