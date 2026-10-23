// Renders stills of every Submission60 scene and tiles them into one contact sheet. Usage: node scripts/contact-submission.mjs <outDir> [--at=0.5,0.95]
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FPS = 30, LEAD = 6, TAIL = 10, END = 48;
const script = JSON.parse(readFileSync("src/submission/script.json", "utf8"));
const vo = JSON.parse(readFileSync("src/submission/voiceover.json", "utf8"));
const out = process.argv[2];
const atArg = process.argv.find((a) => a.startsWith("--at="));
const at = atArg ? atArg.slice(5).split(",").map(Number) : [0.5, 0.95];
rmSync(`${out}/frames`, { recursive: true, force: true });
mkdirSync(`${out}/frames`, { recursive: true });
let from = 0, n = 0;
script.forEach((s, i) => {
  const len = LEAD + Math.ceil(vo[s.id].duration * FPS) + (i === script.length - 1 ? END : TAIL);
  for (const p of at) {
    const frame = from + Math.min(len - 1, Math.round(len * p));
    const file = `${out}/frames/${String(n++).padStart(2, "0")}-${s.id}-${Math.round(p * 100)}.png`;
    execFileSync("npx", ["remotion", "still", "src/index.ts", "Submission60", file, `--frame=${frame}`, "--scale=0.5", "--log=error"], { stdio: "inherit" });
  }
  from += len;
});
const cols = at.length * 2;
const rows = Math.ceil(n / cols);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-pattern_type", "glob", "-i", `${out}/frames/*.png`, "-vf", `scale=480:-1,tile=${cols}x${rows}:padding=6:color=0x222233`, "-frames:v", "1", `${out}/contact-sheet.png`]);
console.log(`${out}/contact-sheet.png (${n} stills)`);
