# Barnum: demo kit

This file has everything for presenting: setup, a 3-minute live script, a 1-minute video script, likely judge questions and a one-paragraph pitch. All of it is built on the live backend over Snowflake `CMO_DB`, using Datasaur Foundry's Q4. The numbers below come from the running API on 2026-10-23, and `tests/test_numbers.py` checks them. They are **demo values**, so say so once on stage.

**Judging criteria** (official rules §10, no weights given): Impact · Demo · Creativity · Craft with Snowflake and Claude.

Rule for every claim: **only say what is in the repo.** Ideas that aren't built go under "next", never "live".

---

## Set-up before going on stage

1. Backend: `uv run uvicorn backend.app.main:app --port 8000`, then check that `curl localhost:8000/health` returns `{"ok":true}`.
2. Reset and stage the week:
   ```bash
   curl -X POST localhost:8000/demo/reset        # clears decisions, restores the seed
   curl -X POST localhost:8000/q4/reallocate     # writes this week's memo (pending, above the limit)
   # once per database: the CEO's Q4 goal (without it the headline says "No target set yet")
   curl -X PUT localhost:8000/assumptions/Q4_SQL_TARGET -H 'content-type: application/json' -d '{"num":50}'
   ```
   With the target set, the headline reads "heading for $899k of our $900k" before approval. After approval it reads $926k.
3. Frontend: `cd frontend && npm run dev` with `CMO_PROVIDER=cmo-api` in `.env.local`. Open the live company (the first card, "Live from Snowflake") at 1440 × 900, zoom 100%.
4. Open a terminal tab in `CMO-Agent` with the webinar command already typed (beat 4): `uv run python -m seed.load webinars`.
5. Copy the Ask question: *"Why do you want to take money away from LinkedIn when it brings us the most leads?"*
6. Fallback: a screen recording of the full run. If Snowflake is slow, play it and narrate.

---

## A. Live demo: 3 minutes

**[Snowflake]** and **[Claude]** mark where each platform does the work. **[Governance]** marks a control the judges should see.

| Time | Screen and clicks | Talk track | Scores on |
|---|---|---|---|
| 0:00–0:15 | Brief page for the live company; nothing clicked yet. | "Every CEO asks one question about marketing: what does the next dollar buy? Today the answer is a dashboard and a Monday meeting. We built an agent that answers with decisions." | Impact |
| 0:15–0:40 | Headline and goals strip. | "Datasaur Foundry is halfway through Q4: $63k spent, 140 MQLs, 25 SQLs, $2,520 per SQL. These are demo numbers. The agent lives in Snowflake: one Claude agent per channel, each reading its own platform's raw data and reporting in one currency, cost per SQL." **[Snowflake]** "Each channel has its own schema, semantic view and Cortex Agent. The CMO agent only sees the shared funnel." | Demo, Craft |
| 0:40–1:15 | Changes and the channel list: LinkedIn next to Conferences. | "Here's the finding a dashboard hides. LinkedIn has the cheapest MQLs of all four channels, $276 each, but only 9% of them become SQLs, so each SQL costs $3,000. Conferences deliver SQLs at $1,714. Judged on MQLs, LinkedIn wins more budget; judged on SQLs, it loses $6,000." **[Snowflake]** "Every number is SQL over `Q4_PROJECTION`, and the API returns the query with it. Claude never computes a figure." | Impact, Craft |
| 1:15–1:50 | Open the decision "Move $14k of the last $62k into Conferences"; read the evidence rows; click **Approve**. | "The agent fits a diminishing-returns curve per channel and allocates the remaining $62k for the most SQLs. That moves $14k, more than the 10% of the remaining budget the CEO lets it move alone ($6.2k), so it asks. Same budget, projected SQLs 24.9 → 26.5 for the rest of the quarter." Click Approve, then **reload the page**: the headline moves from $899k to $926k against the $900k goal. **[Governance]** "Approving writes `ALLOCATION` and `DECISION_LOG` in Snowflake: who decided and when. A second approve is refused." | Impact, Demo |
| 1:50–2:20 | **Ask the CMO**: paste the question and let it stream. | **[Claude]** "This is the CMO Cortex Agent on Claude. It doesn't guess; it calls `ASK_CHANNEL`, which runs the LinkedIn agent through `DATA_AGENT_RUN`, and answers from that agent's own data." | Craft, Demo |
| 2:20–2:45 | Terminal: run `uv run python -m seed.load webinars`, then refresh the app. | "New channel? It's a CSV. Claude writes the SQL that maps it onto our funnel with `AI_COMPLETE`. A validator checks it: spend must reconcile to the dollar and MQLs ≥ SQLs ≥ won. Then the template provisions the channel's schema, semantic view and agent. Webinars now appear in the funnel and the next review." **[Governance]** "A mapping goes live only after it passes validation." | Creativity, Craft |
| 2:45–3:00 | **Goals** page, then back to the brief. | "The CEO steers the guardrails, not the campaigns. And the same curves plan next year: $1M buys about 45 customers at an 8.8-month payback, and spend above $1.3M stops paying back within a year. The CEO steers; the agent runs marketing." | Impact |

