import type { ReactNode } from "react";
import { Card, SectionTitle } from "@/components/ui";

export function SteeringBlock({
  title,
  hint,
  intro,
  children,
}: {
  title: string;
  hint?: ReactNode;
  intro: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <SectionTitle hint={hint}>{title}</SectionTitle>
      <p className="-mt-1 mb-5 max-w-2xl text-sm text-muted">{intro}</p>
      {children}
    </Card>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-bad">
      {message}
    </p>
  );
}

export function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
      <rect x="2" y="5.25" width="8" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.25V3.75a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
