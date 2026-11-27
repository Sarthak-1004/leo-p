// Voices the Listening scripts of a private test pack with Sarvam text-to-speech: one MP3 per part.
// npm run content:voice -- <pack.json> [--part "Part 1"] [--samples]
// Needs SARVAM_API_KEY (paid calls) and ffmpeg. Clips are cached by content hash, so reruns only pay for changed lines.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { z } from "zod";

const key = process.env.SARVAM_API_KEY;
if (!key) throw new Error("Set SARVAM_API_KEY in backend/.env");
const args = process.argv.slice(2),
  file = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--part");
if (!file) throw new Error('Usage: npm run content:voice -- <pack.json> [--part "Part 1"] [--samples]');
const onlyPart = args.includes("--part") ? args[args.indexOf("--part") + 1] : undefined;

const MODEL = "bulbul:v3",
  RATE = 22050,
  MAX_CHARS = 1500;
const VOICES = [
  "shubh",
  "aditya",
  "ritu",
  "priya",
  "neha",
  "rahul",
  "pooja",
  "rohan",
  "simran",
  "kavya",
  "amit",
  "dev",
  "ishita",
  "shreya",
  "ratan",
  "varun",
  "manan",
  "sumit",
  "roopa",
  "kabir",
  "aayan",
  "ashutosh",
  "advait",
  "anand",
  "tanya",
  "tarun",
  "sunny",
  "mani",
  "gokul",
  "vijay",
  "shruti",
  "suhani",
  "mohit",
  "kavitha",
  "rehan",
  "soham",
  "rupali",
];
// Per-pack casting beside the pack: <pack>.voices.json
const castSchema = z
  .object({
    narrator: z.string(),
    pace: z.number().min(0.5).max(2).default(1),
    speakers: z.record(z.string(), z.string()),
    intros: z.record(z.string(), z.string()).default({}),
    // Spoken replacements for text the voice may misread, e.g. spelled names.
    say: z.record(z.string(), z.string()).default({}),
    previewSeconds: z.number().min(0).max(60).default(30),
  })
  .strict();

const root = resolve(dirname(resolve(file)), "audio");
const cacheDir = join(root, ".cache");
await mkdir(cacheDir, { recursive: true });
const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

