"use client";

import { Button, StatusLabel } from "@/components/ui";
import type { Status } from "@/lib/types";

export interface SaveResult {
  overall: Status;
  previous: Status;
  count: number;
}

export function SaveBar({
  changes,
  invalid,
  saving,
  error,
  saved,
  showStatus = true,
  onSave,
  onReset,
}: {
  changes: number;
  invalid: boolean;
  saving: boolean;
  error: string | null;
  saved: SaveResult | null;
  showStatus?: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface-2/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur">
      <div className="min-w-0 text-sm" aria-live="polite">
        {error ? (
          <span className="text-bad">Could not save: {error}</span>
        ) : changes > 0 ? (
          <span className={invalid ? "text-bad" : "text-ink"}>
            {changes === 1 ? "1 unsaved change" : `${changes} unsaved changes`}
            {invalid && " · fix the highlighted fields first"}
          </span>
        ) : saved && !showStatus ? (
          <span className="text-muted">
            Saved {saved.count === 1 ? "1 change" : `${saved.count} changes`}. I&apos;ll plan against these settings.
          </span>
        ) : saved ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
            Saved {saved.count === 1 ? "1 change" : `${saved.count} changes`}. I&apos;ve updated the plan; overall we&apos;re now
            <StatusLabel status={saved.overall} />
            {saved.previous !== saved.overall && <span className="text-faint">(was <StatusLabel status={saved.previous} />)</span>}
          </span>
        ) : (
          <span className="text-faint">No changes. I&apos;m working to these settings.</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" onClick={onReset} disabled={changes === 0 || saving}>
          Reset
        </Button>
        <Button variant="primary" onClick={onSave} disabled={changes === 0 || invalid || saving}>
          {saving ? "Saving" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
