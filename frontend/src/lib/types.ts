// Shared domain model. Every agent/UI/server module imports from here; change only with care.

// A company workspace id (slug). Kept as CaseId internally; UI copy says "company".
export type CaseId = string;
export type Status = "on_track" | "at_risk" | "off_track";
export type Verdict = "scale" | "hold" | "cut" | "test";
export type Unit = "usd" | "pct" | "count" | "months" | "ratio" | "pts" | "weeks";
export type Owner = "ceo" | "cmo" | "sales" | "product" | "ops";
export type FunnelStage = "awareness" | "consideration" | "conversion" | "retention";

export interface CompanyCase {
  id: CaseId;
  name: string; // fictional company name
  tagline: string; // one line: what they sell
  stage: "pre_pmf" | "scale_up" | "enterprise";
  stageLabel: string; // "Pre-PMF startup", ...
  industry: string;
  week: number; // current week index within the period (1-based)
  weeksInPeriod: number; // e.g. 13 for a quarter
  periodLabel: string; // "Q4 2026"
  primaryObjective: string; // the stage-driven objective, one sentence
  website?: string;
  sample?: boolean; // shipped sample company (read-only to delete)
  dataStatus: "sample" | "connected" | "awaiting_data"; // awaiting_data = created, no metrics/actions yet
}

// Layer 1: set by CEO / board
export interface BusinessGoal {
  id: string;
  label: string; // "Net revenue", "Burn multiple"
  kind: "revenue" | "margin" | "burn" | "share" | "pmf" | "other";
  target: number;
  current: number;
  unit: Unit;
  direction: "up" | "down"; // is higher better?
  deadline: string; // ISO date
  setBy: "ceo" | "board";
}

export interface Guardrails {
  budgetTotal: number; // period marketing budget (usd)
  budgetSpent: number;
  autonomyPct: number; // agent may shift up to this % of budget per week without approval
  brandFloorPct: number; // protected brand-building share, human-only change
  maxShiftPerWeekPct: number;
  minTestWeeks: number;
}

// Layer 2: revenue tree (arithmetic decomposition of the top goal)
export interface TreeNode {
  id: string;
  label: string;
  op?: "sum" | "product" | "minus"; // how children combine into this node
  unit: Unit;
  target: number;
  actual: number; // value to date, or run-rate for ratios
  forecast: number; // end-of-period forecast
  owner: Owner;
  metricId?: string; // link to Metric when tracked
  status?: Status; // derived by server
  children?: TreeNode[];
}

// Layer 3: marketing objectives sit on tree drivers
export interface MarketingObjective {
  id: string;
  label: string;
  driverNodeId: string; // TreeNode.id it moves
  northStarMetricId: string;
  supportingMetricIds: string[];
  priority: number; // 0..1, CEO-steerable weight
  rationale: string; // why this objective, one sentence
}

export interface MetricPoint {
  week: number;
  value: number;
}

export interface Metric {
  id: string;
  label: string;
  unit: Unit;
  target: number;
  direction: "up" | "down";
  lagging: boolean; // lagging (outcome) vs leading (signal)
  source: string; // "Snowflake: FUNNEL_FACT", "Retail scan data", ...
  objectiveId: string;
  series: MetricPoint[]; // weekly values, weeks 1..CompanyCase.week
}

// Layer 4: actions (campaigns, programs, experiments)
export interface Action {
  id: string;
  label: string;
  channel: string; // "Google Search", "TV", "Founder outreach", ...
  funnelStage: FunnelStage;
  budget: number; // period budget
  spent: number | null; // spent to date; null = spend not tracked
  resultLabel: string; // "SQL", "conversion", "household reach", "interview"
  results: number | null; // results to date; null = not measured
  costPerResult: number | null;
  marginalCostPerResult: number | null; // cost of the next result at current spend
  weeksRunning: number;
  hypothesis: string;
  status: "live" | "paused" | "planned";
  verdict?: Verdict; // derived by server
  score?: number; // derived value score (higher = better)
}

// N:N link between actions and marketing objectives
export interface Contribution {
  actionId: string;
  objectiveId: string;
  weight: number; // share of the action's credit going to this objective, 0..1 (per action sums to 1)
  method: "mmm" | "markov" | "holdout" | "last_touch" | "assumption";
  confidence: number; // 0..1
}

