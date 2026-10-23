import { cx } from "@/components/ui";
import { STAGES, type Stage } from "./formModel";

// Three large radio cards for the company stage; the stage decides what the agent aims for first.
export function StageCards({ value, onChange, error }: { value: Stage | ""; onChange: (s: Stage) => void; error?: string }) {
  return (
    <fieldset aria-describedby={error ? "stage-error" : undefined}>
      <legend className="text-[13px] font-medium text-ink">Where is the company today?</legend>
      <p className="mb-2 mt-0.5 text-xs text-faint">This decides what I focus on first.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {STAGES.map((s) => {
          const checked = value === s.id;
          return (
            <label
              key={s.id}
              className={cx(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3.5 transition has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-gold/50",
                checked ? "border-gold/60 bg-gold-soft" : error ? "border-bad/60 hover:bg-surface-2" : "border-line-strong hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="stage"
                value={s.id}
                checked={checked}
                onChange={() => onChange(s.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span
                  aria-hidden
                  className={cx(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                    checked ? "border-gold" : "border-line-strong",
                  )}
                >
                  {checked && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                </span>
              </span>
              <span className="text-xs leading-relaxed text-muted">{s.promise}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="stage-error" className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      )}
    </fieldset>
  );
}
