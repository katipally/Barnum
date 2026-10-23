import type { CaseId } from "@/lib/types";

const BY_COMPANY: Record<string, string[]> = {
  tessellate: [
    "Why is LinkedIn so expensive?",
    "What would you do with an extra $50k?",
    "Are we winning against Gridlabel?",
  ],
  fieldnote: ["Which customers should we focus on?", "Why stop the Google ads test?", "What would you do with an extra $10k?"],
  brightwell: ["Why not just run more discounts?", "How do we get more households to buy us?", "What would you do with an extra $1M?"],
  acme: ["Where is our money working best?", "Why does each qualified lead cost so much?", "What would you do with an extra $50k?"],
};

// For companies the user created themselves.
export const GENERIC_QUESTIONS = [
  "What do you need from me to get started?",
  "How would you split my budget?",
  "What would you try first?",
];

export function suggestionsFor(caseId: CaseId): string[] {
  return BY_COMPANY[caseId] ?? GENERIC_QUESTIONS;
}

// Index-style access kept for existing callers; unknown ids get the generic questions.
export const SUGGESTED_QUESTIONS: Record<CaseId, string[]> = new Proxy(BY_COMPANY, {
  get: (target, key) => (typeof key === "string" ? (target[key] ?? GENERIC_QUESTIONS) : undefined),
});
