// Shared marker for the deep-dive notes turn, so providers can recognise it without importing the store.
import type { AgentTurn } from "./provider";

export const NOTES_PREFIX = "Notes from our earlier deep dives";

const STOP = new Set("about after again also because before could does doing from have into just more much only really right should still than that their them then there these they this what when where which while will with would your".split(" "));
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z][a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);

/** The earlier conclusion most related to the question, if the history carries deep-dive notes. */
export function relatedNote(question: string, turns?: AgentTurn[]): { title: string; text: string } | null {
  const notes = turns?.[0]?.role === "user" && turns[0].text.startsWith(NOTES_PREFIX) ? turns[0].text : "";
  const q = words(question);
  let best: { title: string; text: string; score: number } | null = null;
  for (const line of notes.split("\n")) {
    const m = line.match(/^- "(.+?)": (.+?) Recommendation:/);
    if (!m) continue;
    const score = [...words(line)].filter((w) => q.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { title: m[1], text: m[2], score };
  }
  return best && { title: best.title, text: best.text };
}
