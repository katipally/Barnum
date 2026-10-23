import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cx } from "@/components/ui";

// Labelled form controls with inline hint and error text.

export const CONTROL =
  "w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:ring-1 focus:ring-accent/30";

export function controlClass(error?: string) {
  return cx(CONTROL, error ? "border-bad/60" : "border-line-strong");
}

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-faint">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string; prefix?: string; suffix?: string };

export function TextInput({ id, error, prefix, suffix, className, ...rest }: InputProps) {
  const input = (
    <input
      id={id}
      name={id}
      aria-invalid={!!error || undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cx(controlClass(error), prefix && "pl-7", suffix && "pr-8", className)}
      {...rest}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="relative">
      {prefix && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-faint">{prefix}</span>}
      {input}
      {suffix && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-faint">{suffix}</span>}
    </div>
  );
}

export function SelectInput({ id, error, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { id: string; error?: string }) {
  return (
    <select
      id={id}
      name={id}
      aria-invalid={!!error || undefined}
      className={cx(controlClass(error), "appearance-none", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function FormSection({ step, title, description, children }: { step: number; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${step}`} className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-muted tabular">
          {step}
        </span>
        <div>
          <h2 id={`step-${step}`} className="text-[15px] font-medium text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-5 sm:pl-9">{children}</div>
    </section>
  );
}
