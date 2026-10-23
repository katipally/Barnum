# Plain-language rules (priority #1)

Audience: hackathon judges and CEOs who are smart but **not marketers**. Someone should understand any page in
10 seconds without help.

1. **One question per page, asked at the top in plain words.** e.g. "Where is our money going, and is it working?"
   Then answer it in one sentence before showing any detail.
2. **Sentences before numbers.** "Each qualified lead from LinkedIn costs $3,000 — almost twice Conferences." beats a
   table of CPS/marginal/MQL columns. Show at most 3–4 numbers per card.
3. **No unexplained jargon.** Prefer plain words ("qualified sales leads", "cost to win a customer"). When a term is
   needed, wrap it in `<Term k="sql">` (`src/components/ui/Term.tsx`, glossary in `src/lib/glossary.ts`) so a hover/tap
   explains it. If a term is missing from the glossary, pass `explain="…"` inline and list it in your report.
4. **Verdicts in words, not codes.** Spend more / Keep as is / Spend less / Still testing — each with a one-line why.
5. **Colour only means status.** Green = on track, amber = needs attention, red = off track, gold = the agent / the
   main action. Always pair colour with a word.
6. **Progressive disclosure.** Detail (evidence, methods, confidence, formulas) lives behind "Show the math" /
   "Show details", collapsed by default.
7. **Max ~5 items per list.** If there are more, show the top ones and a "Show all".
8. **Same vocabulary everywhere**: "goal", "plan", "channel", "qualified lead", "what I need from you".
9. Keep the dark war-room look, sentence case, no emoji, generous whitespace.
