// Scene timing for the storyline, driven by the narration's word timestamps (src/story/voiceover.json).
import script from "./script.json";
import vo from "./voiceover.json";
import { FPS } from "../theme";

export type Word = { w: string; start: number; end: number };
type Voiceover = Record<string, { duration: number; words: Word[] }>;

export const LEAD = Math.round(0.35 * FPS); // silence before each line
const TAIL = Math.round(0.7 * FPS);
const END_TAIL = Math.round(2 * FPS);

export const STORY = script.map((s, i) => {
  const v = (vo as Voiceover)[s.id];
  const tail = i === script.length - 1 ? END_TAIL : TAIL;
  return { id: s.id, text: s.text, words: v.words, frames: LEAD + Math.ceil(v.duration * FPS) + tail };
});

export const STORY_FRAMES = STORY.reduce((n, s) => n + s.frames, 0);

export const sceneOf = (id: string) => {
  const s = STORY.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]/g, "");

/** Frame (within the scene) when a word is spoken; `nth` picks a later occurrence. */
export function wordAt(id: string, word: string, nth = 0): number {
  const target = norm(word);
  const hits = sceneOf(id).words.filter((w) => norm(w.w).startsWith(target));
  const hit = hits[nth] ?? hits[0];
  if (!hit) throw new Error(`"${word}" not spoken in ${id}`);
  return LEAD + Math.round(hit.start * FPS);
}
