import { ListeningAudio } from "./ListeningAudio";
import { useState } from "react";
import type { Answers, Course, Question, Skill } from "../types/domain";
import { usePreview } from "../app/PreviewContext";
import { passages, writingPrompts } from "../mocks/practice";
import {
  Badge,
  Button,
  Card,
  Notice,
  ProgressBar,
  SectionTitle,
  Tabs,
} from "./ui";
import { Icon } from "./Icon";
import { wordCount } from "../utils/format";
export function QuestionFields({
  questions,
  answers,
  setAnswer,
  selectedQuestion,
  onQuestionChange,
}: {
  questions: Question[];
  selectedQuestion?: number;
  onQuestionChange?: (index: number) => void;
  answers: Answers;
  setAnswer: (id: string, answer: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const current = selectedQuestion ?? selected;
  return (
    <>
      <div className="question-palette mb-6" aria-label="Question navigation">
        {questions.map((q, i) => (
          <button
            key={q.id}
            aria-label={`Go to question ${i + 1}`}
            className={`${answers[q.id] ? "answered" : ""} ${current === i ? "selected" : ""} ${answers[`flag:${q.id}`] ? "flagged" : ""}`}
            onClick={() => {
              setSelected(i);
              onQuestionChange?.(i);
              document
                .getElementById(`question-${q.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              document.getElementById(`question-${q.id}`)?.focus();
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {questions.map((q, i) => (
        <fieldset
          className="question"
          id={`question-${q.id}`}
          key={q.id}
          tabIndex={-1}
          onFocus={() => { setSelected(i); onQuestionChange?.(i); }}
        >
          <legend>
            <span className="text-primary">{i + 1}.</span> {q.prompt}
          </legend>
          <label className="row text-xs mb-3"><input type="checkbox" checked={answers[`flag:${q.id}`] === "true"} onChange={(e) => setAnswer(`flag:${q.id}`, e.target.checked ? "true" : "")} />Flag question {i + 1} for review</label>
          {q.options.length ? (
            q.options.map((option) => (
              <label className="answer-option" key={option}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === option}
                  onChange={() => setAnswer(q.id, option)}
                />
                <span>{option}</span>
              </label>
            ))
          ) : (
            <label className="field">
              Your answer
              <input
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer"
              />
            </label>
          )}
        </fieldset>
      ))}
      <div className="actions mt-5"><Button variant="secondary" disabled={current<=0} onClick={()=>{const next=current-1;setSelected(next);onQuestionChange?.(next);document.getElementById(`question-${questions[next]?.id}`)?.focus();}}>Previous question</Button><span>Question {questions.length?current+1:0} of {questions.length}</span><Button variant="secondary" disabled={current>=questions.length-1} onClick={()=>{const next=current+1;setSelected(next);onQuestionChange?.(next);document.getElementById(`question-${questions[next]?.id}`)?.focus();}}>Next question</Button></div>
      <p className="sr-status mt-4" role="status">
        {questions.filter((q) => answers[q.id]).length} of {questions.length}{" "}
        answered · In this view only
      </p>
    </>
  );
}
export function AudioPlaceholder({ practice = false }: { practice?: boolean }) {
  const [speed, setSpeed] = useState("1");
  return (
    <div>
      <div className="row between">
        <span className="icon-tile">
          <Icon name="headphones" />
        </span>
        <Badge tone="gray">Audio asset pending</Badge>
      </div>
      <h3 className="mt-4">Campus accommodation briefing</h3>
      <div className="actions mt-4"><Button disabled variant="secondary"><Icon name="play" />Play audio</Button><label className="field">Volume<input aria-label="Audio volume" type="range" min="0" max="1" step="0.1" defaultValue="1" disabled /></label></div>
      {practice ? <label className="field mt-4">Playback speed<select aria-label="Playback speed" value={speed} onChange={(e) => setSpeed(e.target.value)}><option value="1">1x (normal)</option><option value="1.5">1.5x</option><option value="2">2x</option></select><span className="muted text-xs">Playback requires an audio asset. New attempts default to 1x.</span></label> : <p className="muted text-xs mt-3">Normal speed only</p>}
      <p className="muted text-xs mt-2">Listening · Bramble Hall</p>
      <div className="waveform" aria-hidden="true">
        {Array.from({ length: 35 }, (_, i) => (
          <i key={i} style={{ height: `${12 + ((i * 17) % 47)}px` }} />
        ))}
      </div>
      <Notice>
        The assessment audio is not supplied yet. Use the sample transcript to
        explore the questions.
      </Notice>
      <details className="mt-5">
        <summary className="text-primary text-xs cursor-pointer font-semibold">
          Sample transcript
        </summary>
        <p className="passage text-sm mt-3">
          Welcome to Bramble Hall. Our residence is a short walk from the
          science labs. Riverside Annexe offers laundry services. The refundable
          deposit is £350.
        </p>
      </details>
    </div>
  );
}
export function ReadingPassage({ course, test = false }: { course: Course; test?: boolean }) {
  const [fontSize, setFontSize] = useState(14);
  const passage = passages[course];
  return (
    <>
      <SectionTitle
        title="Reading passage"
        detail={!test &&
          <div className="row">
            <button
              className="icon-button text-xs"
              aria-label="Decrease passage text size"
              onClick={() => setFontSize((v) => Math.max(12, v - 1))}
            >
              A−
            </button>
            <button
              className="icon-button text-xs"
              aria-label="Increase passage text size"
              onClick={() => setFontSize((v) => Math.min(22, v + 1))}
            >
              A+
            </button>
          </div>
        }
      />
      <h2>{passage.title}</h2>
      <div className="passage" style={test ? undefined : { fontSize }}>
        {passage.paragraphs.map(([heading, text], i) => (
          <section key={heading}>
            <h3>
              <span className="text-primary mr-2">
                {String.fromCharCode(65 + i)}
              </span>
              {heading}
            </h3>
            <p>{text}</p>
          </section>
        ))}
      </div>
    </>
  );
}
export function WritingEditor({
  course,
  drafts,
  setDraft,
  onlyTask,
  prompts,
  selectedTask,
  onTaskChange,
}: {
  course: Course;
  onlyTask?: string;
  prompts?: Question[];
  selectedTask?: string;
  onTaskChange?: (task:string)=>void;
  drafts: Answers;
  setDraft: (key: string, value: string) => void;
}) {
  const [task, setTask] = useState("Task 1");
  const activeTask = onlyTask || selectedTask || task;
  const actualPrompt = prompts?.find(q => q.section === activeTask);
  const index = activeTask === "Task 1" ? 0 : 1;
  const count = wordCount(drafts[activeTask] || "");
  const target = index === 0 ? 150 : 250;
  return (
    <div className="stack">
      {!onlyTask && <Tabs
        options={["Task 1", "Task 2"]}
        value={selectedTask ?? task}
        onChange={value=>{setTask(value);onTaskChange?.(value);}}
        label="Writing tasks"
      />}
      <div className="practice-columns">
        <Card>
          <div className="row between mb-5">
            <Badge>
              {course === "GENERAL" && index === 0
                ? "Letter"
                : index === 0
                  ? "Data summary"
                  : "Essay"}
            </Badge>
            <span className="muted text-xs">
              {index === 0 ? "20" : "40"} min reference
            </span>
          </div>
          <h2>
            {activeTask}:{" "}
            {index === 0
              ? course === "GENERAL"
                ? "Letter writing"
                : "Describe the main features"
              : "Develop your argument"}
          </h2>
          <p className="muted mt-5 leading-8">
            {prompts ? actualPrompt?.prompt ?? "No prompt supplied for this task." : writingPrompts[course][index]}
          </p>
          {actualPrompt?.assetIds?.map(id => <img key={id} src={`/api/assets/${id}/stream`} alt="Writing task figure" className="max-w-full mt-4" />)}
          <Notice>
            Write at least {target} words. {prompts ? "" : "This is a sample practice prompt."}
          </Notice>
          <div className="mt-6">
            <h3>Before you finish</h3>
            <div className="stack mt-4">
              {[
                "Address every part of the task",
                "Organise ideas into clear paragraphs",
                "Check grammar and spelling",
              ].map((text) => (
                <label key={text} className="row text-xs">
                  <input type="checkbox" />
                  {text}
                </label>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle
            title="Your response"
            detail={<Badge tone="gray">{prompts?"Writing response":"Temporary draft"}</Badge>}
          />
          <label className="field">
            <span className="sr-only">{activeTask} response</span>
            <textarea
              className="editor"
              value={drafts[activeTask] || ""}
              onChange={(e) => setDraft(activeTask, e.target.value)}
              placeholder={
                index === 0 && course === "GENERAL"
                  ? "Dear Sir or Madam, …"
                  : "Start writing here…"
              }
            />
          </label>
          <div className="editor-footer">
            <span role="status">
              <strong>{count}</strong> / {target} words
            </span>
            <Badge tone={count >= target ? "green" : "amber"}>
              {count >= target ? "Target reached" : "Keep writing"}
            </Badge>
          </div>
          <div className="mt-4">
            <ProgressBar
              value={Math.min(100, (count / target) * 100)}
              label="Word target"
            />
          </div>
          <p className="muted text-xs mt-4">
            {prompts ? "Your answers are saved when the server confirms the save." : "Draft held in preview memory. AI Writing evaluation is not connected."}
          </p>
        </Card>
      </div>
    </div>
  );
}
export function ObjectivePractice({
  skill,
  course,
  answers,
  setAnswer,
  practice = false,
  questionType,
  section,
  selectedQuestion,
  onQuestionChange,
  questionsOverride,
}: {
  questionsOverride?: Question[];
  skill: Skill;
  practice?: boolean;
  questionType?: string;
  section?: string;
  selectedQuestion?: number;
  onQuestionChange?: (index: number) => void;
  course: Course;
  answers: Answers;
  setAnswer: (key: string, value: string) => void;
}) {
  const { questions } = usePreview();
  const [localQuestion,setLocalQuestion]=useState(0);
  const activeQuestion=selectedQuestion??localQuestion;
  const selectQuestion=(index:number)=>{setLocalQuestion(index);onQuestionChange?.(index);};
  const filtered = questionsOverride ?? questions.filter(
    (q) =>
      q.skill === skill &&
      q.published &&
      (q.course === course || q.course === "BOTH") &&
      (!questionType || q.questionType === questionType) && (!section || q.section === section),
  );
  return (
    <div className="practice-columns">
      <Card>
        {skill === "Listening" ? (
          questionsOverride ? <ListeningAudio assetIds={[...new Set(questionsOverride.flatMap(q => q.assetIds ?? []))]} practice={practice} /> : <AudioPlaceholder practice={practice} />
        ) : (
          questionsOverride ? <div className="passage"><SectionTitle title={filtered[activeQuestion]?.section ?? "Reading passage"} /><div className="actions mb-4">{[...new Set(filtered.map(q=>q.passage))].map((passage,index)=><Button key={index} variant="secondary" onClick={()=>selectQuestion(Math.max(0,filtered.findIndex(q=>q.passage===passage)))}>Passage {index+1}</Button>)}</div><p className="whitespace-pre-wrap">{filtered[activeQuestion]?.passage || "No passage has been supplied."}</p></div> : <ReadingPassage course={course} test={!practice} />
        )}
      </Card>
      <Card>
        <SectionTitle
          title="Question workbench"
          detail={<Badge>{filtered.length} questions</Badge>}
        />
        <QuestionFields
          selectedQuestion={activeQuestion}
          onQuestionChange={selectQuestion}
          questions={filtered}
          answers={answers}
          setAnswer={setAnswer}
        />
      </Card>
    </div>
  );
}
