import Link from "next/link";

// Lavender tile with the agent's diamond glyph + wordmark.
export function ProductMark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 text-ink" aria-label="Agentic CMO home">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-accent to-accent-strong text-accent-ink shadow-[0_8px_20px_-8px_rgba(139,109,255,0.9)]">
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
          <rect x="4" y="4" width="12" height="12" rx="2" transform="rotate(45 10 10)" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="10" cy="10" r="2.4" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium leading-5 tracking-tight">Agentic CMO</span>
        <span className="text-[11px] leading-4 text-faint">The CEO steers, the agent runs marketing</span>
      </span>
    </Link>
  );
}
