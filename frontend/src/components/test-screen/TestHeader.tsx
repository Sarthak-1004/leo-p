import { useState } from "react";
import { Link } from "react-router";
import type { TestAttempt } from "../../types/domain";
import { annotationsSupported } from "../../utils/annotations";
import { Icon } from "../Icon";
import type { Section } from "../../utils/questionLayout";

// Exam header: candidate, audio state, timer, section steps, connection, saving, notes and display menu.
export function TestHeader(props: {
  attempt: TestAttempt;
  section: Section;
  steps: Section[];
  last: boolean;
  seconds: number;
  connected: boolean;
  saved: string;
  locked: boolean;
  institution: string;
  candidate: string;
  audioStatus: "waiting" | "playing" | "finished";
  notesOpen: boolean;
  noteCount: number;
  onToggleNotes: () => void;
  volume: number;
  onVolume: (volume: number) => void;
  onSave: () => void;
  onSubmitTest: () => void;
  onDisplay: (change: Partial<Pick<TestAttempt, "theme" | "fontSize">>) => void;
}) {
  const { attempt, section, steps, last, locked, audioStatus, notesOpen, noteCount, volume } = props;
  const [menu, setMenu] = useState(false);
  const minutes = Math.ceil(props.seconds / 60);
  return (
    <header className="cbt-header">
      <div className="cbt-who">
        <span className="cbt-brand" aria-label={`LEO PREP: ${props.institution}`}>
          LEO PREP
        </span>
        <span className="cbt-candidate">
          <strong>{props.candidate}</strong>
          <small>
            {section === "Listening" ? (
              <>
                <Icon name="headphones" size={14} />{" "}
                {audioStatus === "playing"
                  ? "Audio is playing"
                  : audioStatus === "finished"
                    ? "Audio finished"
                    : "Audio not started"}
              </>
            ) : (
              section
            )}
          </small>
        </span>
      </div>
      <div className="cbt-time">
        <h1 className="cbt-test-name">{attempt.name ?? "Assessment"}</h1>
        <strong aria-label="Time remaining" role="timer">
          {props.seconds >= 60 ? `${minutes} minutes left` : `${props.seconds} seconds left`}
        </strong>
        <nav className="cbt-steps" aria-label="Exam sections (opened in order)">
          {steps.map(s => (
            <button type="button" key={s} disabled={s !== section} aria-current={s === section ? "step" : undefined}>
              {s}
            </button>
          ))}
        </nav>
      </div>
      <div className="cbt-tools">
        <span
          className={`cbt-signal ${props.connected ? "" : "offline"}`}
          title={props.connected ? "Connected" : "Offline"}
        >
          <Signal />
          <span className="sr-only">{props.connected ? "Connected" : "Offline: timer stopped"}</span>
        </span>
        <span className="cbt-saved" role="status">
          {props.saved}
        </span>
        <button type="button" className="cbt-icon-text" disabled={!props.connected || locked} onClick={props.onSave}>
          Save answers
        </button>
        {section !== "Listening" && annotationsSupported() && (
          <button
            type="button"
            className="cbt-icon"
            aria-expanded={notesOpen}
            aria-label={`Notes (${noteCount})`}
            title="Notes"
            onClick={props.onToggleNotes}
          >
            <Pencil />
          </button>
        )}
        <button
          type="button"
          className="cbt-icon"
          aria-expanded={menu}
          aria-label="Display settings"
          onClick={() => setMenu(!menu)}
        >
          <Icon name="menu" />
        </button>
      </div>
      {menu && (
        <div className="cbt-menu" role="group" aria-label="Test options">
          <label>
            Colour theme
            <select
              value={attempt.theme}
              onChange={e => props.onDisplay({ theme: e.target.value as TestAttempt["theme"] })}
            >
              <option value="standard">Black on white</option>
              <option value="dark">White on black</option>
              <option value="yellow">Yellow on black</option>
            </select>
          </label>
          <label>
            Font size
            <select
              value={attempt.fontSize}
              onChange={e => props.onDisplay({ fontSize: e.target.value as TestAttempt["fontSize"] })}
            >
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="extra-large">Extra Large</option>
            </select>
          </label>
          {section === "Listening" && (
            <label>
              Volume
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => props.onVolume(Number(e.target.value))}
              />
            </label>
          )}
          {!last && (
            <button
              type="button"
              className="cbt-icon-text"
              disabled={!props.connected || locked}
              onClick={props.onSubmitTest}
            >
              Submit test
            </button>
          )}
          <Link to="/student/mock-tests">Exit test (answers stay saved)</Link>
        </div>
      )}
    </header>
  );
}

function Pencil() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
      <path d="M20 20h-8" />
    </svg>
  );
}
function Signal() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M2 8.5a15 15 0 0 1 20 0" />
      <path d="M5.5 12a10 10 0 0 1 13 0" />
      <path d="M9 15.5a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}
