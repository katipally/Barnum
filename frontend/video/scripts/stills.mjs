// Renders a few stills per scene (no full render). Usage: node scripts/stills.mjs <outDir> <sceneId> [sceneId ...] [--at=0.3,0.6,0.95]
// Frame maths mirrors src/story/timing.ts (LEAD 0.35 s, TAIL 0.7 s, last scene 2 s).
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FPS = 30, LEAD = Math.round(0.35 * FPS), TAIL = Math.round(0.7 * FPS), END = Math.round(2 * FPS);
const script = JSON.parse(readFileSync("src/story/script.json", "utf8"));
const vo = JSON.parse(readFileSync("src/story/voiceover.json", "utf8"));
const args = process.argv.slice(2);
const out = args.shift();
const atArg = args.find((a) => a.startsWith("--at="));
const at = atArg ? atArg.slice(5).split(",").map(Number) : [0.3, 0.6, 0.95];
const ids = args.filter((a) => !a.startsWith("--"));
let from = 0;
const starts = {};
script.forEach((s, i) => {
  const frames = LEAD + Math.ceil(vo[s.id].duration * FPS) + (i === script.length - 1 ? END : TAIL);
  starts[s.id] = { from, frames };
  from += frames;
});
mkdirSync(out, { recursive: true });
for (const id of ids) {
  const s = starts[id];
  if (!s) throw new Error(`unknown scene ${id}`);
  for (const p of at) {
    const frame = s.from + Math.min(s.frames - 1, Math.round(s.frames * p));
    const file = `${out}/${id}-${Math.round(p * 100)}.png`;
    execFileSync("npx", ["remotion", "still", "src/index.ts", "Storyline", file, `--frame=${frame}`, "--scale=0.5", "--log=error"], { stdio: "inherit" });
    console.log(file);
  }
}
