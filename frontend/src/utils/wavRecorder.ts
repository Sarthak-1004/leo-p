// Records the microphone as 16 kHz mono 16-bit PCM WAV, a format every browser can produce and the
// server and Gemini both accept. Uses Web Audio directly so no codec support is needed.
export type Recorder = { stop: () => Promise<Blob>; cancel: () => void; level: () => number };

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let last = 0;
  processor.onaudioprocess = e => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    last = peak;
  };
  source.connect(processor);
  processor.connect(ctx.destination);
  const close = () => {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach(t => t.stop());
    void ctx.close();
  };
  return {
    level: () => last,
    cancel: close,
    stop: async () => {
      const rate = ctx.sampleRate;
      close();
      return encodeWav(downsample(merge(chunks), rate, 16000), 16000);
    },
  };
}
function merge(chunks: Float32Array[]) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
function downsample(input: Float32Array, from: number, to: number) {
  if (from === to) return input;
  const ratio = from / to,
    out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio),
      end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}
function encodeWav(samples: Float32Array, rate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
// A short tone for the speaker check (no file needed).
export function playTestTone() {
  const ctx = new AudioContext(),
    osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.25);
  osc.onended = () => void ctx.close();
}
