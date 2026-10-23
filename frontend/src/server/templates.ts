// Builds a new company workspace from onboarding input: goals, guardrails, stage template tree and objectives.
import type {
  BusinessGoal,
  CaseData,
  CompanyCase,
  CompanyInput,
  Guardrails,
  MarketingObjective,
  TreeNode,
  Unit,
} from "@/lib/types";
import { treeDirection } from "./heuristics";

type Stage = CompanyCase["stage"];

export const STAGES: readonly Stage[] = ["pre_pmf", "scale_up", "enterprise"];
export const UNITS: readonly Unit[] = ["usd", "pct", "count", "months", "ratio", "pts", "weeks"];

export const AWAITING_HEADLINE = "I have your goals. Connect your marketing data and I'll build the first plan.";

const STAGE_LABEL: Record<Stage, string> = {
  pre_pmf: "Pre-PMF startup",
  scale_up: "Scaling company",
  enterprise: "Established brand",
};

const PRIMARY_OBJECTIVE: Record<Stage, string> = {
  pre_pmf: "Find the customers who get real value from us, and prove they stay, before the money runs out.",
  scale_up: "Grow revenue where we can win, without overspending to win each customer.",
  enterprise: "Grow by reaching more households, not by discounting to the ones we already have.",
};

const STAGE_GUARDRAILS: Record<Stage, Pick<Guardrails, "brandFloorPct" | "minTestWeeks" | "maxShiftPerWeekPct">> = {
  pre_pmf: { brandFloorPct: 0, minTestWeeks: 2, maxShiftPerWeekPct: 25 },
  scale_up: { brandFloorPct: 20, minTestWeeks: 3, maxShiftPerWeekPct: 15 },
  enterprise: { brandFloorPct: 60, minTestWeeks: 4, maxShiftPerWeekPct: 10 },
};

/** Lowercase ASCII slug, max 40 chars; "company" when nothing usable is left. */
export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "company";
}

export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

function goalKind(label: string, unit: Unit): BusinessGoal["kind"] {
  const l = label.toLowerCase();
  if (/burn|runway/.test(l)) return "burn";
  if (/margin/.test(l)) return "margin";
  if (/share|penetration/.test(l)) return "share";
  if (/\bpmf\b|product.market|retention|disappointed/.test(l)) return "pmf";
  if (unit === "usd" || /revenue|arr\b|mrr\b|sales|bookings/.test(l)) return "revenue";
  return "other";
}

// Template driver: target/actual/forecast 0 means "not set yet".
const node = (id: string, label: string, unit: Unit, owner: TreeNode["owner"], extra: Partial<TreeNode> = {}): TreeNode => ({
  id,
  label,
  unit,
  target: 0,
  actual: 0,
  forecast: 0,
  owner,
  ...extra,
});

function templateChildren(stage: Stage): Pick<TreeNode, "op" | "children"> {
  if (stage === "pre_pmf")
    return {
      op: "product",
      children: [
        node("n-customers", "Paying customers", "count", "cmo", {
          op: "product",
          children: [node("n-trials", "Free trials started", "count", "cmo"), node("n-trial-to-paid", "Trials that become paying", "pct", "product")],
        }),
        node("n-arpa", "Revenue per customer", "usd", "sales"),
      ],
    };
  if (stage === "scale_up")
    return {
      op: "minus",
      children: [
        node("n-gross", "New yearly revenue before losses", "usd", "sales", {
          op: "sum",
          children: [
            node("n-new", "Revenue from new customers", "usd", "cmo", {
              op: "product",
              children: [
                node("n-sqls", "Qualified sales leads (SQLs)", "count", "cmo"),
                node("n-winrate", "Win rate", "pct", "sales"),
                node("n-acv", "Average deal size", "usd", "sales"),
              ],
            }),
            node("n-expansion", "Upsells to existing customers", "usd", "sales"),
          ],
        }),
        node("n-churn", "Revenue lost to cancellations (churn)", "usd", "ops"),
      ],
    };
  return {
    op: "product",
    children: [
      node("n-buyers", "Households buying us", "count", "cmo", {
        op: "product",
        children: [node("n-market", "Households in the market", "count", "ceo"), node("n-penetration", "Share of households buying us", "pct", "cmo")],
      }),
      node("n-frequency", "Purchases per buyer", "ratio", "cmo"),
      node("n-price", "Average price per purchase", "usd", "sales"),
    ],
  };
}

