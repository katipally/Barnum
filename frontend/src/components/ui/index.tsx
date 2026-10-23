// Shared primitives. Keep this file small; feature components live in their own folders.
import type { ReactNode } from "react";
import type { Status, Verdict } from "@/lib/types";
import { STATUS_DOT, STATUS_LABEL, STATUS_TEXT, VERDICT_STYLE } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("panel p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-normal text-ink">{children}</h2>
      {hint && <span className="chip">{hint}</span>}
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
    <span className={cx("rounded-md border bg-surface-3 px-2 py-0.5 text-[11px] capitalize", VERDICT_STYLE[verdict])}>{verdict}</span>
  );
}

export function Button({
  children,
  variant = "secondary",
  className,
  ...rest
}: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-accent font-medium text-accent-ink shadow-[0_8px_24px_-10px_rgba(139,109,255,0.8)] hover:bg-accent/90",
    secondary: "border border-line-strong bg-white/[0.02] text-ink hover:bg-surface-3",
    ghost: "text-muted hover:text-ink hover:bg-surface-3",
  }[variant];
  return (
    <button className={cx("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition disabled:opacity-50", styles, className)} {...rest}>
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{message}</p>;
}

// Status as a small tinted pill with a ring dot, like a delta badge.
export function StatusPill({ status, children }: { status: Status; children?: ReactNode }) {
  const tone = { on_track: "bg-ok/10 text-ok", at_risk: "bg-warn/10 text-warn", off_track: "bg-bad/10 text-bad" }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs", tone)}>
      <span className="grid h-3 w-3 place-items-center rounded-full bg-current/20">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

// Oversized light number; the tail after the decimal point and the unit are dimmed.
export function BigNumber({ value, className }: { value: string; className?: string }) {
  const m = value.match(/^(.*?\d)((?:[.,]\d+)?)(\D*)$/);
  const [head, tail, unit] = m ? [m[1], m[2], m[3]] : [value, "", ""];
  return (
    <span className={cx("num-display", className)}>
      {head}
      {tail && <span className="text-ink/45">{tail}</span>}
      {unit && <span className="text-ink/45">{unit}</span>}
    </span>
  );
}
