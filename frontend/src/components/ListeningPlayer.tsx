import { useEffect, useRef, useState } from "react";

// Practice Mock / FLT Listening: one recording per part, played in order exactly once.
// No controls: the student starts it once; pause and rewind are not possible. The furthest
// position is reported to the server, which only moves it forward, so a reload continues
// from there instead of replaying.
export function ListeningPlayer({
  assetIds,
  startPart,
  startMs,
  volume,
  onProgress,
  onStatus,
}: {
  assetIds: string[];
  startPart: number;
  startMs: number;
  volume: number;
  onProgress: (part: number, ms: number) => void;
  onStatus: (status: "waiting" | "playing" | "finished") => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [part, setPart] = useState(Math.min(startPart, assetIds.length));
  const [started, setStarted] = useState(false),
    [error, setError] = useState(false);
  const furthest = useRef({ part: startPart, ms: startMs });
  const finished = part >= assetIds.length;
  const resuming = startPart > 0 || startMs > 0;

  useEffect(() => {
    onStatus(finished ? "finished" : started ? "playing" : "waiting");
  }, [finished, started, onStatus]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume, part]);
  // Each new part starts as soon as the previous one ends.
  useEffect(() => {
    const el = audio.current;
    if (!el || !started || finished) return;
    const offset = part === startPart ? startMs / 1000 : 0;
    const begin = () => {
      if (offset && Math.abs(el.currentTime - offset) > 1) el.currentTime = offset;
      void el.play().catch(() => setError(true));
    };
    if (el.readyState >= 1) begin();
    else el.addEventListener("loadedmetadata", begin, { once: true });
    return () => el.removeEventListener("loadedmetadata", begin);
  }, [part, started, finished, startPart, startMs]);

  const report = (ms: number) => {
    const f = furthest.current;
    if (part > f.part || (part === f.part && ms > f.ms)) {
      furthest.current = { part, ms };
      onProgress(part, ms);
    }
  };
  if (!assetIds.length || (finished && !started)) return null;
  return (
    <>
      {!finished && (
        <audio
          ref={audio}
          src={`/api/assets/${assetIds[part]}/stream`}
          preload="auto"
          onTimeUpdate={e => report(Math.floor(e.currentTarget.currentTime * 1000))}
          // The recording cannot be paused (for example with a keyboard media key) or moved backwards.
          onPause={e => {
            const el = e.currentTarget;
            if (started && !el.ended) void el.play().catch(() => {});
          }}
          onSeeking={e => {
            const el = e.currentTarget,
              f = furthest.current;
            if (f.part === part && el.currentTime * 1000 < f.ms - 1500) el.currentTime = f.ms / 1000;
          }}
          onEnded={() => {
            const next = part + 1;
            furthest.current = { part: next, ms: 0 };
            onProgress(next, 0);
            setPart(next);
          }}
          onError={() => setError(true)}
        />
      )}
      {!started && !finished && (
        <div className="cbt-audio-gate" role="dialog" aria-modal="true" aria-labelledby="audio-gate-text">
          <div className="cbt-audio-gate-box">
            <Headphones />
            <p id="audio-gate-text">
              {resuming
                ? "Your audio will continue from where it stopped. You will not be permitted to pause or rewind the audio while answering the questions."
                : "You will be listening to an audio clip during this test. You will not be permitted to pause or rewind the audio while answering the questions."}
            </p>
            <p>To continue, click Play.</p>
            <button type="button" className="cbt-play" autoFocus onClick={() => setStarted(true)}>
              <PlayIcon /> Play
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="cbt-audio-error">
          The audio could not be played. Check your connection; if it continues, tell the invigilator.
        </p>
      )}
    </>
  );
}

function Headphones() {
  return (
    <svg aria-hidden="true" className="cbt-headphones" width="150" height="130" viewBox="0 0 150 130" fill="none">
      <path d="M18 92V72a57 57 0 0 1 114 0v20" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
      <rect x="20" y="78" width="24" height="44" rx="12" fill="currentColor" />
      <rect x="106" y="78" width="24" height="44" rx="12" fill="currentColor" />
      <rect x="44" y="84" width="10" height="40" rx="5" fill="currentColor" />
      <rect x="96" y="84" width="10" height="40" rx="5" fill="currentColor" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="16" fill="#fff" />
      <path d="M13.5 10.5v13l10-6.5z" fill="#000" />
    </svg>
  );
}
