import Link from "next/link";

// Gold diamond glyph + wordmark. The glyph is the agent's mark, so it carries the gold accent.
export function ProductMark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink" aria-label="Agentic CMO home">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0 text-gold">
        <rect x="4" y="4" width="12" height="12" rx="1.5" transform="rotate(45 10 10)" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="2.25" fill="currentColor" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">Agentic CMO</span>
    </Link>
  );
}
