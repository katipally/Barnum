import type { Status, TreeNode } from "@/lib/types";

const LOWER_IS_BETTER = /churn|cost|cac|burn|payback/i;

// How close a node's forecast gets to its target (1 = exactly on target, lower = worse).
export function attainment(n: TreeNode): number {
  if (!n.target) return 1;
  return LOWER_IS_BETTER.test(n.label) ? n.target / Math.max(n.forecast, 1e-9) : n.forecast / n.target;
}

// The critical path: from the top goal, keep stepping into the child that is furthest behind.
export function gapPath(root: TreeNode): TreeNode[] {
  const path = [root];
  let node = root;
  while (node.children?.length) {
    const worst = [...node.children].sort((a, b) => attainment(a) - attainment(b))[0];
    if (attainment(worst) >= 1) break; // nothing below is behind; the gap is here
    path.push(worst);
    node = worst;
  }
  return path;
}

export const STATUS_WORD: Record<Status, string> = {
  on_track: "On track",
  at_risk: "Needs attention",
  off_track: "Off track",
};

// Lowercase a label for use mid-sentence without breaking acronyms ("Net new ARR" → "net new ARR").
export function inSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}
