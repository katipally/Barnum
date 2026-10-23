// Plain-language questions and explanations for metric labels. Unknown metrics fall back to their label.
import type { GlossaryKey } from "@/lib/glossary";

type Copy = { q?: string; k?: GlossaryKey; explain?: string };

const BY_ID: Record<string, Copy> = {
  // Tessellate
  "m-mkt-sqls": { q: "How many qualified sales leads does marketing bring in each week?", k: "sql" },
  "m-pipeline-created": { q: "How much new deal value does marketing create each week?", k: "pipeline" },
  "m-demo-requests": { q: "How many people ask for a demo each week?" },
  "m-conf-share": { q: "How much of our deal value starts at conferences?", k: "attribution" },
  "m-winrate": { q: "How many of our deals do we win?", k: "winRate" },
  "m-win-gridlabel": { q: "How often do we beat Gridlabel, our main rival?", k: "winRate" },
  "m-cac-payback": { q: "How fast does a new customer pay back what it cost to win them?", k: "payback" },
  "m-cost-per-sql": { q: "What does one qualified sales lead cost us?", k: "sql" },
  "m-burn-multiple": {
    q: "How much cash do we burn for each dollar of new yearly revenue?",
    explain: "Cash burned for every $1 of new yearly revenue. Lower is better.",
  },
  "m-sos": { q: "When people search for “LLM evaluation”, how often do they look for us?", k: "shareOfSearch" },
  "m-cpconv-llm": { q: "What does one conversion from “LLM evaluation” searches cost?", k: "conversion" },
  // Brightwell
  "m-penetration": { q: "How many households bought us in the last year?", k: "penetration" },
  "m-new-buyers": { q: "How many of our buyers are new to the brand?" },
  "m-value-share": { q: "What share of all category sales is ours?", explain: "Our share of all money spent in the category." },
  "m-salience": {
    q: "Do people think of us first?",
    explain: "The share of people who name us first when asked about the category, without any hint.",
  },
  "m-ctv-cpih": { q: "What does streaming TV pay to win one extra household?", k: "ctv" },
  "m-wd": { q: "Do the stores that matter stock us?", k: "distribution" },
  "m-northway-wd": { q: "Are we on the shelf at Northway Markets?", k: "distribution" },
  "m-price-index": {
    q: "Can we still charge more than our rivals?",
    explain: "Our price compared with the category average, where 100 means the same price.",
  },
  "m-promo-share": { q: "How much do we sell only because of deep discounts?", k: "promo" },
  "m-promo-roi": {
    q: "Do discount promotions pay for themselves?",
    explain: "Profit earned back for every $1 spent on discounts. Below 1 means we lose money.",
  },
  "m-gross-margin": { q: "How much do we keep from each sale?", explain: "What is left of each sale after the cost of making it." },
  // Fieldnote
  "m-trials-week": { q: "How many clinics start a free trial each week?" },
  "m-t2p": { q: "How many trials turn into paying clinics?", k: "conversion" },
  "m-multisite-share": { q: "Are we reaching the bigger, multi-site clinics?", k: "icp" },
  "m-reply-rate": { q: "Do clinics reply positively to our outreach?" },
  "m-lp-cvr": { q: "Does our website turn visitors into trials?", k: "conversion" },
  "m-cost-per-paid": { q: "What does it cost to win one paying clinic?", k: "cac" },
  "m-retention": { q: "Do clinics stay with us?", explain: "The share of clinics still paying after 90 days." },
  "m-ret-multi": { q: "Do multi-site clinics stay?", explain: "The share of multi-site clinics still paying after 60 days." },
  "m-ret-solo": { q: "Do solo clinics stay?", explain: "The share of solo clinics still paying after 60 days." },
  "m-pmf-score": { q: "Would users be very disappointed to lose us?", k: "pmf" },
  "m-activation": { q: "Are clinics actually using the product?" },
  // Acme (live)
  "m-sqls": { q: "How many qualified sales leads have we won this period?", k: "sql" },
  "m-cps": { q: "What does one qualified sales lead cost us?", k: "sql" },
  "m-cpm": { q: "What does one marketing lead cost us?", k: "mql" },
  "m-mql2sql": { q: "How many interested people become qualified sales leads?", k: "mql" },
  "m-payback": { q: "How fast does a new customer pay back what it cost to win them?", k: "payback" },
};

const BY_WORD: [RegExp, GlossaryKey][] = [
  [/\bSQLs?\b/, "sql"],
  [/\bMQLs?\b/, "mql"],
  [/payback/i, "payback"],
  [/\bCAC\b/, "cac"],
  [/win rate/i, "winRate"],
  [/pipeline/i, "pipeline"],
  [/share of search/i, "shareOfSearch"],
  [/penetration/i, "penetration"],
  [/distribution/i, "distribution"],
  [/churn/i, "churn"],
  [/\bARR\b/, "arr"],
  [/\bMRR\b/, "mrr"],
  [/conversion/i, "conversion"],
];

export function metricCopy(id: string, label: string): Copy {
  const known = BY_ID[id];
  if (known) return known;
  return { k: BY_WORD.find(([re]) => re.test(label))?.[1] };
}

// Lowercase a label for use mid-sentence without breaking acronyms ("CAC payback" stays).
export function inSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}
