"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { useCaseId, withCase } from "@/lib/case";
import { CompanySwitcher } from "./CompanySwitcher";
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
        "relative z-30 flex border-line bg-bg",
        "flex-row items-center gap-3 border-b px-3 py-2",
        "min-[900px]:fixed min-[900px]:inset-y-0 min-[900px]:left-0 min-[900px]:w-56 min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:gap-6 min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:px-3 min-[900px]:py-4",
      )}
    >
      <CompanySwitcher />
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
                "relative shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition",
                active ? "bg-surface-3 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {active && (
                <span aria-hidden className="absolute inset-y-1.5 left-0 hidden w-px bg-ink/70 min-[900px]:block" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden space-y-4 px-2 min-[900px]:block">
        <p className="text-xs leading-relaxed text-faint">
          Press <kbd className="rounded border border-line-strong px-1 font-mono text-[11px] text-muted">/</kbd> to ask the CMO agent anything.
        </p>
        <ProductMark href={withCase("/", caseId)} />
      </div>
    </aside>
  );
}
