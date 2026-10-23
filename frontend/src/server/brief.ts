// Assembles derived API payloads from raw CaseData.
import type { Action, CaseData, CaseSummary, Decision, ObjectiveScore, Status, StrategyMap, WeeklyBrief } from "@/lib/types";
import {
  budgetPacing,
  evaluateActions,
  overallStatus,
  scoreGoal,
  scoreObjective,
  scoreTree,
} from "./heuristics";

export function buildScorecard(data: CaseData): ObjectiveScore[] {
  return data.objectives
    .map((o) => scoreObjective(o, data.metrics, data.case.weeksInPeriod))
    .filter((s): s is ObjectiveScore => s !== null);
}

/** Decision with action labels resolved from fromActionId / toActionId. */
export function withActionLabels(d: Decision, actions: Action[]): Decision {
  const label = (id?: string) => (id ? actions.find((a) => a.id === id)?.label : undefined);
  return { ...d, fromActionLabel: label(d.fromActionId), toActionLabel: label(d.toActionId) };
}

export function buildBrief(data: CaseData): WeeklyBrief {
  const goals = data.goals.map((g) => scoreGoal(g, data.case));
  const scorecard = buildScorecard(data);
  return {
    case: data.case,
    overall: overallStatus(
      goals.map((g) => g.status),
      scorecard.map((s) => s.status),
    ),
    headline: data.headline,
    goals,
    tree: scoreTree(data.tree),
    scorecard,
    changes: data.changes,
    decisions: data.decisions.map((d) => withActionLabels(d, data.actions)),
    log: data.log,
    guardrails: data.guardrails,
    budgetPacing: budgetPacing(data.guardrails, data.case),
  };
}

export function buildStrategy(data: CaseData): StrategyMap {
  const scorecard = buildScorecard(data);
  const statusById = new Map<string, Status>(scorecard.map((s) => [s.objective.id, s.status]));
  return {
    case: data.case,
    objectives: data.objectives.map((o) => ({ ...o, status: statusById.get(o.id) ?? "at_risk" })),
    actions: evaluateActions(data),
    contributions: data.contributions,
    guardrails: data.guardrails,
  };
}

export function toSummary(d: CaseData): CaseSummary {
  return {
    id: d.case.id,
    name: d.case.name,
    stageLabel: d.case.stageLabel,
    tagline: d.case.tagline,
    sample: d.case.sample ?? false,
    dataStatus: d.case.dataStatus,
  };
}