export interface Change {
  id: string;
  title: string;
  detail: string;
  impact: "positive" | "negative" | "neutral";
  metricId?: string;
  source: string;
}

export interface Evidence {
  label: string;
  value: string;
  source: string;
}

export interface Decision {
  id: string;
  title: string;
  rationale: string;
  impact: string; // expected effect, one line
  risk: string;
  reason: "above_autonomy" | "new_channel" | "brand_floor" | "objective_change" | "messaging";
  amount?: number;
  fromActionId?: string;
  toActionId?: string;
  fromActionLabel?: string; // filled by the server from actions
  toActionLabel?: string;
  evidence: Evidence[];
  status: "pending" | "approved" | "rejected";
  note?: string;
  decidedAt?: string;
}

export interface AgentLogEntry {
  id: string;
  week: number;
  kind: "shift" | "pause" | "launch" | "alert" | "test";
  text: string;
  amount?: number;
}

// Raw data per case (seeds or Snowflake)
export interface CaseData {
  case: CompanyCase;
  headline: string; // agent's one-sentence summary of the week
  goals: BusinessGoal[];
  guardrails: Guardrails;
  tree: TreeNode;
  objectives: MarketingObjective[];
  metrics: Metric[];
  actions: Action[];
  contributions: Contribution[];
  changes: Change[];
  decisions: Decision[];
  log: AgentLogEntry[];
}

// ---- Derived API payloads ----

export interface GoalScore extends BusinessGoal {
  status: Status;
  attainment: number; // current / target (direction-aware), 0..n
}

export interface ObjectiveScore {
  objective: MarketingObjective;
  northStar: Metric;
  status: Status;
  attainment: number; // latest vs target, direction-aware
  forecast: number; // projected end-of-period value of north star
  trend: "up" | "down" | "flat";
}

export interface WeeklyBrief {
  case: CompanyCase;
  overall: Status;
  headline: string;
  goals: GoalScore[];
  tree: TreeNode; // with status filled
  scorecard: ObjectiveScore[];
  changes: Change[];
  decisions: Decision[];
  log: AgentLogEntry[];
  guardrails: Guardrails;
  budgetPacing: number; // spent / (total * week/weeksInPeriod)
}

export interface StrategyMap {
  case: CompanyCase;
  objectives: (MarketingObjective & { status: Status })[];
  actions: Action[]; // verdict + score filled
  contributions: Contribution[];
  guardrails: Guardrails;
}

export interface CaseSummary {
  id: CaseId;
  name: string;
  stageLabel: string;
  tagline: string;
  sample: boolean;
  dataStatus: CompanyCase["dataStatus"];
}

// Onboarding input for a new company; the server builds goals, a stage template tree and guardrails from it.
export interface CompanyInput {
  name: string;
  website?: string;
  tagline: string; // what they sell, one line
  industry: string;
  stage: CompanyCase["stage"];
  periodLabel: string; // "Q4 2026"
  weeksInPeriod: number;
  week: number;
  topGoal: { label: string; target: number; current: number; unit: Unit; deadline: string };
  budgetTotal: number; // marketing budget for the period
  autonomyPct: number;
}

export interface SteeringUpdate {
  goals?: { id: string; target: number }[];
  guardrails?: Partial<Pick<Guardrails, "budgetTotal" | "autonomyPct" | "brandFloorPct">>;
  objectivePriorities?: { id: string; priority: number }[];
}

// One line of the ask stream (NDJSON). Answer text arrives as "text"; status/tool describe the agent's work.
export type AskEvent =
  | { type: "text"; text: string }
  | { type: "status"; message: string }
  | { type: "meta"; model: string }
  | { type: "tool"; name: string; input?: Record<string, unknown>; toolUseId?: string }
  | { type: "tool_done"; toolUseId: string; seconds?: number; ok: boolean }
  | { type: "error"; message: string }
  | { type: "done"; planId?: string };

// ---- 2027 plan: inputs -> CMO agent -> per-channel budgets and campaign actions. Field names mirror the backend. ----

export interface PlanInputs {
  budget_usd: number;
  revenue_target_usd: number;
  sqls_per_quarter: number;
  brand_pct: number; // 0..1
}

