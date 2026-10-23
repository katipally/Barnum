import type { ReactNode } from "react";
import type { Action, Contribution, MarketingObjective, Status } from "@/lib/types";
import { fmt, money, STATUS_TEXT } from "@/lib/format";
import { Button, cx, StatusDot } from "@/components/ui";
import { Term } from "@/components/ui/Term";
import { ResultTerm, VerdictWord } from "./bits";
import { avgCost, creditWords, isLessSure, METHOD_LABEL, perUnit, verdictOf, whySentence } from "./model";

const RUN_STATE: Record<Action["status"], string> = { live: "Running", paused: "Paused", planned: "Not started yet" };
const GOAL_WORD: Record<Status, string> = { on_track: "on track", at_risk: "needs attention", off_track: "off track" };

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function ActionDetail({
  action: a,
  all,
  objectives,
  contributions,
  minTestWeeks,
  onClose,
}: {
  action: Action;
  all: Action[];
  objectives: (MarketingObjective & { status: Status })[];
  contributions: Contribution[];
  minTestWeeks: number;
  onClose?: () => void;
}) {
  const links = contributions
    .filter((c) => c.actionId === a.id)
    .sort((x, y) => y.weight - x.weight)
    .map((c) => ({ c, o: objectives.find((o) => o.id === c.objectiveId) }));
  const avg = avgCost(a);
  const next = a.marginalCostPerResult;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base leading-snug text-ink">{a.label}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {a.channel !== a.label && `${a.channel} · `}
            {RUN_STATE[a.status]}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" className="-mr-2 -mt-1 px-2 py-1 text-xs" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div>
        <p className="text-xs text-gold">My call</p>
        <VerdictWord verdict={verdictOf(a, minTestWeeks)} className="mt-1" />
        <p className="mt-1 text-sm leading-snug text-ink/90">{whySentence(a, all, minTestWeeks)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Budget this period">{money(a.budget)}</Stat>
        <Stat label="Spent so far">
          {money(a.spent)} <span className="text-faint">({fmt(a.budget ? (a.spent / a.budget) * 100 : 0, "pct")})</span>
        </Stat>
        <Stat label="Results so far">
          {fmt(a.results, "count")} <ResultTerm label={a.resultLabel} plural={a.results !== 1} />
        </Stat>
        <Stat label={<Term k="marginal">The next one would cost</Term>}>{next != null ? perUnit(next) : "Not known yet"}</Stat>
      </dl>

      <div>
        <p className="mb-1.5 text-xs text-faint">Which goals it helps</p>
        <ul className="space-y-2">
          {links.map(({ c, o }) => (
            <li key={c.objectiveId} className="flex items-start gap-2 text-sm leading-snug">
              {o && <StatusDot status={o.status} className="mt-1.5" />}
              <span>
                <span className="text-ink">{o?.label ?? c.objectiveId}</span>
                {o && <span className={cx("text-xs", STATUS_TEXT[o.status])}> · {GOAL_WORD[o.status]}</span>}
                <span className="block text-xs text-muted">
                  Gets {creditWords(c.weight)}
                  {isLessSure(c) && <span className="text-faint"> (less sure)</span>}
                </span>
              </span>
            </li>
          ))}
          {!links.length && <li className="text-sm text-faint">Not linked to a goal yet.</li>}
        </ul>
      </div>

      <div>
        <p className="text-xs text-faint">The bet</p>
        <p className="mt-1 text-sm leading-snug text-muted">{a.hypothesis}</p>
      </div>

      <details className="group border-t border-line pt-3">
        <summary className="cursor-pointer list-none text-xs text-muted hover:text-ink">
          <span className="group-open:hidden">Show the math</span>
          <span className="hidden group-open:inline">Hide the math</span>
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {avg != null && a.results > 0 && (
            <li>
              {money(a.spent)} spent for {fmt(a.results, "count")} <ResultTerm label={a.resultLabel} plural={a.results !== 1} />,
              so {perUnit(avg)} each on average.
            </li>
          )}
          {avg != null && next != null && (
            <li>
              The next one costs {perUnit(next)}, {next > avg ? "more" : "less"} than the average of {perUnit(avg)}: extra spend
              {next > avg ? " reaches people who are harder to win." : " is still finding easy wins."}
            </li>
          )}
          <li>
            Running for {fmt(a.weeksRunning, "count")} week{a.weeksRunning === 1 ? "" : "s"}. New channels get at least {minTestWeeks}{" "}
            weeks before I judge them.
          </li>
          {links.map(({ c, o }) => (
            <li key={c.objectiveId}>
              Credit to “{o?.label ?? c.objectiveId}”: {Math.round(c.weight * 100)}%, measured by {METHOD_LABEL[c.method]} (
              {Math.round(c.confidence * 100)}% sure).
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
