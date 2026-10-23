import Link from "next/link";
import { BarnumGlyph } from "./BarnumGlyph";

// Lavender tile with the Barnum monogram + wordmark.
export function ProductMark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 text-ink" aria-label="Barnum home">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-accent to-accent-strong text-accent-ink shadow-[0_8px_20px_-8px_rgba(139,109,255,0.9)]">
        <BarnumGlyph size={22} />
      </span>
      <span className="flex flex-col">
        <span className="text-[17px] font-medium leading-5 tracking-tight">Barnum</span>
        <span className="text-[11px] leading-4 text-faint">Your CMO, on autopilot</span>
      </span>
    </Link>
  );
}
