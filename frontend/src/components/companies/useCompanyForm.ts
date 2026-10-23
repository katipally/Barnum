"use client";

import { useMemo, useState } from "react";
import { STAGES, initialValues, validate, type FieldName, type FormValues, type Stage } from "./formModel";

// Form state with inline validation: a field shows its error after blur or after a submit attempt.
export function useCompanyForm() {
  const [values, setValues] = useState<FormValues>(() => initialValues());
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [labelEdited, setLabelEdited] = useState(false);
  const errors = useMemo(() => validate(values), [values]);

  const set = <K extends FieldName>(k: K, val: FormValues[K]) => {
    if (k === "goalLabel") setLabelEdited(true);
    setValues((v) => ({ ...v, [k]: val }));
  };

  // Picking a stage pre-fills the goal name until the user types their own.
  const setStage = (s: Stage) => {
    setValues((v) => ({
      ...v,
      stage: s,
      goalLabel: labelEdited && v.goalLabel.trim() ? v.goalLabel : (STAGES.find((x) => x.id === s)?.goalLabel ?? v.goalLabel),
    }));
    setTouched((t) => ({ ...t, stage: true }));
  };

  const error = (k: FieldName) => (submitted || touched[k] ? errors[k] : undefined);
  const blur = (k: FieldName) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  // Returns true when valid; otherwise reveals all errors and focuses the first invalid field.
  const attempt = () => {
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (!first) return true;
    const el = document.querySelector<HTMLElement>(first === "stage" ? 'input[name="stage"]' : `#${first}`);
    el?.focus();
    return false;
  };

  return { values, set, setStage, error, blur, attempt };
}

export type CompanyForm = ReturnType<typeof useCompanyForm>;
