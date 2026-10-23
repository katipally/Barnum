"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { FieldError } from "./SteeringBlock";

export function SliderField({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  explanation,
  error,
  changed,
  scale,
}: {
  id: string;
  label: ReactNode;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  explanation?: ReactNode;
  error?: string;
  changed?: boolean;
  scale?: [string, string];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
        <span className={cx("tabular text-sm", changed ? "text-ink" : "text-muted")}>
          {display}
          {changed && <span className="ml-1.5 text-[11px] text-faint">edited</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : explanation ? `${id}-help` : undefined}
        className="h-1.5 w-full cursor-pointer accent-ink"
      />
      {scale && (
        <div className="mt-1 flex justify-between text-[11px] text-faint tabular">
          <span>{scale[0]}</span>
          <span>{scale[1]}</span>
        </div>
      )}
      {explanation && (
        <p id={`${id}-help`} className="mt-2 text-sm text-muted">
          {explanation}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
