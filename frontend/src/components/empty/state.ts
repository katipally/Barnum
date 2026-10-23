import type { CompanyCase, TreeNode } from "@/lib/types";

// A company created through onboarding that has goals and a template tree but no connected data yet.
export function isAwaiting(c: Pick<CompanyCase, "dataStatus">): boolean {
  return c.dataStatus === "awaiting_data";
}

// Template tree nodes start at 0 until a target is set or data provides one.
export function isUnset(n: Pick<TreeNode, "target">): boolean {
  return !n.target || !Number.isFinite(n.target);
}
