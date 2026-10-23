"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";
import { useCaseId } from "@/lib/case";
import type { DeepDiveSummary } from "@/lib/types";
import { Button, cx, ErrorNote, Skeleton } from "@/components/ui";
import { PageFrame, PageHeader } from "@/components/strategy/PageHeader";
import { DeepDiveThread } from "./DeepDiveThread";
import { shortDate } from "./dates";

const QUESTION = "What have we dug into together?";

// The thread keeps its key while a new deep dive gets its id, so the conversation isn't reloaded mid-answer.
type Active = { key: string; id: string | null };

export function DeepDivesView() {
  const caseId = useCaseId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ddParam = params.get("dd");
  const list = useApi(() => api.deepDives(caseId), [caseId]);
  const strategy = useApi(() => api.strategy(caseId), [caseId]);
  const [active, setActive] = useState<Active | null>(ddParam ? { key: ddParam, id: ddParam } : null);
  const [fresh, setFresh] = useState(0);

  // Follow the URL when it changes from outside (e.g. "Saved in Deep dives" in the chat drawer).
  useEffect(() => {
    setActive((a) => (ddParam && a?.id !== ddParam ? { key: ddParam, id: ddParam } : a));
  }, [ddParam]);

  const setUrl = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(params.toString());
      if (id) p.set("dd", id);
      else p.delete("dd");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const open = (id: string) => {
    setActive({ key: id, id });
    setUrl(id);
  };
  const startNew = () => {
    setFresh((n) => n + 1);
    setActive({ key: `new-${fresh + 1}`, id: null });
    setUrl(null);
  };
  const thread = active ?? { key: `new-${fresh}`, id: null };
  const onSaved = (id: string) => {
    if (thread.id !== id) {
      setActive({ key: thread.key, id });
      setUrl(id);
    }
    list.reload();
  };
  const onDeleted = () => {
    setActive(null);
    setUrl(null);
    list.reload();
  };

  const dives = list.data?.deepDives ?? [];
  const written = dives.filter((d) => d.answer).length;
  const answer = list.data
    ? dives.length
      ? `${dives.length} ${dives.length === 1 ? "deep dive" : "deep dives"}, ${written} written up. I read every write-up before I answer, so we don't start from zero.`
      : "Nothing yet. Challenge a call I made, and I'll write up what we find so later answers build on it."
    : list.error
      ? null
      : undefined;

  return (
    <PageFrame>
      <PageHeader page="Deep dives" company={strategy.data?.case} question={QUESTION} answer={answer} />
      {list.error && <ErrorNote message={`Could not load deep dives. ${list.error}`} />}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <Button onClick={startNew} className="w-full justify-center">
            New deep dive
          </Button>
          {list.loading && !list.data ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="space-y-1.5">
              {dives.map((d) => (
                <DiveRow key={d.id} dive={d} active={thread.id === d.id} onOpen={() => open(d.id)} />
              ))}
            </ul>
          )}
        </aside>
        <DeepDiveThread
          key={`${caseId}-${thread.key}`}
          caseId={caseId}
          deepDiveId={thread.id}
          starters={list.data?.starters ?? []}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </div>
    </PageFrame>
  );
}

function DiveRow({ dive, active, onOpen }: { dive: DeepDiveSummary; active: boolean; onOpen: () => void }) {
  const state = dive.stale ? "Write-up out of date" : dive.answer ? "Written up" : "Not written up yet";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cx(
          "w-full rounded-lg border px-3 py-2.5 text-left transition",
          active ? "border-line-strong bg-surface-3" : "border-line bg-surface hover:bg-surface-2",
        )}
      >
        <span className="line-clamp-2 text-sm text-ink">{dive.title}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-faint">
          <span className={cx(dive.answer && !dive.stale && "text-accent", dive.stale && "text-warn")}>{state}</span>
          <span aria-hidden>·</span>
          <span>{shortDate(dive.updatedAt)}</span>
        </span>
      </button>
    </li>
  );
}
