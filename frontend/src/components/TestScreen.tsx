import { DeviceCheck } from "./DeviceCheck";
import { SpeakingPractice } from "./SpeakingPractice";
import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { Answers, TestAttempt } from "../types/domain";
import { ListeningPlayer } from "./ListeningPlayer";
import { AnnotationLayer, NotesPanel } from "./Annotations";
import { textKey, useAnnotations } from "../utils/annotations";
import { wordCount } from "../utils/format";
import "../styles/test-screen.css";
import { GAP, group, parse, partOf, range, type Group, type Item, type Section } from "../utils/questionLayout";
import { TestHeader } from "./test-screen/TestHeader";
import { QuestionNavigator } from "./test-screen/QuestionNavigator";

// Computer-delivered test layout for Practice Mocks and FLTs: header, part banner,
// grouped questions with inline gaps, part/question navigator and section submission.

// Bold the capitalised instruction phrases (ONE WORD ONLY, TRUE, NOT GIVEN ...).
function emphasise(text: string) {
  return text
    .split(/(\b[A-Z]{2,}(?:[\s/]+(?:[A-Z]{2,}|A|AND\/OR))*\b)/)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export function TestScreen(props: {
  attempt: TestAttempt;
  section: Section;
  answers: Answers;
  setAnswer: (key: string, value: string) => void;
  seconds: number;
  connected: boolean;
  saved: string;
  locked: boolean;
  institution: string;
  candidate: string;
  onSelect: (index: number) => void;
  onSave: () => void;
  onSubmitSection: () => void;
  onSubmitTest: () => void;
  onDisplay: (change: Partial<Pick<TestAttempt, "theme" | "fontSize">>) => void;
  alerts?: ReactNode;
  onAudioProgress: (part: number, ms: number) => void;
}) {
  const { attempt, section, answers, setAnswer, locked } = props;
  const [audioStatus, setAudioStatus] = useState<"waiting" | "playing" | "finished">("waiting"),
    [volume, setVolume] = useState(1),
    [dragging, setDragging] = useState("");
  const questions = useMemo(
    () => (attempt.questions ?? []).filter(q => q.skill === section),
    [attempt.questions, section],
  );
  const items = useMemo(() => parse(questions), [questions]);
  const groups = useMemo(() => group(items), [items]);
  const writing = section === "Writing";
  const parts = writing ? ["Task 1", "Task 2"] : [...new Set(items.map(partOf))];
  const current = Math.min(attempt.question, Math.max(0, (writing ? 2 : items.length) - 1));
  const part = writing ? parts[current]! : items[current] ? partOf(items[current]!) : (parts[0] ?? "");
  const select = (index: number) => {
    if (index !== attempt.question) props.onSelect(index);
  };
  const focusQuestion = (index: number) => {
    select(index);
    requestAnimationFrame(() => document.getElementById(`q-${index}`)?.focus());
  };
  // Practice Mocks may add an online Speaking section after Writing; FLT Speaking is offline.
  const steps: Section[] = [
    "Listening",
    "Reading",
    "Writing",
    ...(attempt.remainingBySection && "Speaking" in attempt.remainingBySection ? ["Speaking" as const] : []),
  ];
  const speaking = section === "Speaking";
  const [devicesReady, setDevicesReady] = useState(false);
  const last = section === steps[steps.length - 1];
  const finish = last ? "Submit test" : `Submit ${section} section`;

  const drop = (it: Item, value: string) => {
    if (!locked) {
      setAnswer(it.q.id, value);
      select(it.index);
    }
  };
  const zone = (it: Item) => {
    const value = answers[it.q.id] ?? "";
    return (
      <span
        id={`q-${it.index}`}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-disabled={locked || undefined}
        aria-label={`Question ${it.number}${value ? `: ${value}` : ", empty"}`}
        className={`cbt-drop ${current === it.index ? "current" : ""} ${value ? "filled" : ""}`}
        onClick={() => select(it.index)}
        onFocus={() => select(it.index)}
        onKeyDown={e => {
          if ((e.key === "Delete" || e.key === "Backspace") && value) drop(it, "");
        }}
        onDragOver={(e: DragEvent) => {
          if (!locked) e.preventDefault();
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          drop(it, e.dataTransfer.getData("text/plain") || dragging);
        }}
      >
        {value || <strong>{it.number}</strong>}
        {value && !locked && (
          <button
            type="button"
            className="cbt-clear"
            aria-label={`Clear question ${it.number}`}
            onClick={e => {
              e.stopPropagation();
              drop(it, "");
            }}
          >
            ×
          </button>
        )}
      </span>
    );
  };
  const textGap = (it: Item) => (
    <input
      id={`q-${it.index}`}
      className={`cbt-gap ${current === it.index ? "current" : ""}`}
      aria-label={`Question ${it.number}`}
      autoComplete="off"
      spellCheck={false}
      value={answers[it.q.id] ?? ""}
      placeholder={String(it.number)}
      onFocus={() => select(it.index)}
      onChange={e => setAnswer(it.q.id, e.target.value)}
    />
  );
  const gap = (it: Item, g: Group) => (g.chips ? zone(it) : textGap(it));
  // Text with "(N) ______" or a bare "(N)" placeholder renders the gap for question N in place.
  const inline = (text: string, g: Group, used: Set<number>) =>
    text.split(/(\(\d+\)(?:\s*_{3,})?)/).map((piece, i) => {
      const n = /^\((\d+)\)/.exec(piece)?.[1],
        it = n ? g.items.find(x => x.number === Number(n)) : undefined;
      if (!it) return <Fragment key={i}>{piece}</Fragment>;
      used.add(it.number);
      return <Fragment key={i}>{gap(it, g)}</Fragment>;
    });

  const renderGroup = (g: Group, gi: number) => {
    const used = new Set<number>();
    const [direction = "", ...rest] = g.instructions ? g.instructions.split("\n\n") : [];
    const blocks = rest.map((para, pi) => {
      if (g.chips && g.chips.filter(c => para.includes(c)).length >= Math.min(3, g.chips.length)) return null;
      if (/\(\d+\)/.test(para) && para.includes("->"))
        return (
          <ol key={pi} className="cbt-flow">
            {para
              .replace(/^[^:]*:\s*(?=\()/, "")
              .split(/\s*->\s*/)
              .map((step, si) => (
                <li key={si}>{inline(step, g, used)}</li>
              ))}
          </ol>
        );
      if (/\(\d+\)/.test(para))
        return (
          <p key={pi} className="cbt-summary">
            {inline(para, g, used)}
          </p>
        );
      if (para.length < 90 && !/[.?]$/.test(para))
        return (
          <h4 key={pi} className="cbt-title">
            {para}
          </h4>
        );
      return <p key={pi}>{para}</p>;
    });
    const rows = g.items.filter(it => !used.has(it.number));
    const chips = g.chips && (
      <div className="cbt-chips" aria-label="Answer options">
        {g.chips.map(c => (
          <button
            type="button"
            key={c}
            draggable={!locked}
            disabled={locked}
            className="cbt-chip"
            onDragStart={e => {
              e.dataTransfer.setData("text/plain", c);
              setDragging(c);
            }}
            onDragEnd={() => setDragging("")}
            onClick={() => {
              const target =
                g.items.find(it => it.index === current) ?? g.items.find(it => !answers[it.q.id]) ?? g.items[0]!;
              drop(target, c);
            }}
          >
            {c}
          </button>
        ))}
      </div>
    );
    return (
      <section key={gi} className="cbt-group" aria-labelledby={`group-${gi}`}>
        <h3 id={`group-${gi}`}>Questions {range(g.items)}</h3>
        {direction && <p className="cbt-direction">{emphasise(direction)}</p>}
        {/* Gaps inside a flow chart or summary keep their answer list alongside, as in the paper layout. */}
        {chips && used.size ? (
          <div className="cbt-with-options">
            <div>{blocks}</div>
            {chips}
          </div>
        ) : (
          <>
            {blocks}
            {chips}
          </>
        )}
        {rows.map(it => {
          const value = answers[it.q.id] ?? "";
          if (g.chips)
            return (
              <div key={it.q.id} className="cbt-match">
                <span className="cbt-stem">{it.stem}</span>
                {zone(it)}
              </div>
            );
          if (it.q.options.length)
            return (
              <fieldset
                key={it.q.id}
                className={`cbt-question ${current === it.index ? "current" : ""}`}
                onFocus={() => select(it.index)}
              >
                <legend>
                  <span className="cbt-num">{it.number}</span> {it.stem}
                </legend>
                {it.q.options.map((o, oi) => (
                  <label key={o} className="cbt-option">
                    <input
                      id={oi === 0 ? `q-${it.index}` : undefined}
                      type="radio"
                      name={it.q.id}
                      checked={value === o}
                      onChange={() => setAnswer(it.q.id, o)}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
            );
          const pieces = it.stem.split(GAP);
          return (
            <p key={it.q.id} className={`cbt-question cbt-line ${current === it.index ? "current" : ""}`}>
              {pieces.length > 1 ? (
                <>
                  {pieces[0]}
                  {textGap(it)}
                  {pieces.slice(1).join("")}
                </>
              ) : (
                <>
                  <span className="cbt-num">{it.number}</span> {it.stem} {textGap(it)}
                </>
              )}
            </p>
          );
        })}
      </section>
    );
  };

  const partItems = items.filter(it => partOf(it) === part);
  const banner = speaking
    ? ["Speaking", "Record your answer to each question. Parts 1 to 3."]
    : writing
      ? [
          part,
          `You should spend about ${part === "Task 1" ? 20 : 40} minutes on this task. Write at least ${part === "Task 1" ? 150 : 250} words.`,
        ]
      : [
          part,
          `${section === "Listening" ? "Listen" : "Read the text"} and answer questions ${partItems.length ? range(partItems) : ""}.`,
        ];
  const prompt = writing ? questions.find(q => q.section === part) : undefined;
  const passages = section === "Reading" ? [...new Set(partItems.map(it => it.q.passage).filter(Boolean))] : [];
  const total = writing ? 2 : items.length;
  const go = (index: number) => focusQuestion(Math.max(0, Math.min(total - 1, index)));
  // One recording per Listening part: only the current part's player is shown.
  const audio = useMemo(() => [...new Set(questions.flatMap(q => q.assetIds ?? []))], [questions]);
  // A new part or section starts at the top of the page, like turning to a new screen.
  const body = useRef<HTMLDivElement>(null);
  // Highlights and notes on the passages and Writing tasks (kept in this browser for this attempt).
  const notes = useAnnotations(attempt.id),
    [notesOpen, setNotesOpen] = useState(false),
    [noteFocus, setNoteFocus] = useState<string>();
  const noteCount = notes.items.filter(a => a.note !== undefined).length;
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [section, part]);

  return (
    <div className="cbt">
      <TestHeader
        attempt={attempt}
        section={section}
        steps={steps}
        last={last}
        seconds={props.seconds}
        connected={props.connected}
        saved={props.saved}
        locked={locked}
        institution={props.institution}
        candidate={props.candidate}
        audioStatus={audioStatus}
        notesOpen={notesOpen}
        noteCount={noteCount}
        onToggleNotes={() => setNotesOpen(!notesOpen)}
        volume={volume}
        onVolume={setVolume}
        onSave={props.onSave}
        onSubmitTest={props.onSubmitTest}
        onDisplay={props.onDisplay}
      />

      <div className="cbt-body" ref={body}>
        <div className="cbt-banner">
          <strong>{banner[0]}</strong>
          <span>{banner[1]}</span>
        </div>
        {props.alerts}
        {section === "Listening" && (
          <ListeningPlayer
            assetIds={audio}
            startPart={attempt.audioPart ?? 0}
            startMs={attempt.audioMs ?? 0}
            volume={volume}
            onProgress={props.onAudioProgress}
            onStatus={setAudioStatus}
          />
        )}
        {speaking ? (
          devicesReady ? (
            <fieldset className="cbt-fieldset cbt-speaking" disabled={locked}>
              <SpeakingPractice
                attemptId={attempt.id}
                questions={questions}
                answers={answers}
                setAnswer={setAnswer}
                locked={locked}
              />
            </fieldset>
          ) : (
            <div className="cbt-speaking">
              <p>Check your speakers and microphone before you start.</p>
              <DeviceCheck onReady={setDevicesReady} />
            </div>
          )
        ) : (
          <fieldset className="cbt-fieldset" disabled={locked}>
            {writing ? (
              <div className="cbt-split">
                <div className="cbt-pane">
                  <p className="cbt-prompt" data-annotate={prompt ? textKey("task", prompt.prompt) : undefined}>
                    {prompt?.prompt ?? "No prompt supplied for this task."}
                  </p>
                  {prompt?.assetIds?.map(id => (
                    <img key={id} src={`/api/assets/${id}/stream`} alt={`${part} figure`} className="cbt-figure" />
                  ))}
                </div>
                <div className="cbt-pane">
                  <label className="cbt-writing">
                    <span className="sr-only">{part} response</span>
                    <textarea
                      id={`q-${current}`}
                      value={answers[part] ?? ""}
                      onChange={e => setAnswer(part, e.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <p className="cbt-words" role="status">
                    Words: {wordCount(answers[part] ?? "")}
                  </p>
                </div>
              </div>
            ) : section === "Reading" ? (
              <div className="cbt-split">
                <div className="cbt-pane cbt-passage" tabIndex={0} aria-label="Reading passage">
                  {passages.length ? (
                    passages.map((p, i) => (
                      <div key={i} className="cbt-text" data-annotate={textKey("passage", p ?? "")}>
                        {p}
                      </div>
                    ))
                  ) : (
                    <p>No passage has been supplied.</p>
                  )}
                </div>
                <div className="cbt-pane">{groups.filter(g => g.part === part).map(renderGroup)}</div>
              </div>
            ) : (
              <div className="cbt-single">{groups.filter(g => g.part === part).map(renderGroup)}</div>
            )}
          </fieldset>
        )}
      </div>

      <QuestionNavigator
        speaking={speaking}
        writing={writing}
        parts={parts}
        part={part}
        items={items}
        questions={questions}
        answers={answers}
        current={current}
        total={total}
        go={go}
        finish={finish}
        finishDisabled={!props.connected || locked || !!attempt.submittedSections?.includes(section)}
        onFinish={last ? props.onSubmitTest : props.onSubmitSection}
      />
      {section !== "Listening" && (
        <AnnotationLayer
          scope={body}
          items={notes.items}
          setItems={notes.setItems}
          refreshKey={`${section}:${part}`}
          onOpenNote={id => {
            setNoteFocus(id);
            setNotesOpen(true);
          }}
        />
      )}
      {notesOpen && section !== "Listening" && (
        <NotesPanel
          items={notes.items}
          setItems={notes.setItems}
          focusId={noteFocus}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </div>
  );
}
