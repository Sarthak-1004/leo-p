import "../styles/speaking.css";
import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { startRecording, type Recorder } from "../utils/wavRecorder";
import type { Question } from "../types/domain";
import { Badge, Button, Card } from "./ui";

// Practice Speaking: answer each question aloud. Part 2 gives one minute to prepare, then up to two minutes.
// Each answer is uploaded as soon as it is recorded; re-recording replaces it. Marked by AI after submission.
const LIMIT: Record<string, number> = { "Part 1": 45, "Part 2": 120, "Part 3": 90 };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function SpeakingPractice({
  attemptId,
  questions,
  answers,
  setAnswer,
  locked,
}: {
  attemptId: string;
  questions: Question[];
  answers: Record<string, string>;
  setAnswer: (key: string, value: string) => void;
  locked: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "prepare" | "recording" | "uploading">("ready");
  const [seconds, setSeconds] = useState(0),
    [level, setLevel] = useState(0),
    [error, setError] = useState("");
  const rec = useRef<Recorder | null>(null),
    started = useRef(0),
    prepEnds = useRef(0);
  const q = questions[index]!,
    part = q.section ?? "Part 1",
    limit = LIMIT[part] ?? 60,
    saved = answers[q.id];

  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setPhase("uploading");
    try {
      const blob = await r.stop(),
        form = new FormData();
      form.append("file", blob, "answer.wav");
      const result = await api<{ id: string }>(`/attempts/${attemptId}/recordings/${encodeURIComponent(q.id)}`, {
        method: "POST",
        body: form,
      });
      setAnswer(q.id, result.id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The recording could not be saved. Record again.");
    } finally {
      setPhase("ready");
    }
  };
  const record = async () => {
    setError("");
    try {
      rec.current = await startRecording();
      started.current = Date.now();
      setSeconds(0);
      setPhase("recording");
    } catch {
      setError("The microphone is blocked or missing. Allow microphone access in your browser, then try again.");
      setPhase("ready");
    }
  };
  const stopRef = useRef(stop);
  const recordRef = useRef(record);
  useEffect(() => {
    stopRef.current = stop;
    recordRef.current = record;
  });
  useEffect(() => {
    if (phase !== "recording" && phase !== "prepare") return;
    const t = setInterval(() => {
      if (phase === "prepare") {
        const left = Math.max(0, Math.ceil((prepEnds.current - Date.now()) / 1000));
        setSeconds(left);
        if (left === 0) void recordRef.current();
        return;
      }
      const s = (Date.now() - started.current) / 1000;
      setSeconds(s);
      setLevel(rec.current?.level() ?? 0);
      if (s >= limit) void stopRef.current();
    }, 200);
    return () => clearInterval(t);
  }, [phase, limit]);
  useEffect(() => () => rec.current?.cancel(), []);
  const go = (n: number) => {
    if (phase === "ready") {
      setIndex(n);
      setError("");
    }
  };

  return (
    <Card className="speaking-practice">
      <div className="speaking-progress" aria-label="Questions">
        {questions.map((x, i) => (
          <button
            type="button"
            key={x.id}
            aria-current={i === index ? "step" : undefined}
            className={answers[x.id] ? "answered" : ""}
            onClick={() => go(i)}
            disabled={phase !== "ready"}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="speaking-head">
        <Badge>{part}</Badge>
        <span className="muted text-sm">
          Answer up to {fmt(limit)}
          {part === "Part 2" ? " after one minute of preparation" : ""}
        </span>
      </div>
      <div className="speaking-prompt">{q.prompt}</div>
      {phase === "prepare" && (
        <div className="speaking-timer prep" role="timer">
          <strong>{fmt(seconds)}</strong>
          <span>Preparation — make notes, then speak. Recording starts automatically.</span>
        </div>
      )}
      {phase === "recording" && (
        <div className="speaking-timer rec" role="timer">
          <span className="rec-dot" aria-hidden="true" />
          <strong>{fmt(seconds)}</strong>
          <span>of {fmt(limit)}</span>
          <span className="level" aria-hidden="true">
            <i style={{ width: `${Math.min(100, level * 160)}%` }} />
          </span>
        </div>
      )}
      {phase === "uploading" && (
        <p className="muted" role="status">
          Saving your answer…
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {saved && phase === "ready" && (
        <div className="speaking-saved">
          <span>Your answer</span>
          <audio controls src={`/api/assets/${saved}/stream`} aria-label="Your recorded answer" />
        </div>
      )}
      <div className="actions">
        {phase === "ready" && (
          <Button
            disabled={locked}
            onClick={() => {
              if (part === "Part 2" && !saved) {
                prepEnds.current = Date.now() + 60000;
                setSeconds(60);
                setPhase("prepare");
              } else void record();
            }}
          >
            {saved ? "Record again" : part === "Part 2" ? "Start 1-minute preparation" : "Start answering"}
          </Button>
        )}
        {phase === "prepare" && <Button onClick={() => void record()}>Start speaking now</Button>}
        {phase === "recording" && <Button onClick={() => void stop()}>Stop and save</Button>}
        <Button variant="secondary" disabled={index === 0 || phase !== "ready"} onClick={() => go(index - 1)}>
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={index === questions.length - 1 || phase !== "ready"}
          onClick={() => go(index + 1)}
        >
          Next question
        </Button>
      </div>
      <p className="muted text-xs">
        {Object.keys(answers).filter(k => answers[k]).length} of {questions.length} answered. Submit when you are ready;
        the AI marks all your answers together.
      </p>
    </Card>
  );
}
