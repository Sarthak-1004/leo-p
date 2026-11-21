import { DeviceCheck } from "./DeviceCheck";
import { SpeakingPractice } from "./SpeakingPractice";
import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router";
import type { Answers, Question, TestAttempt } from "../types/domain";
import { ListeningPlayer } from "./ListeningPlayer";
import { AnnotationLayer, NotesPanel } from "./Annotations";
import { annotationsSupported, textKey, useAnnotations } from "../utils/annotations";
import { Icon } from "./Icon";
import { wordCount } from "../utils/format";
import "../styles/test-screen.css";

// Computer-delivered test layout for Practice Mocks and FLTs: header, part banner,
// grouped questions with inline gaps, part/question navigator and section submission.
type Section = "Listening" | "Reading" | "Writing" | "Speaking";
type Item = { q: Question; index: number; number: number; stem: string; instructions: string };
type Group = { part: string; instructions: string; items: Item[]; chips?: string[] };
const choiceSets = [["True", "False", "Not Given"], ["Yes", "No", "Not Given"]];
const GAP = /_{3,}/;

function parse(questions: Question[]): Item[] {
  return questions.map((q, index) => {
    const m = /^([\s\S]*?)\n\n(\d+)\.\s([\s\S]*)$/.exec(q.prompt);
    return m ? { q, index, number: Number(m[2]), stem: m[3]!, instructions: m[1]! } : { q, index, number: index + 1, stem: q.prompt, instructions: "" };
  });
}
// Consecutive questions in the same part with the same instructions form one "Questions a–b" group.
function group(items: Item[]): Group[] {
  const groups: Group[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && last.part === partOf(it) && last.instructions === it.instructions) last.items.push(it);
    else groups.push({ part: partOf(it), instructions: it.instructions, items: [it] });
  }
  for (const g of groups) {
    const first = JSON.stringify(g.items[0]!.q.options);
    const shared = g.items.length > 1 && g.items.every(it => JSON.stringify(it.q.options) === first);
    const opts = g.items[0]!.q.options;
    // Shared option lists become drag-and-drop answers; True/False/Not Given and short lists stay as choices.
    if (shared && opts.length >= 3 && !choiceSets.some(s => JSON.stringify(s) === first)) g.chips = opts;
  }
  return groups;
}
// Bold the capitalised instruction phrases (ONE WORD ONLY, TRUE, NOT GIVEN ...).
function emphasise(text: string) {
  return text.split(/(\b[A-Z]{2,}(?:[\s/]+(?:[A-Z]{2,}|A|AND\/OR))*\b)/).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part);
}
const partOf = (it: Item) => it.q.section ?? "";
const range = (items: Item[]) => items.length > 1 ? `${items[0]!.number}–${items.at(-1)!.number}` : `${items[0]!.number}`;

