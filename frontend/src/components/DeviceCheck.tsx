import "../styles/speaking.css";
import { useEffect, useRef, useState } from "react";
import { playTestTone, startRecording, type Recorder } from "../utils/wavRecorder";
import { Button } from "./ui";
import { Icon } from "./Icon";

// Speaker and microphone check before Speaking practice. Nothing here is uploaded.
export function DeviceCheck({ onReady }: { onReady: (ready: boolean) => void }) {
  const [heard, setHeard] = useState(false), [played, setPlayed] = useState(false);
  const [mic, setMic] = useState<"idle" | "recording" | "recorded" | "ok" | "error">("idle"), [clip, setClip] = useState(""), [error, setError] = useState("");
  const rec = useRef<Recorder | null>(null);
  useEffect(() => { onReady(heard && mic === "ok"); }, [heard, mic, onReady]);
  useEffect(() => () => { rec.current?.cancel(); if (clip) URL.revokeObjectURL(clip); }, [clip]);
  const record = async () => {
    setError("");
    try {
      rec.current = await startRecording(); setMic("recording");
      setTimeout(async () => { const blob = await rec.current!.stop(); rec.current = null; setClip(URL.createObjectURL(blob)); setMic("recorded"); }, 3000);
    } catch { setMic("error"); setError("The microphone is blocked or missing. Allow microphone access in your browser, then try again."); }
  };
  return <div className="device-check">
    <section className="device-row"><span className="device-icon"><Icon name="headphones" /></span><div><strong>Speaker test</strong><p className="muted text-sm">Play the test sound, then confirm you heard it.</p></div>
      <div className="actions"><Button variant="secondary" onClick={() => { playTestTone(); setPlayed(true); }}>Play sound</Button><Button onClick={() => setHeard(true)} disabled={!played || heard}>{heard ? "Heard ✓" : "I heard it"}</Button></div></section>
    <section className="device-row"><span className="device-icon"><Icon name="mic" /></span><div><strong>Microphone test</strong><p className="muted text-sm">Record three seconds, then play it back.</p></div>
      <div className="actions">
        {mic === "recording" ? <Button disabled>Recording… speak now</Button> : <Button variant="secondary" onClick={() => void record()}>{mic === "idle" || mic === "error" ? "Start recording" : "Record again"}</Button>}
        {clip && <audio controls src={clip} aria-label="Your test recording" />}
        {(mic === "recorded" || mic === "ok") && <Button onClick={() => setMic("ok")} disabled={mic === "ok"}>{mic === "ok" ? "Sounds good ✓" : "I can hear myself"}</Button>}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}</section>
  </div>;
}