export type PlanKind = "performance" | "brand" | "unpriced";
export type PlanVerdict = "start" | "scale" | "optimize" | "maintain" | "cut";

export interface PlanChannel {
  channel_id: string;
  display_name: string;
  kind: PlanKind;
  budget_usd: number;
  share: number;
  current_annual_spend_usd: number | null;
  current_cost_per_sql?: number | null; // today's blended cost per SQL; null without a cost curve
  projected_sqls_per_quarter: number | null;
  projected_customers: number | null;
  projected_native: Record<string, number> | null; // {metric: value}, e.g. {impressions: 4106667}
  estimated: boolean;
  basis_note: string | null;
  // filled by the channel agent; absent while the channel is still being planned
  verdict?: PlanVerdict;
  rationale?: string;
  actions?: { title: string; detail: string }[];
  risk?: string | null;
  source?: "agent" | "fallback";
  plan_cost_per_sql?: number | null; // budget / (projected_sqls_per_quarter * 4); null without SQLs
  agent_recommends_cut?: boolean; // the agent said cut while budget_usd > 0; the allocation is unchanged
}

export interface PlanTotals {
  budget_usd: number;
  allocated_usd: number;
  unallocated_usd: number;
  projected_sqls_per_quarter: number | null;
  projected_customers: number | null;
  projected_new_arr_usd: number | null;
}

export interface PlanTargets {
  revenue: { target_usd: number; projected_usd: number | null; gap_usd: number | null; met: boolean };
  sqls_per_quarter: { target: number; projected: number | null; gap: number | null; met: boolean };
  budget_needed_for_targets_usd: number | null;
  limited_by: string | null;
  notes: string[];
}

export interface PlanData {
  inputs: PlanInputs;
  assumptions_used?: Record<string, unknown>;
  channels: PlanChannel[];
  totals: PlanTotals;
  targets: PlanTargets;
}

export interface SavedPlan extends Omit<PlanData, "assumptions_used"> {
  plan_id: string;
  created_at: string;
  summary: string;
  model: string | null;
}

export interface Plan2027Load {
  inputs: PlanInputs;
  saved: SavedPlan | null;
  live: boolean; // false: a simulated plan for a sample company
  notice?: string; // the backend could not be fully read; inputs fall back to defaults
}

export type PlanEvent = AskEvent | ({ type: "plan" } & PlanData) | ({ type: "channel_plan" } & PlanChannel) | ({ type: "targets" } & PlanTargets);

export interface CampaignDraft {
  campaign_id: string;
  plan_id: string;
  channel_id: string;
  status: string;
  stub: boolean;
  created_at?: string;
  brief: {
    name: string;
    objective: string;
    budget_usd: number;
    kpis: string[];
    steps: { title: string; detail: string }[];
  };
}

// ---- Deep dives: saved conversations with the agent, optionally written up as an artifact ----

export interface DeepDiveMessage {
  role: "user" | "agent";
  text: string;
  at: string; // ISO time
}

// The write-up of a deep dive. The agent reads these before answering, so later answers build on them.
export interface DeepDiveArtifact {
  question: string; // what was challenged, one line
  answer: string; // the conclusion, one or two sentences
  findings: string[]; // evidence, each with a number
  recommendation: string;
  openQuestions: string[];
  confidence: "low" | "medium" | "high";
  writtenAt: string;
  messageCount: number; // messages the write-up covers; fewer than the thread means it is out of date
}

export interface DeepDive {
  id: string;
  caseId: CaseId;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: DeepDiveMessage[];
  artifact?: DeepDiveArtifact;
}

export interface DeepDiveSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  answer?: string; // the artifact's conclusion, when written up
  stale: boolean; // written up, but the conversation has moved on since
}

export interface DeepDiveList {
  deepDives: DeepDiveSummary[];
  starters: string[]; // suggested questions to dig into, from this company's data
}

// ---- Data sources the agent works from ----

export interface DataSource {
  id: string;
  name: string;
  kind: "warehouse" | "channel" | "crm" | "plan" | "notes" | "other";
  status: "connected" | "sample" | "paused" | "not_connected";
  provides: string; // one plain sentence
  usedFor: string[]; // numbers or channels it feeds
  detail?: string; // tables, schema, mapping version
  updatedAt?: string;
}
