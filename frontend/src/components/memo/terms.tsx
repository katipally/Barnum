import type { ReactNode } from "react";
import { Term } from "@/components/ui/Term";
import type { GlossaryKey } from "@/lib/glossary";

// Data labels (tree nodes, goals, objectives) mapped to the glossary entry that explains them. First match wins.
const LABEL_TERMS: [RegExp, GlossaryKey][] = [
  [/net new arr/i, "newArr"],
  [/churn/i, "churn"],
  [/win rate|to won/i, "winRate"],
  [/\bMQL/, "mql"],
  [/\bSQL/, "sql"],
  [/\bCAC\b|payback/i, "payback"],
  [/\bARR\b/, "arr"],
  [/\bMRR\b/, "mrr"],
  [/burn/i, "burn"],
  [/penetration/i, "penetration"],
  [/distribution/i, "distribution"],
  [/\bACV\b|contract value|\bARPA\b/i, "acv"],
  [/share of search/i, "shareOfSearch"],
  [/\bPMF\b|product-market fit/i, "pmf"],
  [/\bICP\b|ideal customer/i, "icp"],
  [/\bCTV\b/, "ctv"],
  [/pipeline/i, "pipeline"],
];

export function termKey(label: string): GlossaryKey | undefined {
  return LABEL_TERMS.find(([re]) => re.test(label))?.[1];
}

// Shows a data label as-is, with a hover explanation when it contains a known term.
export function LabelTerm({ label, children }: { label: string; children?: ReactNode }) {
  const k = termKey(label);
  return k ? <Term k={k}>{children ?? label}</Term> : <>{children ?? label}</>;
}