export function TestScreen(props: {
  attempt: TestAttempt; section: Section; answers: Answers; setAnswer: (key: string, value: string) => void;
  seconds: number; connected: boolean; saved: string; locked: boolean; institution: string; candidate: string;
  onSelect: (index: number) => void; onSave: () => void; onSubmitSection: () => void; onSubmitTest: () => void;
  onDisplay: (change: Partial<Pick<TestAttempt, "theme" | "fontSize">>) => void; alerts?: ReactNode;
  onAudioProgress: (part: number, ms: number) => void;
}) {
  const { attempt, section, answers, setAnswer, locked } = props;
  const [menu, setMenu] = useState(false), [audioStatus, setAudioStatus] = useState<"waiting" | "playing" | "finished">("waiting"), [volume, setVolume] = useState(1), [dragging, setDragging] = useState("");
  const questions = useMemo(() => (attempt.questions ?? []).filter(q => q.skill === section), [attempt.questions, section]);
  const items = useMemo(() => parse(questions), [questions]);
  const groups = useMemo(() => group(items), [items]);
  const writing = section === "Writing";
  const parts = writing ? ["Task 1", "Task 2"] : [...new Set(items.map(partOf))];
  const current = Math.min(attempt.question, Math.max(0, (writing ? 2 : items.length) - 1));
  const part = writing ? parts[current]! : (items[current] ? partOf(items[current]!) : parts[0] ?? "");
  const select = (index: number) => { if (index !== attempt.question) props.onSelect(index); };
  const focusQuestion = (index: number) => { select(index); requestAnimationFrame(() => document.getElementById(`q-${index}`)?.focus()); };
  // Practice Mocks may add an online Speaking section after Writing; FLT Speaking is offline.
  const steps: Section[] = ["Listening", "Reading", "Writing", ...(attempt.remainingBySection && "Speaking" in attempt.remainingBySection ? ["Speaking" as const] : [])];
  const speaking = section === "Speaking";
  const [devicesReady, setDevicesReady] = useState(false);
  const last = section === steps[steps.length - 1];
  const finish = last ? "Submit test" : `Submit ${section} section`;
  const minutes = Math.ceil(props.seconds / 60);

  const drop = (it: Item, value: string) => { if (!locked) { setAnswer(it.q.id, value); select(it.index); } };
  const zone = (it: Item) => {
    const value = answers[it.q.id] ?? "";
    return <span id={`q-${it.index}`} role="button" tabIndex={locked ? -1 : 0} aria-disabled={locked || undefined}
      aria-label={`Question ${it.number}${value ? `: ${value}` : ", empty"}`}
      className={`cbt-drop ${current === it.index ? "current" : ""} ${value ? "filled" : ""}`}
      onClick={() => select(it.index)} onFocus={() => select(it.index)}
      onKeyDown={e => { if ((e.key === "Delete" || e.key === "Backspace") && value) drop(it, ""); }}
      onDragOver={(e: DragEvent) => { if (!locked) e.preventDefault(); }}
      onDrop={(e: DragEvent) => { e.preventDefault(); drop(it, e.dataTransfer.getData("text/plain") || dragging); }}>
      {value || <strong>{it.number}</strong>}
      {value && !locked && <button type="button" className="cbt-clear" aria-label={`Clear question ${it.number}`} onClick={e => { e.stopPropagation(); drop(it, ""); }}>×</button>}
    </span>;
  };
  const textGap = (it: Item) => <input id={`q-${it.index}`} className={`cbt-gap ${current === it.index ? "current" : ""}`} aria-label={`Question ${it.number}`} autoComplete="off" spellCheck={false}
    value={answers[it.q.id] ?? ""} placeholder={String(it.number)} onFocus={() => select(it.index)} onChange={e => setAnswer(it.q.id, e.target.value)} />;
  const gap = (it: Item, g: Group) => g.chips ? zone(it) : textGap(it);
  // Text with "(N) ______" or a bare "(N)" placeholder renders the gap for question N in place.
  const inline = (text: string, g: Group, used: Set<number>) => text.split(/(\(\d+\)(?:\s*_{3,})?)/).map((piece, i) => {
    const n = /^\((\d+)\)/.exec(piece)?.[1], it = n ? g.items.find(x => x.number === Number(n)) : undefined;
    if (!it) return <Fragment key={i}>{piece}</Fragment>;
    used.add(it.number); return <Fragment key={i}>{gap(it, g)}</Fragment>;
  });

  const renderGroup = (g: Group, gi: number) => {
    const used = new Set<number>();
    const [direction = "", ...rest] = g.instructions ? g.instructions.split("\n\n") : [];
    const blocks = rest.map((para, pi) => {
      if (g.chips && g.chips.filter(c => para.includes(c)).length >= Math.min(3, g.chips.length)) return null;
      if (/\(\d+\)/.test(para) && para.includes("->")) return <ol key={pi} className="cbt-flow">{para.replace(/^[^:]*:\s*(?=\()/, "").split(/\s*->\s*/).map((step, si) => <li key={si}>{inline(step, g, used)}</li>)}</ol>;
      if (/\(\d+\)/.test(para)) return <p key={pi} className="cbt-summary">{inline(para, g, used)}</p>;
      if (para.length < 90 && !/[.?]$/.test(para)) return <h4 key={pi} className="cbt-title">{para}</h4>;
      return <p key={pi}>{para}</p>;
    });
    const rows = g.items.filter(it => !used.has(it.number));
    const chips = g.chips && <div className="cbt-chips" aria-label="Answer options">{g.chips.map(c => <button type="button" key={c} draggable={!locked} disabled={locked} className="cbt-chip"
      onDragStart={e => { e.dataTransfer.setData("text/plain", c); setDragging(c); }} onDragEnd={() => setDragging("")}
      onClick={() => { const target = g.items.find(it => it.index === current) ?? g.items.find(it => !answers[it.q.id]) ?? g.items[0]!; drop(target, c); }}>{c}</button>)}</div>;
    return <section key={gi} className="cbt-group" aria-labelledby={`group-${gi}`}>
      <h3 id={`group-${gi}`}>Questions {range(g.items)}</h3>
      {direction && <p className="cbt-direction">{emphasise(direction)}</p>}
      {/* Gaps inside a flow chart or summary keep their answer list alongside, as in the paper layout. */}
      {chips && used.size ? <div className="cbt-with-options"><div>{blocks}</div>{chips}</div> : <>{blocks}{chips}</>}
      {rows.map(it => {
        const value = answers[it.q.id] ?? "";
        if (g.chips) return <div key={it.q.id} className="cbt-match"><span className="cbt-stem">{it.stem}</span>{zone(it)}</div>;
        if (it.q.options.length) return <fieldset key={it.q.id} className={`cbt-question ${current === it.index ? "current" : ""}`} onFocus={() => select(it.index)}>
          <legend><span className="cbt-num">{it.number}</span> {it.stem}</legend>
          {it.q.options.map((o, oi) => <label key={o} className="cbt-option"><input id={oi === 0 ? `q-${it.index}` : undefined} type="radio" name={it.q.id} checked={value === o} onChange={() => setAnswer(it.q.id, o)} /><span>{o}</span></label>)}
        </fieldset>;
        const pieces = it.stem.split(GAP);
        return <p key={it.q.id} className={`cbt-question cbt-line ${current === it.index ? "current" : ""}`}>
          {pieces.length > 1 ? <>{pieces[0]}{textGap(it)}{pieces.slice(1).join("")}</> : <><span className="cbt-num">{it.number}</span> {it.stem} {textGap(it)}</>}
        </p>;
      })}
    </section>;
  };

  const partItems = items.filter(it => partOf(it) === part);
  const banner = speaking
    ? ["Speaking", "Record your answer to each question. Parts 1 to 3."]
    : writing
    ? [part, `You should spend about ${part === "Task 1" ? 20 : 40} minutes on this task. Write at least ${part === "Task 1" ? 150 : 250} words.`]
    : [part, `${section === "Listening" ? "Listen" : "Read the text"} and answer questions ${partItems.length ? range(partItems) : ""}.`];
  const prompt = writing ? questions.find(q => q.section === part) : undefined;
  const passages = section === "Reading" ? [...new Set(partItems.map(it => it.q.passage).filter(Boolean))] : [];
  const total = writing ? 2 : items.length;
  const go = (index: number) => focusQuestion(Math.max(0, Math.min(total - 1, index)));
  // One recording per Listening part: only the current part's player is shown.
  const audio = useMemo(() => [...new Set(questions.flatMap(q => q.assetIds ?? []))], [questions]);
  // A new part or section starts at the top of the page, like turning to a new screen.
  const body = useRef<HTMLDivElement>(null);
  // Highlights and notes on the passages and Writing tasks (kept in this browser for this attempt).
  const notes = useAnnotations(attempt.id), [notesOpen, setNotesOpen] = useState(false), [noteFocus, setNoteFocus] = useState<string>();
  const noteCount = notes.items.filter(a => a.note !== undefined).length;
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [section, part]);

  return <div className="cbt">
    <header className="cbt-header">
      <div className="cbt-who">
        <span className="cbt-brand" aria-label={`LEO PREP: ${props.institution}`}>LEO PREP</span>
        <span className="cbt-candidate"><strong>{props.candidate}</strong>
          <small>{section === "Listening" ? <><Icon name="headphones" size={14} /> {audioStatus === "playing" ? "Audio is playing" : audioStatus === "finished" ? "Audio finished" : "Audio not started"}</> : section}</small></span>
      </div>
      <div className="cbt-time">
        <h1 className="cbt-test-name">{attempt.name ?? "Assessment"}</h1>
        <strong aria-label="Time remaining" role="timer">{props.seconds >= 60 ? `${minutes} minutes left` : `${props.seconds} seconds left`}</strong>
        <nav className="cbt-steps" aria-label="Exam sections (opened in order)">{steps.map(s =>
          <button type="button" key={s} disabled={s !== section} aria-current={s === section ? "step" : undefined}>{s}</button>)}</nav>
      </div>
      <div className="cbt-tools">
        <span className={`cbt-signal ${props.connected ? "" : "offline"}`} title={props.connected ? "Connected" : "Offline"}><Signal /><span className="sr-only">{props.connected ? "Connected" : "Offline: timer stopped"}</span></span>
        <span className="cbt-saved" role="status">{props.saved}</span>
        <button type="button" className="cbt-icon-text" disabled={!props.connected || locked} onClick={props.onSave}>Save answers</button>
        {section !== "Listening" && annotationsSupported() && <button type="button" className="cbt-icon" aria-expanded={notesOpen} aria-label={`Notes (${noteCount})`} title="Notes" onClick={() => setNotesOpen(!notesOpen)}><Pencil /></button>}
        <button type="button" className="cbt-icon" aria-expanded={menu} aria-label="Display settings" onClick={() => setMenu(!menu)}><Icon name="menu" /></button>
      </div>
      {menu && <div className="cbt-menu" role="group" aria-label="Test options">
        <label>Colour theme<select value={attempt.theme} onChange={e => props.onDisplay({ theme: e.target.value as TestAttempt["theme"] })}><option value="standard">Black on white</option><option value="dark">White on black</option><option value="yellow">Yellow on black</option></select></label>
        <label>Font size<select value={attempt.fontSize} onChange={e => props.onDisplay({ fontSize: e.target.value as TestAttempt["fontSize"] })}><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra Large</option></select></label>
        {section === "Listening" && <label>Volume<input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>}
        {!last && <button type="button" className="cbt-icon-text" disabled={!props.connected || locked} onClick={props.onSubmitTest}>Submit test</button>}
        <Link to="/student/mock-tests">Exit test (answers stay saved)</Link>
      </div>}
    </header>

    <div className="cbt-body" ref={body}>
      <div className="cbt-banner"><strong>{banner[0]}</strong><span>{banner[1]}</span></div>
      {props.alerts}
      {section === "Listening" && <ListeningPlayer assetIds={audio} startPart={attempt.audioPart ?? 0} startMs={attempt.audioMs ?? 0} volume={volume} onProgress={props.onAudioProgress} onStatus={setAudioStatus} />}
      {speaking ? (devicesReady ? <fieldset className="cbt-fieldset cbt-speaking" disabled={locked}><SpeakingPractice attemptId={attempt.id} questions={questions} answers={answers} setAnswer={setAnswer} locked={locked} /></fieldset>
        : <div className="cbt-speaking"><p>Check your speakers and microphone before you start.</p><DeviceCheck onReady={setDevicesReady} /></div>) :
      <fieldset className="cbt-fieldset" disabled={locked}>
        {writing ? <div className="cbt-split">
          <div className="cbt-pane"><p className="cbt-prompt" data-annotate={prompt ? textKey("task", prompt.prompt) : undefined}>{prompt?.prompt ?? "No prompt supplied for this task."}</p>{prompt?.assetIds?.map(id => <img key={id} src={`/api/assets/${id}/stream`} alt={`${part} figure`} className="cbt-figure" />)}</div>
          <div className="cbt-pane"><label className="cbt-writing"><span className="sr-only">{part} response</span>
            <textarea id={`q-${current}`} value={answers[part] ?? ""} onChange={e => setAnswer(part, e.target.value)} spellCheck={false} /></label>
            <p className="cbt-words" role="status">Words: {wordCount(answers[part] ?? "")}</p></div>
        </div> : section === "Reading" ? <div className="cbt-split">
          <div className="cbt-pane cbt-passage" tabIndex={0} aria-label="Reading passage">{passages.length ? passages.map((p, i) => <div key={i} className="cbt-text" data-annotate={textKey("passage", p ?? "")}>{p}</div>) : <p>No passage has been supplied.</p>}</div>
          <div className="cbt-pane">{groups.filter(g => g.part === part).map(renderGroup)}</div>
        </div> : <div className="cbt-single">{groups.filter(g => g.part === part).map(renderGroup)}</div>}
      </fieldset>}
    </div>

    {!speaking && <div className="cbt-arrows">
      <button type="button" aria-label="Previous question" disabled={current <= 0} onClick={() => go(current - 1)}><Icon name="arrow" /></button>
      <button type="button" aria-label="Next question" disabled={current >= total - 1} onClick={() => go(current + 1)}><Icon name="arrow" /></button>
    </div>}
    <nav className="cbt-nav" aria-label="Question navigator">
      <div className="cbt-parts">{speaking ? <div className="cbt-part active"><strong>Speaking</strong><span>{questions.filter(q => answers[q.id]).length} of {questions.length} recorded</span></div> : parts.map(p => {
        const these = writing ? [] : items.filter(it => partOf(it) === p);
        const done = writing ? (wordCount(answers[p] ?? "") ? 1 : 0) : these.filter(it => answers[it.q.id]).length;
        const first = writing ? parts.indexOf(p) : these[0]?.index ?? 0;
        if (p !== part || writing) return <button type="button" key={p} aria-label={p} aria-current={p === part ? "true" : undefined} className={`cbt-part ${p === part ? "active" : ""}`} onClick={() => go(first)}>
          <strong>{p}</strong><span>{done} of {writing ? 1 : these.length}</span></button>;
        return <div key={p} className="cbt-part active"><strong>{p}</strong><span className="cbt-numbers">{these.map(it =>
          <button type="button" key={it.q.id} aria-label={`Question ${it.number}${answers[it.q.id] ? ", answered" : ""}`} aria-current={it.index === current ? "true" : undefined}
            className={`${answers[it.q.id] ? "answered" : ""} ${it.index === current ? "current" : ""}`} onClick={() => go(it.index)}>{it.number}</button>)}</span></div>;
      })}</div>
      <button type="button" className="cbt-finish" aria-label={finish} title={finish} disabled={!props.connected || locked || attempt.submittedSections?.includes(section)} onClick={last ? props.onSubmitTest : props.onSubmitSection}><Icon name="check" /></button>
    </nav>
    {section !== "Listening" && <AnnotationLayer scope={body} items={notes.items} setItems={notes.setItems} refreshKey={`${section}:${part}`} onOpenNote={id => { setNoteFocus(id); setNotesOpen(true); }} />}
    {notesOpen && section !== "Listening" && <NotesPanel items={notes.items} setItems={notes.setItems} focusId={noteFocus} onClose={() => setNotesOpen(false)} />}
  </div>;
}

function Pencil() {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /><path d="M20 20h-8" /></svg>;
}
function Signal() {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M2 8.5a15 15 0 0 1 20 0" /><path d="M5.5 12a10 10 0 0 1 13 0" /><path d="M9 15.5a5 5 0 0 1 6 0" /><circle cx="12" cy="19" r="1.2" fill="currentColor" /></svg>;
}