**If you are behind**, skip the Ask beat and say: "the CMO can also question any channel agent directly; it's in the repo."
**If you are ahead**, show `GET /plan/scenarios?budget=1000000&rule=12mo` or the Snowsight trace of a `/q4/review` run, where the channel agents report in parallel.
**If Snowflake fails**, play the recording and say plainly that it's a recording.

---

## B. 1-minute video script

About 130 words of voice-over. Record from a live run after `/demo/reset`.

| Seconds | Screen | Voice-over | Caption |
|---|---|---|---|
| 0–6 | Brief page | "Every CEO asks what the next marketing dollar buys. Barnum answers with decisions, not dashboards." | Decisions, not dashboards |
| 6–18 | Goals strip, channel list | "It runs inside Snowflake: one Claude agent per channel, each reading its own raw data and reporting in one currency, cost per qualified lead." | One agent per channel · one currency |
| 18–30 | LinkedIn vs Conferences | "First finding: LinkedIn has the cheapest leads and some of the most expensive pipeline. Only nine percent of its leads become sales-qualified." | Cheapest leads ≠ cheapest pipeline |
| 30–42 | Decision, Approve | "The fix moves more than the ten percent the CEO lets it move alone, so it asks. One click: same budget, more pipeline, logged in Snowflake." | Acts within limits · asks above them |
| 42–54 | Terminal webinar load, app refresh | "New channel? Upload a CSV. Claude writes the SQL, a validator reconciles every dollar, and a new agent joins the team." | New channel = one CSV |
| 54–60 | End card + repo URL | "Barnum. The CEO steers; the agent runs marketing." | github.com/katipally/CMO-Agent |

---

## C. Likely judge questions

**How is this not a dashboard?**
The output is a decision with evidence and an approve button, not a chart. Below the autonomy limit the agent applies moves itself and logs them; above it, it writes a memo. The numbers on screen exist to back up a decision.

**Where do the numbers come from?**
SQL and stored procedures in `CMO_DB`. `FUNNEL_FACT` is the union of every channel's validated `MAP` view, and `Q4_PROJECTION`, `PROPOSE_REALLOCATION` and `UNIT_ECON` compute everything else. Every deterministic API response includes the SQL that produced it. Claude plans, delegates, explains and writes the memo text.

**How does the reallocation work?**
Each channel gets a diminishing-returns curve, `SQLs = S·(y/X)^b` with b < 1, fitted from its spend and SQLs this period. The remaining budget is allocated greedily in steps over a max-heap. Because every curve is concave, that greedy allocation is optimal. All the assumptions (exponents, ACV, win rate, autonomy limit) sit in one `ASSUMPTIONS` table, editable through `PUT /assumptions/{key}`.

**Isn't a power curve from half a quarter too simple?**
Yes, and that's deliberate: it's transparent and testable, and the memo says that's its risk. The next step is holdout tests and a proper mix model. Better attribution plugs in behind the same memo contract.

**What does Claude actually do?**
Three things:
- The CMO Cortex Agent reasons over the funnel and writes the memo.
- It delegates questions to channel agents through `ASK_CHANNEL` (`DATA_AGENT_RUN`).
- At onboarding, `AI_COMPLETE` with structured output writes each new channel's mapping SQL, which the validator checks before anything goes live.

**Where is the governance?**
- **Isolation:** a channel agent's tools only touch its own schema, and the CMO reads only `CORE`.
- **Bounded autonomy:** the `AUTONOMY_LIMIT_PCT` assumption sets how much the agent can move alone; anything bigger goes to the CEO.
- **Validation:** no mapping goes live without passing it.
- **Audit:** every decision is in `DECISION_LOG`.

Not built yet (say "next"): a dedicated least-privilege Snowflake role per agent and Cortex Guardrails.

**Does it generalise beyond these four channels?**
Any channel is a CSV plus a one-line description; that's the webinar beat. The other company cards in the app are sample workspaces on mock data for other company stages. Present them as design, not as Snowflake-backed.

**What's next?**
Run it read-only for one real quarter as a shadow CMO and compare its memos with what the team did. Then add holdout tests, a least-privilege role per agent, and write access to ad platforms behind the same autonomy limit.

---

## D. One-paragraph pitch

Every CEO asks what the next marketing dollar buys, and today the answer is a dashboard and a meeting. Barnum is a marketing executive that lives in Snowflake. One Claude orchestrator manages one isolated Cortex Agent per channel, and each turns its platform's raw data into a single currency: cost per sales-qualified lead. On that basis it finds what dashboards hide. LinkedIn has the cheapest leads and some of the most expensive pipeline. The agent reallocates the remaining budget along each channel's response curve. It acts alone within a limit the CEO sets and asks above it, with every number coming from SQL and every decision logged. A new channel is just a CSV: Claude writes the mapping, a validator reconciles every dollar, and a new agent joins the team.
