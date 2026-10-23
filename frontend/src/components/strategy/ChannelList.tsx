"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { Action } from "@/lib/types";
import { Button, cx } from "@/components/ui";
import { Efficiency, SpendBar, VerdictWord } from "./bits";
import { verdictOf, whySentence } from "./model";

const VISIBLE = 6;

export function ChannelList({
  actions,
  all,
  minTestWeeks,
  selectedId,
  onSelect,
  detail,
}: {
  actions: Action[];
  all: Action[];
  minTestWeeks: number;
  selectedId?: string;
  onSelect: (id: string | null) => void;
  detail: (a: Action) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(0, ...actions.map((a) => a.budget));
  const shown = actions.filter((a, i) => expanded || i < VISIBLE || a.id === selectedId);

  return (
    <div>
      <ul className="space-y-1">
        {shown.map((a) => {
          const selected = a.id === selectedId;
          const toggle = () => onSelect(selected ? null : a.id);
          const onKey = (e: KeyboardEvent) => {
            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            toggle();
          };
          return (
            <li key={a.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={toggle}
                onKeyDown={onKey}
                className={cx(
                  "grid cursor-pointer gap-x-8 gap-y-3 rounded-lg border px-4 py-3.5 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/60 sm:grid-cols-[minmax(0,1fr)_230px]",
                  selected ? "border-line-strong bg-surface-2" : "border-transparent hover:bg-surface-2",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] leading-snug text-ink">{a.label}</span>
                    {a.channel !== a.label && <span className="text-xs text-faint">{a.channel}</span>}
                  </div>
                  <div className="mt-2">
                    <SpendBar action={a} max={max} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    <Efficiency action={a} />
                  </p>
                </div>
                <div>
                  <VerdictWord verdict={verdictOf(a, minTestWeeks)} />
                  <p className="mt-1 text-[13px] leading-snug text-muted">{whySentence(a, all, minTestWeeks)}</p>
                </div>
              </div>
              {selected && <div className="mx-1 mb-3 mt-1 rounded-lg border border-line bg-surface-2 p-4 lg:hidden">{detail(a)}</div>}
            </li>
          );
        })}
      </ul>
      {actions.length > VISIBLE && (
        <Button variant="ghost" className="mt-2 text-xs" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show fewer" : `Show all ${actions.length} channels`}
        </Button>
      )}
    </div>
  );
}
