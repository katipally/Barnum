import type { Status, TreeNode, Unit } from "@/lib/types";
import { fmt, round } from "@/lib/format";
import { isUnset } from "@/components/empty/state";

export const OP_SYMBOL: Record<NonNullable<TreeNode["op"]>, string> = {
  sum: "+",
  product: "×",
  minus: "−",
};

export type Sign = "+" | "−" | "×";
export const SIGN_WORD: Record<Sign, string> = { "+": "plus", "−": "minus", "×": "times" };

// Status of one part of the equation; "unset" = no target yet.
export type PartStatus = Status | "unset";

export const PART_WORD: Record<PartStatus, string> = {
  on_track: "On track",
  at_risk: "Slightly behind",
  off_track: "Behind",
  unset: "Not set",
};
export const PART_TEXT: Record<PartStatus, string> = {
  on_track: "text-ok",
  at_risk: "text-warn",
  off_track: "text-bad",
  unset: "text-muted",
};
export const PART_BAR: Record<PartStatus, string> = {
  on_track: "bg-ok",
  at_risk: "bg-warn",
  off_track: "bg-bad",
  unset: "bg-faint",
};

const LOWER_IS_BETTER = /churn|cost|cac|burn|payback|lost/i;

export function lowerIsBetter(n: Pick<TreeNode, "label">): boolean {
  return LOWER_IS_BETTER.test(n.label);
}

// Forecast against target, direction-aware: 1 = exactly on target, lower = further behind.
export function attainment(n: TreeNode): number {
  if (isUnset(n)) return Infinity;
  return lowerIsBetter(n) ? n.target / Math.max(n.forecast, 1e-9) : n.forecast / n.target;
}

export function partStatus(n: TreeNode, pending?: boolean): PartStatus {
  if (pending || isUnset(n)) return "unset";
  if (n.status) return n.status;
  const a = attainment(n);
  return a >= 0.99 ? "on_track" : a >= 0.9 ? "at_risk" : "off_track";
}

export interface Part {
  node: TreeNode;
  sign: Sign | null; // operator in front of this part; null for the first
}

// The parts a node is made of. Sums nested in sums are inlined so "A + B − C" reads as one line.
export function parts(n: TreeNode): Part[] {
  const kids = n.children ?? [];
  if (n.op === "product") return kids.map((k, i) => ({ node: k, sign: i ? "×" : null }));
  const out: Part[] = [];
  kids.forEach((k, i) => {
    const negative = n.op === "minus" && i > 0;
    const inline = !negative && k.op === "sum" && !!k.children?.length;
    const group = inline ? parts(k).map((p) => p.node) : [k];
    for (const node of group) out.push({ node, sign: out.length === 0 ? null : negative ? "−" : "+" });
  });
  return out;
}

// From a node, keep stepping into the part that is furthest behind. Empty = nothing is behind.
export function gapPath(n: TreeNode): TreeNode[] {
  const behind = parts(n)
    .map((p) => p.node)
    .filter((k) => {
      const s = partStatus(k);
      return s === "at_risk" || s === "off_track";
    });
  if (behind.length === 0) return [];
  const worst = behind.reduce((a, b) => (attainment(b) < attainment(a) ? b : a));
  return [worst, ...gapPath(worst)];
}

export function shortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// fmt, but keeps two decimals for small prices and counts ($4.44 vs $4.47, 1.6 purchases) so they don't round to equal.
export function num(v: number, unit: Unit): string {
  if (unit === "usd" && Math.abs(v) < 100 && v % 1 !== 0) return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
  if (unit === "count" && Math.abs(v) < 10 && v % 1 !== 0) return round(v, 2);
  return fmt(v, unit);
}
