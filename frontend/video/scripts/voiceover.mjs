// Generates the storyline narration with ElevenLabs (word timings included) into public/story and src/story/voiceover.json.
// Usage: ELEVENLABS_API_KEY=... node scripts/voiceover.mjs [sceneId ...]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const VOICE = process.env.ELEVENLABS_VOICE ?? "nPczCjzI2devNBz1zQrb"; // Brian: deep, resonant
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("Set ELEVENLABS_API_KEY");

const scenes = JSON.parse(readFileSync("src/story/script.json", "utf8"));
const outFile = "src/story/voiceover.json";
const manifest = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
const only = process.argv.slice(2);

const words = (a) => {
  const out = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur), (cur = null);
      return;
    }
    if (!cur) cur = { w: "", start: a.character_start_times_seconds[i], end: 0 };
    cur.w += ch;
    cur.end = a.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
};

for (const [i, s] of scenes.entries()) {
  if (only.length && !only.includes(s.id)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      text: s.text,
      model_id: MODEL,
      previous_text: scenes[i - 1]?.text,
      next_text: scenes[i + 1]?.text,
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 0.95 },
    }),
  });
  if (!res.ok) throw new Error(`${s.id}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  writeFileSync(`public/story/vo-${s.id}.mp3`, Buffer.from(j.audio_base64, "base64"));
  const w = words(j.alignment);
  manifest[s.id] = { duration: w.at(-1).end, words: w };
  console.log(`${s.id}: ${w.at(-1).end.toFixed(1)}s, ${w.length} words`);
}
writeFileSync(outFile, JSON.stringify(manifest, null, 1));
