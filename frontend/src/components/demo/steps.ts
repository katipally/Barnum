import type { CaseId } from "@/lib/types";

export interface TourStep {
  route: "/" | "/breakdown" | "/strategy" | "/evaluation" | "/goals";
  caseId?: CaseId; // omitted = keep the active company
  anchor: string; // matches data-tour="…"
  title: string;
  body: string; // at most two sentences
}

// The tour story: mostly Tessellate (scale-up), then the same agent on Brightwell and Fieldnote.
export const TOUR_STEPS: TourStep[] = [
  {
    route: "/",
    caseId: "tessellate",
    anchor: "goals",
    title: "The CEO sets the goal",
    body: "Tessellate sells software to AI teams and competes with a bigger rival, Gridlabel. The CEO sets the goals and the budget for the quarter; the agent works out the rest.",
  },
  {
    route: "/",
    caseId: "tessellate",
    anchor: "headline",
    title: "The week in one sentence",
    body: "Every Monday the agent reads the latest numbers and says, in one line, whether we'll hit the goal. No dashboards to decode.",
  },
  {
    route: "/",
    caseId: "tessellate",
    anchor: "revenue-tree",
    title: "It finds the one number that's behind",
    body: "The revenue goal is split into the few numbers that add up to it. The agent follows them down to the one that's furthest behind, so nobody argues about where the problem is.",
  },
  {
    route: "/breakdown",
    caseId: "tessellate",
    anchor: "scorecard",
    title: "How we reach the goal",
    body: "Marketing only takes on the numbers it can actually move. Each gets one clear measure, a target and a forecast of where it will land.",
  },
  {
    route: "/",
    caseId: "tessellate",
    anchor: "decisions",
    title: "Only the big calls reach the CEO",
    body: "Moves above the CEO's limit, spending somewhere new or touching the brand budget come here with the evidence behind them. One click to approve, and every answer is recorded.",
  },
  {
    route: "/",
    caseId: "tessellate",
    anchor: "autonomy-log",
    title: "Small moves, made on its own",
    body: "Below the limit the agent just acts: it shifts small amounts, pauses what isn't working and starts tests. Every move is written down with its amount.",
  },
  {
    route: "/strategy",
    caseId: "tessellate",
    anchor: "strategy-map",
    title: "Where the money goes",
    body: "Every channel, ranked by budget, with one plain call: spend more, keep as is, spend less or still testing. The call is based on what the next qualified lead would cost there.",
  },
  {
    route: "/evaluation",
    caseId: "tessellate",
    anchor: "evaluation",
    title: "Numbers we watch, with sources",
    body: "Every number shows its weekly trend against target and where it came from. Early signals warn weeks before revenue moves.",
  },
  {
    route: "/goals",
    caseId: "tessellate",
    anchor: "steering",
    title: "The CEO sets the limits",
    body: "Change a target, the budget or how much the agent may move on its own, and the plan updates on the spot. The money kept for brand building can only be changed by a person.",
  },
  {
    route: "/goals",
    caseId: "tessellate",
    anchor: "ask-cmo",
    title: "Ask Barnum",
    body: "Ask in plain words, like \"Why is LinkedIn so expensive?\" Claude answers with live numbers from Snowflake (Cortex Analyst) and context from sales call notes (Cortex Search).",
  },
  {
    route: "/",
    caseId: "brightwell",
    anchor: "headline",
    title: "Same agent, different company",
    body: "Brightwell is a well-known toothpaste brand, so the aim is to get more households buying it, not to sell more through discounts. The agent protects brand spending and goes after new buyers.",
  },
  {
    route: "/",
    caseId: "fieldnote",
    anchor: "headline",
    title: "Learning before growing",
    body: "Fieldnote is an early startup still finding customers who stay. The agent spends small amounts to learn what works, with a strict cap on cash burn. Same agent; the company's stage sets the aim.",
  },
];
