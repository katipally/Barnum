import type { ReactNode } from "react";
import type { GlossaryKey } from "@/lib/glossary";
import type { ObjectiveScore } from "@/lib/types";
import { Term } from "@/components/ui/Term";

// Plain-language names for revenue-equation parts and jargon inside agent-written text.
export interface Plain {
  text: string;
  k?: GlossaryKey;
  explain?: string;
}

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string), GlossaryKey?, string?];

const NODE_RULES: Rule[] = [
  [/^net new arr/i, "Net new yearly revenue", "newArr"],
  [/^gross new arr/i, "New yearly revenue before cancellations", "arr"],
  [/^new-logo arr/i, "Revenue from new customers", "arr"],
  [/^expansion arr/i, "Growth from existing customers", undefined, "Extra yearly revenue from customers who upgrade or buy more."],
  [/^churned arr/i, "Revenue lost to cancellations", "churn"],
  [/^expected new arr/i, "New yearly revenue", "arr"],
  [/^marketing-sourced sqls/i, "Qualified leads from marketing", "sql"],
  [/^sales-sourced sqls/i, "Qualified leads sales finds itself", "sql"],
  [/^sqls$/i, "Qualified leads", "sql"],
  [/^mqls$/i, "Marketing leads", "mql"],
  [/mql to sql/i, "Share accepted by sales", undefined, "Out of every 100 marketing leads, how many sales accepts as qualified."],
  [/^(win rate|sql to won)/i, "Win rate", "winRate"],
  [/average contract value|\bacv\b/i, "Deal size", "acv"],
  [/^mrr$/i, "Monthly recurring revenue", "mrr"],
  [/^(.*?)\s*\(arpa\)$/i, (m) => m[1], undefined, "What an average customer pays us per month."],
  [/logo retention/i, "Share of customers who stay", undefined, "Out of every 100 customers at the start of the quarter, how many are still paying."],
  [/trial-to-paid/i, "Share of trials that start paying", "conversion"],
  [/^household penetration/i, "Share of households that buy us", "penetration"],
  [/penetration where listed/i, "Share that buy us where we're on the shelf", "penetration"],
  [/weighted distribution/i, "Stores that stock us", "distribution"],
  [/^net revenue/i, "Revenue"],
];

export function plainNode(label: string): Plain {
  for (const [re, to, k, explain] of NODE_RULES) {
    const m = label.match(re);
    if (m) return { text: typeof to === "string" ? to : to(m), k, explain };
  }
  return { text: label };
}

// Lowercase for use mid-sentence, keeping acronyms ("ARR stays") intact.
export function inSentence(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

export function PlainLabel({ p, lower }: { p: Plain; lower?: boolean }) {
  const text = lower ? inSentence(p.text) : p.text;
  return p.k || p.explain ? (
    <Term k={p.k} explain={p.explain}>
      {text}
    </Term>
  ) : (
    <PlainText text={text} />
  );
}

interface TextRule {
  re: RegExp;
  to?: string; // omitted = keep the original words, only add the explanation
  k?: GlossaryKey;
  explain?: string;
}

const TEXT_RULES: TextRule[] = [
  { re: /net new ARR/i, to: "net new yearly revenue", k: "newArr" },
  { re: /CAC payback/, to: "payback time", k: "payback" },
  { re: /\bmarketing-sourced SQLs\b/i, to: "qualified leads from marketing", k: "sql" },
  { re: /\bmarketing SQLs\b/i, to: "qualified leads from marketing", k: "sql" },
  { re: /\bSQLs\b/, to: "qualified leads", k: "sql" },
  { re: /\bSQL\b/, to: "qualified lead", k: "sql" },
  { re: /\bMQLs\b/, to: "marketing leads", k: "mql" },
  { re: /\bMQL\b/, to: "marketing lead", k: "mql" },
  { re: /\bCAC\b/, to: "cost to win a customer", k: "cac" },
  { re: /\bICP\b/, to: "ideal customer", k: "icp" },
  { re: /\bARR\b/, to: "yearly revenue", k: "arr" },
  { re: /\bMRR\b/, to: "monthly revenue", k: "mrr" },
  { re: /\bACV\b/, to: "deal size", k: "acv" },
  { re: /\bARPA\b/, to: "revenue per customer", explain: "What an average customer pays us per month." },
  { re: /\bCTV\b/, to: "streaming TV", k: "ctv" },
  { re: /\bPMF\b/, to: "product-market fit", k: "pmf" },
  { re: /\bpromo ROI\b/i, to: "return on promotions", explain: "Money earned back per dollar of discount. Below 1 means the promotion lost money." },
  { re: /\blogo retention\b/i, to: "customers who stay", explain: "Out of every 100 customers, how many are still paying." },
  { re: /\bweighted distribution\b/i, to: "shelf availability", k: "distribution" },
  { re: /\bhousehold penetration\b/i, to: "household reach", k: "penetration" },
  { re: /\bpenetration\b/i, to: "household reach", k: "penetration" },
  { re: /\bshare of search\b/i, k: "shareOfSearch" },
  { re: /\bwin rate\b/i, k: "winRate" },
];

// Agent-written sentence with jargon swapped for plain words; each swap keeps a hover explanation.
export function PlainText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let pos = 0;
  while (pos < text.length) {
    const rest = text.slice(pos);
    let best: { i: number; m: string; rule: TextRule } | null = null;
    for (const rule of TEXT_RULES) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.i)) best = { i: m.index, m: m[0], rule };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.i > 0) out.push(rest.slice(0, best.i));
    const before = text.slice(0, pos + best.i).trimEnd();
    const startsSentence = before === "" || /[.!?:]$/.test(before);
    let words = best.rule.to ?? best.m;
    if (startsSentence) words = words[0].toUpperCase() + words.slice(1);
    out.push(
      <Term key={pos + best.i} k={best.rule.k} explain={best.rule.explain}>
        {words}
      </Term>,
    );
    pos += best.i + best.m.length;
  }
  return <>{out}</>;
}

const OBJECTIVE_RULES: [RegExp, ReactNode][] = [
  [/^cost per sql/i, <>Pay less per <Term k="sql">qualified lead</Term></>],
  [/sqls/i, <>Get more <Term k="sql">qualified leads</Term></>],
  [/cac payback/i, <>Win customers more cheaply</>],
  [/household penetration/i, <>Reach more <Term k="penetration">households</Term></>],
  [/top-of-mind|awareness/i, <>Be the brand shoppers think of first</>],
  [/weighted distribution/i, <>Get into more <Term k="distribution">stores</Term></>],
  [/retention/i, <>Keep more customers</>],
];

// A short "do this" title for an objective, from its north-star metric; falls back to the objective's own name.
export function ObjectiveTitle({ row }: { row: ObjectiveScore }) {
  const metric = row.northStar.label;
  const vs = metric.match(/^win rate vs (.+)$/i);
  if (vs) return <>Win more deals against {vs[1]}</>;
  for (const [re, title] of OBJECTIVE_RULES) if (re.test(metric)) return <>{title}</>;
  return <PlainText text={row.objective.label.replace(/\s*\([^)]*\)\s*$/, "")} />;
}