async function tts(text: string, speaker: string, pace: number): Promise<Buffer> {
  if (!VOICES.includes(speaker)) throw new Error(`Unknown Sarvam voice: ${speaker}`);
  const cached = join(
    cacheDir,
    createHash("sha256")
      .update(JSON.stringify([MODEL, RATE, speaker, pace, text]))
      .digest("hex") + ".wav",
  );
  if (await exists(cached)) return readFile(cached);
  for (let attempt = 1; ; attempt++) {
    const wait = () => new Promise(done => setTimeout(done, 2000 * attempt));
    // Dropped connections are retried like rate limits and server errors.
    const r = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key!, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        language_code: "en-IN",
        model: MODEL,
        speaker,
        pace,
        speech_sample_rate: RATE,
        output_audio_codec: "wav",
      }),
    }).catch(async (e: unknown) => {
      if (attempt >= 5) throw e;
      await wait();
      return undefined;
    });
    if (!r) continue;
    if (r.ok) {
      const audio = Buffer.from(((await r.json()) as { audios: string[] }).audios.join(""), "base64");
      await writeFile(cached, audio);
      return audio;
    }
    if ((r.status === 429 || r.status >= 500) && attempt < 5) {
      await wait();
      continue;
    }
    throw new Error(`Sarvam ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
}
// 16-bit mono PCM samples from a WAV, so clips and silences can be joined directly.
function pcm(wav: Buffer) {
  let offset = 12,
    data: Buffer | undefined;
  while (offset + 8 <= wav.length) {
    const kind = wav.toString("ascii", offset, offset + 4),
      length = wav.readUInt32LE(offset + 4),
      start = offset + 8;
    if (kind === "fmt ") {
      const channels = wav.readUInt16LE(start + 2),
        rate = wav.readUInt32LE(start + 4),
        bits = wav.readUInt16LE(start + 14);
      if (channels !== 1 || rate !== RATE || bits !== 16)
        throw new Error(`Unexpected audio format ${channels}ch ${rate}Hz ${bits}bit`);
    }
    if (kind === "data") {
      data = wav.subarray(start, Math.min(start + length, wav.length));
      break;
    }
    offset = start + length + (length % 2);
  }
  if (!data) throw new Error("Sarvam returned audio without a data chunk");
  return data;
}
const silence = (seconds: number) => Buffer.alloc(Math.round(seconds * RATE) * 2);
function wavFile(samples: Buffer) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + samples.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(samples.length, 40);
  return Buffer.concat([head, samples]);
}
// Long turns are split at sentence ends to stay under the request limit.
function chunks(text: string) {
  const out: string[] = [];
  let current = "";
  for (const sentence of text.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) ?? [text]) {
    if ((current + sentence).length > MAX_CHARS && current) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
// "NAME: line" starts a turn; unlabelled lines continue the previous speaker as a new paragraph.
function turns(script: string) {
  const out: { speaker: string; text: string; newSpeaker: boolean }[] = [];
  let last = "";
  for (const line of script
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)) {
    const m = line.match(/^([A-Z][A-Z .'-]*):\s*(.*)$/);
    if (m) {
      out.push({ speaker: m[1]!, text: m[2]!, newSpeaker: m[1] !== last });
      last = m[1]!;
    } else if (last) out.push({ speaker: last, text: line, newSpeaker: false });
    else throw new Error(`Script line has no speaker: ${line.slice(0, 60)}`);
  }
  return out;
}
const encode = (wavPath: string, mp3Path: string) =>
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wavPath,
    "-ac",
    "1",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "64k",
    "-map_metadata",
    "-1",
    mp3Path,
  ]);

if (args.includes("--samples")) {
  const out = join(root, "voice-samples");
  await mkdir(out, { recursive: true });
  for (const voice of VOICES) {
    const samples = pcm(
      await tts(
        `Hello, my name is ${voice}. The kiosk opens at half past eight, and the total cost is sixty-eight pounds.`,
        voice,
        1,
      ),
    );
    await writeFile(join(out, `${voice}.wav`), wavFile(samples));
    encode(join(out, `${voice}.wav`), join(out, `${voice}.mp3`));
    console.log(`sample: ${voice}`);
  }
  process.exit(0);
}

const pack = JSON.parse(await readFile(resolve(file), "utf8")) as {
  id: string;
  listeningId?: string;
  listeningScripts: { part: string; text: string; questionIds: string[] }[];
};
// A shared Listening paper is voiced once, under its own ID.
const listeningId = pack.listeningId ?? pack.id;
const cast = castSchema.parse(
  JSON.parse(await readFile(join(dirname(resolve(file)), `${listeningId}.voices.json`), "utf8")),
);
const out = join(root, listeningId);
await mkdir(out, { recursive: true });
let characters = 0;
const say = (text: string) => Object.entries(cast.say).reduce((t, [from, to]) => t.split(from).join(to), text);
const speak = async (text: string, voice: string) => {
  const spoken = say(text);
  characters += spoken.length;
  return Promise.all(chunks(spoken).map(c => tts(c, voice, cast.pace).then(pcm)));
};

for (const script of pack.listeningScripts.filter(s => !onlyPart || s.part === onlyPart)) {
  const numbers = script.questionIds.map(id => Number(id.match(/(\d+)$/)?.[1])).filter(Boolean);
  const range = `questions ${Math.min(...numbers)} to ${Math.max(...numbers)}`;
  const parts: Buffer[] = [silence(0.5)];
  parts.push(
    ...(await speak(
      `${script.part}. ${cast.intros[script.part] ?? ""} First, you have some time to look at ${range}.`,
      cast.narrator,
    )),
    silence(cast.previewSeconds),
  );
  parts.push(...(await speak(`Now listen carefully and answer ${range}.`, cast.narrator)), silence(1));
  for (const turn of turns(script.text)) {
    const voice = cast.speakers[turn.speaker];
    if (!voice) throw new Error(`${script.part}: no voice cast for ${turn.speaker}`);
    parts.push(silence(turn.newSpeaker ? 0.7 : 0.5), ...(await speak(turn.text, voice)));
  }
  parts.push(silence(1.5), ...(await speak(`That is the end of ${script.part}.`, cast.narrator)), silence(1));
  const name = script.part.toLowerCase().replace(/\s+/g, "-"),
    samples = Buffer.concat(parts);
  await writeFile(join(out, `${name}.wav`), wavFile(samples));
  encode(join(out, `${name}.wav`), join(out, `${name}.mp3`));
  console.log(`${script.part}: ${(samples.length / 2 / RATE / 60).toFixed(1)} min -> ${join(out, `${name}.mp3`)}`);
}
console.log(`Characters sent or reused from cache: ${characters}`);
