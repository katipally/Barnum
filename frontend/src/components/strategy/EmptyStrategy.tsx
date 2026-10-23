import type { StrategyMap } from "@/lib/types";
import { AwaitingData } from "@/components/empty/AwaitingData";
import { isAwaiting } from "@/components/empty/state";

const SENTENCE = "Nothing to show yet. Once your ad accounts and spend data are connected, I'll show where every dollar goes and whether it's working.";

// No channels yet: the goals the money will be matched to, plus what to connect.
export function EmptyStrategy({ data }: { data: StrategyMap }) {
  const objectives = [...data.objectives].sort((a, b) => b.priority - a.priority);
  const list = objectives.length > 0 && (
    <div data-tour="strategy-map" className="max-w-[760px]">
      <h2 className="text-[17px] font-normal text-ink">The goals I&apos;ll match spending to</h2>
      <ul className="mt-3 space-y-2">
        {objectives.map((o) => (
          <li key={o.id} className="panel px-3 py-2.5">
            <p className="text-sm text-ink">{o.label}</p>
            <p className="mt-0.5 text-xs text-muted">{o.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );

  if (!isAwaiting(data.case))
    return (
      <div className="space-y-5">
        <p className="max-w-[760px] text-[15px] text-ink/90">{SENTENCE}</p>
        {list}
      </div>
    );
  return (
    <AwaitingData stage={data.case.stage} sentence={SENTENCE}>
      {list}
    </AwaitingData>
  );
}