const objective = (
  id: string,
  label: string,
  driverNodeId: string,
  northStarMetricId: string,
  priority: number,
  rationale: string,
): MarketingObjective => ({ id, label, driverNodeId, northStarMetricId, supportingMetricIds: [], priority, rationale });

// North-star metric ids are placeholders until data is connected; they may not exist in `metrics`.
const TEMPLATE_OBJECTIVES: Record<Stage, MarketingObjective[]> = {
  pre_pmf: [
    objective("o-activation", "More trials that become paying", "n-trial-to-paid", "m-trial-to-paid", 0.9, "Trials turning into paying customers is the clearest early sign that the product solves a real problem."),
    objective("o-segment", "Find the customers who stay", "n-customers", "m-retention-60d", 0.7, "Knowing which customers keep using us tells us where to focus before we spend to grow."),
    objective("o-trials", "Enough serious trials", "n-trials", "m-trials", 0.5, "Enough serious trials each week to learn quickly, without paying for sign-ups that never buy."),
  ],
  scale_up: [
    objective("o-pipeline", "More qualified leads from marketing", "n-sqls", "m-mkt-sqls", 0.9, "Revenue from new customers grows with qualified leads, and that is where marketing helps most."),
    objective("o-winrate", "Win more of our deals", "n-winrate", "m-win-rate", 0.7, "Winning more of the deals we already have is cheaper than buying more leads."),
    objective("o-expansion", "Grow existing customers", "n-expansion", "m-expansion-arr", 0.5, "Customers who already pay are the cheapest source of new revenue."),
  ],
  enterprise: [
    objective("o-penetration", "Reach more households", "n-penetration", "m-penetration", 0.9, "Brands grow mainly by reaching more buyers, not by getting existing ones to buy more."),
    objective("o-price", "Keep our prices up", "n-price", "m-avg-price", 0.6, "Smaller discounts protect our margin while reaching new buyers does the growing."),
    objective("o-frequency", "Get buyers to buy more often", "n-frequency", "m-purchase-frequency", 0.4, "Staying top of mind keeps existing buyers from drifting to rivals."),
  ],
};

/** Builds the CaseData for a new company. `taken` are ids already in use (samples + user companies). */
export function buildCompany(input: CompanyInput, taken: Iterable<string> = []): CaseData {
  const id = uniqueSlug(input.name, taken);
  const g = input.topGoal;
  const stage = input.stage;
  const company: CompanyCase = {
    id,
    name: input.name,
    tagline: input.tagline,
    stage,
    stageLabel: STAGE_LABEL[stage],
    industry: input.industry,
    week: input.week,
    weeksInPeriod: input.weeksInPeriod,
    periodLabel: input.periodLabel,
    primaryObjective: PRIMARY_OBJECTIVE[stage],
    ...(input.website ? { website: input.website } : {}),
    sample: false,
    dataStatus: "awaiting_data",
  };
  const goal: BusinessGoal = {
    id: "g-top",
    label: g.label,
    kind: goalKind(g.label, g.unit),
    target: g.target,
    current: g.current,
    unit: g.unit,
    direction: treeDirection(g),
    deadline: g.deadline,
    setBy: "ceo",
  };
  const guardrails: Guardrails = {
    budgetTotal: input.budgetTotal,
    budgetSpent: 0,
    autonomyPct: input.autonomyPct,
    ...STAGE_GUARDRAILS[stage],
  };
  guardrails.maxShiftPerWeekPct = Math.max(guardrails.maxShiftPerWeekPct, input.autonomyPct);
  const tree: TreeNode = {
    id: "n-root",
    label: g.label,
    unit: g.unit,
    target: g.target,
    actual: g.current,
    forecast: g.current,
    owner: "ceo",
    ...templateChildren(stage),
  };
  return {
    case: company,
    headline: AWAITING_HEADLINE,
    goals: [goal],
    guardrails,
    tree,
    objectives: structuredClone(TEMPLATE_OBJECTIVES[stage]),
    metrics: [],
    actions: [],
    contributions: [],
    changes: [],
    decisions: [],
    log: [],
  };
}
