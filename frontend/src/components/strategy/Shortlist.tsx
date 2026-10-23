import type { Action } from "@/lib/types";
import { VerdictWord } from "./bits";
import { firstLook, verdictOf, whySentence } from "./model";

// Shown when no channel is selected: the one best opportunity and the one biggest leak.
export function Shortlist({
  actions,
  minTestWeeks,
  onSelect,
}: {
  actions: Action[];
  minTestWeeks: number;
  onSelect: (id: string) => void;
}) {
  const { more, less } = firstLook(actions, minTestWeeks);
  const items = [
    more && { title: "Best place for more money", a: more },
    less && { title: "Biggest leak", a: less },
  ].filter((x): x is { title: string; a: Action } => !!x);

  return (
    <div className="space-y-4">
      <h3 className="text-sm text-accent">Where I&apos;d look first</h3>
      {items.map(({ title, a }) => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id)}
          className="-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-2 text-left transition hover:bg-surface-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        >
          <span className="block text-xs text-faint">{title}</span>
          <span className="mt-1 block text-sm text-ink">{a.label}</span>
          <VerdictWord verdict={verdictOf(a, minTestWeeks)} className="mt-1" />
          <span className="mt-1 block text-[13px] leading-snug text-muted">{whySentence(a, actions, minTestWeeks)}</span>
        </button>
      ))}
      {!items.length && <p className="text-sm text-muted">No big moves needed right now.</p>}
      <p className="border-t border-line pt-3 text-xs text-faint">Click any channel to see its budget, results and the goals it helps.</p>
    </div>
  );
}
