"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui";
import type { CaseSummary } from "@/lib/types";
import { DataStatusDot, SampleTag, plainStage } from "./CompanyMarks";
import { splitCases } from "./useCases";

interface Props {
  id: string;
  cases: CaseSummary[] | null;
  currentId: string;
  onPick: (id: string) => void;
  onClose: (refocus: boolean) => void;
  addHref: string;
  manageHref: string;
}

const ITEM = "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none transition focus-visible:bg-surface-3 hover:bg-surface-3";

function items(menu: HTMLElement | null) {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? []);
}

// Dropdown for the company switcher: own companies, sample companies, then add/manage.
export function CompanyMenu({ id, cases, currentId, onPick, onClose, addHref, manageHref }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { own, samples } = splitCases(cases ?? []);

  // Focus the current company (or the first item) when the menu opens.
  useEffect(() => {
    const list = items(ref.current);
    (list.find((el) => el.getAttribute("aria-checked") === "true") ?? list[0])?.focus();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const list = items(ref.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(list.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
    } else if (e.key === "Tab") onClose(false);
  };

  const row = (c: CaseSummary) => {
    const active = c.id === currentId;
    return (
      <button
        key={c.id}
        type="button"
        role="menuitemradio"
        aria-checked={active}
        tabIndex={-1}
        onClick={() => onPick(c.id)}
        className={cx(ITEM, active ? "text-ink" : "text-muted hover:text-ink focus-visible:text-ink")}
      >
        <DataStatusDot status={c.dataStatus} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-ink">{c.name}</span>
            {c.sample && <SampleTag />}
          </span>
          <span className="truncate text-[11px] leading-4 text-faint" title={plainStage(c.stageLabel).meaning}>
            {plainStage(c.stageLabel).short}
          </span>
        </span>
        {active && (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-accent">
            <path d="m3 7.25 2.5 2.5L11 4.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label="Companies"
      onKeyDown={onKey}
      className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl shadow-black/50 min-[900px]:w-64"
    >
      {!cases && <p className="px-2 py-2 text-xs text-faint">Loading companies…</p>}
      {own.length > 0 && <Group label="Your companies">{own.map(row)}</Group>}
      {samples.length > 0 && <Group label="Sample companies">{samples.map(row)}</Group>}
      <div role="separator" className="my-1.5 h-px bg-line" />
      <Link href={addHref} role="menuitem" tabIndex={-1} onClick={() => onClose(false)} className={cx(ITEM, "text-muted hover:text-ink focus-visible:text-ink")}>
        <span aria-hidden className="flex h-4 w-4 items-center justify-center text-base leading-none text-faint">+</span>
        Add company
      </Link>
      <Link href={manageHref} role="menuitem" tabIndex={-1} onClick={() => onClose(false)} className={cx(ITEM, "text-muted hover:text-ink focus-visible:text-ink")}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-faint">
          <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        Manage companies
      </Link>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-1 last:mb-0">
      <p aria-hidden className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-faint">
        {label}
      </p>
      {children}
    </div>
  );
}
