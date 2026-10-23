"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { useAskCmo } from "@/components/chat/AskCmoContext";
import { useCaseId, withCase } from "@/lib/case";
import { CompanySwitcher } from "./CompanySwitcher";
import { NavIcon } from "./NavIcon";
import { NAV_ITEMS, isActive } from "./navItems";
import { ProductMark } from "./ProductMark";

// Fixed left rail on wide screens; a horizontal top nav under 900px. The nav scrolls, not the rail,
// so the company menu can overflow it.
export function Sidebar() {
  const caseId = useCaseId();
  const pathname = usePathname();

  return (
    <aside
      className={cx(
        "relative z-30 flex border-line bg-bg/80 backdrop-blur",
        "flex-row items-center gap-3 border-b px-3 py-2",
        "min-[900px]:fixed min-[900px]:inset-y-0 min-[900px]:left-0 min-[900px]:w-64 min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:gap-0 min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:px-4 min-[900px]:py-5",
      )}
    >
      <div className="hidden px-1 min-[900px]:block">
        <ProductMark href={withCase("/", caseId)} />
      </div>
      <div className="min-[900px]:mt-6 min-[900px]:rounded-xl min-[900px]:border min-[900px]:border-line min-[900px]:bg-surface-2/60 min-[900px]:p-1.5">
        <CompanySwitcher />
      </div>
      <p className="mt-7 mb-2 hidden px-3 text-[11px] uppercase tracking-[0.14em] text-faint min-[900px]:block">Workspace</p>
      <nav
        data-tour="nav"
        aria-label="Main"
        className="flex min-w-0 flex-row gap-1 overflow-x-auto min-[900px]:flex-col min-[900px]:overflow-visible"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={withCase(item.href, caseId)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-[14px] transition",
                active
                  ? "border-line bg-gradient-to-r from-surface-3 to-surface-2/40 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  : "border-transparent text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <NavIcon href={item.href} className={cx("hidden shrink-0 min-[900px]:block", active ? "text-accent" : "text-faint group-hover:text-muted")} />
              {item.label}
              {active && <span aria-hidden className="absolute inset-y-2 -right-px hidden w-[2px] rounded-full bg-accent min-[900px]:block" />}
            </Link>
          );
        })}
      </nav>
      <AskPromo />
    </aside>
  );
}

// Bottom-of-rail card that opens the Ask Barnum drawer.
function AskPromo() {
  const { toggle } = useAskCmo();
  return (
    <button
      type="button"
      onClick={toggle}
      className="group mt-auto hidden w-full overflow-hidden rounded-xl border border-line bg-surface-2/70 p-3.5 text-left transition hover:border-accent/40 min-[900px]:block"
    >
      <span className="flex items-center gap-2 text-sm text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="text-accent">
          <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
        </svg>
        Ask Barnum
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-muted">
        Why it decided, what happens if you say no. Press{" "}
        <kbd className="rounded border border-line-strong bg-surface-3 px-1 font-mono text-[10px] text-ink">/</kbd>
      </span>
    </button>
  );
}
