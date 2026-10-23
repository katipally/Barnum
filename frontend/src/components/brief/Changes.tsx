"use client";

import { useState } from "react";
import type { Change } from "@/lib/types";
import { cx } from "@/components/ui";
import { Heading } from "./bits";
import { PlainText } from "./plain";

const IMPACT = {
  positive: { word: "Better", text: "text-ok", dot: "bg-ok" },
  negative: { word: "Worse", text: "text-bad", dot: "bg-bad" },
  neutral: { word: "Note", text: "text-muted", dot: "bg-faint" },
} as const;

// What moved since last week, in at most three short sentences.
export function Changes({ changes }: { changes: Change[] }) {
  const [open, setOpen] = useState(false);
  const shown = changes.slice(0, 3);

  return (
    <section data-tour="changes">
      <Heading>What changed this week</Heading>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">Nothing notable moved this week.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {shown.map((c) => {
              const i = IMPACT[c.impact];
              return (
                <li key={c.id} className="flex gap-3">
                  <span className={cx("mt-[7px] h-2 w-2 shrink-0 rounded-full", i.dot)} />
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug text-ink">
                      <span className={cx("mr-1.5 text-xs font-medium", i.text)}>{i.word}</span>
                      <PlainText text={c.title} />
                    </p>
                    {open && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        <PlainText text={c.detail} />
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-4 text-xs text-muted hover:text-ink"
          >
            {open ? "Hide details" : "Show details"}
          </button>
        </>
      )}
    </section>
  );
}
