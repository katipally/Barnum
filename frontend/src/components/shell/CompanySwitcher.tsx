"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { useCaseId, useSetCase, withCase } from "@/lib/case";
import { CompanyMenu } from "./CompanyMenu";
import { Monogram, plainStage } from "./CompanyMarks";
import { useCases } from "./useCases";

function titleCase(id: string) {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Workspace-style switcher at the top of the sidebar (in the top nav under 900px).
export function CompanySwitcher() {
  const caseId = useCaseId();
  const setCase = useSetCase();
  const pathname = usePathname();
  const cases = useCases();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const current = cases?.find((c) => c.id === caseId);
  const name = current?.name ?? (cases ? titleCase(caseId) : "");

  // Close on outside pointer or when focus leaves the switcher.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => setOpen(false), [pathname, caseId]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const pick = (id: string) => {
    close(true);
    if (id === caseId) return;
    // Company pages are not company-scoped, so switching from there opens the new company's week.
    setCase(id, pathname.startsWith("/companies") ? "/" : undefined);
  };

  return (
    <div ref={rootRef} data-tour="case-switcher" className="relative min-w-0 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={name ? `Company: ${name}. Switch company` : "Switch company"}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        className={cx(
          "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition",
          open ? "bg-surface-3" : "hover:bg-surface-2",
        )}
      >
        <Monogram name={name || "?"} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="max-w-[9rem] truncate text-sm font-medium leading-5 text-ink min-[900px]:max-w-none">
            {name || <span className="text-faint">Loading…</span>}
          </span>
          <span
            className="hidden truncate text-[11px] leading-4 text-faint min-[900px]:block"
            title={current ? plainStage(current.stageLabel).meaning : undefined}
          >
            {current ? plainStage(current.stageLabel).short : " "}
          </span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0 text-faint">
          <path d="M3.5 4.75 6 2.25l2.5 2.5M3.5 7.25 6 9.75l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <CompanyMenu
          id={menuId}
          cases={cases}
          currentId={caseId}
          onPick={pick}
          onClose={close}
          addHref={withCase("/companies/new", caseId)}
          manageHref={withCase("/companies", caseId)}
        />
      )}
    </div>
  );
}
