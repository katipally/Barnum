// Shared primitives. Keep this file small; feature components live in their own folders.
import type { ReactNode } from "react";
import type { Status, Verdict } from "@/lib/types";
import { STATUS_DOT, STATUS_LABEL, STATUS_TEXT, VERDICT_STYLE } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-medium tracking-wide text-muted">{children}</h2>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cx("inline-block h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status], className)} />;
}

export function StatusLabel({ status }: { status: Status }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs", STATUS_TEXT[status])}>
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  return (
    <span className={cx("rounded border px-1.5 py-0.5 text-[11px] capitalize", VERDICT_STYLE[verdict])}>{verdict}</span>
  );
}

export function Button({
  children,
  variant = "secondary",
  className,
  ...rest
}: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-gold text-bg hover:bg-gold/90",
    secondary: "border border-line-strong text-ink hover:bg-surface-3",
    ghost: "text-muted hover:text-ink hover:bg-surface-3",
  }[variant];
  return (
    <button className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition disabled:opacity-50", styles, className)} {...rest}>
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{message}</p>;
}
