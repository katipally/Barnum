# Build contract (parallel agents read this first)

Agentic CMO: a CMO agent that turns CEO business goals into a revenue tree, marketing objectives and
actions, evaluates them weekly, and asks the CEO only for the decisions that matter. Hackathon rule:
**dashboard must not be the main feature** — the agent's recommendations and the CEO's decisions are.
The UI is the surface for the agent.

## The model (4 layers)
1. **Business goals** (CEO/board): revenue, margin/burn, share, budget, guardrails.
2. **Revenue tree**: arithmetic decomposition of the top goal into drivers (e.g. revenue = households × buy rate × price).
3. **Marketing objectives**: targets on the drivers marketing can move, each with a north-star metric.
4. **Actions**: campaigns/programs. Linked N:N to objectives via `Contribution` (weight, method, confidence).
Evaluation = weekly metric series + derived status; Decisions = changes above the autonomy limit.

Three cases (all fictional, no real company data): `pre-pmf`, `scale-up` (heavy competition), `cpg` (toothpaste brand).

## Shared files (owned by the lead — do not edit, ask in your final report if something is missing)
- `src/lib/types.ts` — domain model + API payloads. **Source of truth.**
- `src/lib/api.ts` — typed fetch client + `useApi` hook. UI only talks to the server through this.
- `src/lib/case.ts` — active case lives in `?case=` (`useCaseId`, `useSetCase`, `withCase`). Needs a `<Suspense>` ancestor.
- `src/lib/format.ts` — `fmt(value, unit)`, `money`, status/verdict class maps.
- `src/components/ui/index.tsx` — Card, SectionTitle, StatusDot, StatusLabel, VerdictTag, Button, Skeleton, ErrorNote, cx.
- `src/app/globals.css` — Tailwind v4 theme tokens: `bg-bg bg-surface bg-surface-2 bg-surface-3 border-line border-line-strong text-ink text-muted text-faint text-gold bg-gold bg-gold-soft text-ok/warn/bad/info bg-ok/warn/bad/info`.

## Ownership (write only inside your paths)
| Agent | Paths |
|---|---|
| server | `src/server/**`, `src/app/api/**`, `INTEGRATION.md` |
| seeds | `src/data/**` |
| brief (CEO weekly view) | `src/app/page.tsx`, `src/components/brief/**` |
| strategy | `src/app/strategy/**`, `src/app/evaluation/**`, `src/components/strategy/**`, `src/components/evaluation/**` |
| shell | `src/app/layout.tsx`, `src/components/shell/**`, `src/components/chat/**`, `src/app/goals/**`, `src/components/goals/**` |
| demo | `src/components/demo/**`, `DEMO.md` |
| video | `video/**` (separate npm project) |

## API (implemented by server under `src/app/api`)
| Method | Path | Returns |
|---|---|---|
| GET | `/api/cases` | `CaseSummary[]` |
| GET | `/api/cases/[caseId]/brief` | `WeeklyBrief` |
| GET | `/api/cases/[caseId]/strategy` | `StrategyMap` |
| GET | `/api/cases/[caseId]/metrics` | `Metric[]` |
| POST | `/api/cases/[caseId]/decisions/[decisionId]` body `{status, note?}` | `Decision` |
| PATCH | `/api/cases/[caseId]/steering` body `SteeringUpdate` | `WeeklyBrief` (recomputed) |
| POST | `/api/cases/[caseId]/ask` body `{question}` | streamed `text/plain` |

Seeds export `seeds: Record<CaseId, CaseData>` from `src/data/seeds/index.ts`. Server derives status,
verdicts, scores, pacing; seeds only provide raw data (they may omit `verdict`, `score`, `status`).

## Demo tour anchors
Put `data-tour="<id>"` on the outermost element of these sections (the demo tour spotlights them):
`case-switcher`, `ask-cmo`, `nav` (shell) · `headline`, `goals`, `revenue-tree`, `scorecard`, `decisions`,
`autonomy-log` (brief) · `strategy-map`, `action-detail`, `evaluation` (strategy) · `steering` (goals page).
Demo exports `<TourLauncher />` from `src/components/demo/TourLauncher.tsx`; shell renders it in the header.

## Rules for every agent
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4. **No new npm deps** in the app (video is separate).
- Pages are client components (`"use client"`) that fetch via `api` + `useApi` and read the case with `useCaseId()`.
- **Do not start dev servers and do not run `next build`** (shared `.next`). Check your work with
  `npx tsc --noEmit -p .` (ignore errors in files you don't own) and `npx eslint <your files>`.
- Do not commit. Do not touch files outside your paths.
- Copy: sentence case, short, British-neutral English, no emoji. Numbers through `fmt`/`money`.
- Visual style: dark war room, hairline borders, generous spacing, gold only for the agent's voice/primary action, status colours only for status.

## v2: product, not demo (supersedes the "three cases" parts above)
- Companies are **workspaces**. `CaseId` is now `string` (a slug). Sample companies ship from seeds with ids
  `fieldnote`, `tessellate`, `brightwell` (`sample: true`, `dataStatus: "sample"`). Users create their own via
  onboarding (`CompanyInput`) → persisted server-side in `.data/companies.json` (git-ignored) → `dataStatus: "awaiting_data"`
  until real data is connected (then `"connected"`).
- Active company is in `?company=<id>` (`useCaseId`, `useSetCase(id, href?)`, `withCase`). Default `tessellate`;
  the shell redirects to the last-opened company (localStorage `cmo.company`) when the param is missing.
- API moved from `/api/cases` to **`/api/companies`**: `GET /api/companies` → `CaseSummary[]`, `POST /api/companies`
  (`CompanyInput`) → `CaseSummary`, `DELETE /api/companies/[id]` (non-sample only), and every per-company route
  under `/api/companies/[id]/…` (brief, strategy, metrics, decisions/[decisionId], steering, ask, reset).
- No "demo" in the product UI. The guided tour stays available only via `?tour=1`.
- Every view must handle a company with `dataStatus: "awaiting_data"`: goals and a stage-template revenue tree
  exist (node targets may be 0 = not set), but metrics, actions, contributions, decisions, changes and log are empty.
