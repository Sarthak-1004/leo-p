import { LivePractice } from "./LivePractice";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { ObjectivePractice, WritingEditor } from "../../components/Assessment";
import { Badge, Button, Card, ContentContainer, EmptyState, LinkButton, Modal, Notice, PageHeader, Tabs } from "../../components/ui";
import type { Answers, Skill } from "../../types/domain";
import { courseName } from "../../utils/format";

export function Practice({ skill }: { skill: Skill }) { const {mode}=usePreview(); return mode === "live" && skill !== "Speaking" ? <LivePractice skill={skill} /> : <DemoPractice skill={skill} />; }
function DemoPractice({ skill }: { skill: Skill }) {
  const { course, questions, students, addPracticeRecord } = usePreview();
  const student = students.find((s) => s.course === course);
  const { practiceId } = useParams();
  const [answers, setAnswers] = useState<Answers>({});
  const [review, setReview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState("Question type");
  const [selection, setSelection] = useState("");
  const [attemptRevision, setAttemptRevision] = useState(0);
  const [seconds, setSeconds] = useState(20 * 60);
  const eligible = questions.filter((q) => q.skill === skill && q.published && (q.course === course || q.course === "BOTH"));
  const choices = skill === "Writing" ? ["Task 1", "Task 2"] : [...new Set(eligible.map((q) => mode === "Question type" ? q.questionType : q.section).filter((value): value is string => !!value))];
  const selected = choices.includes(selection) ? selection : choices[0] || "";
  const displayed = eligible.filter((q) => !selected || (mode === "Question type" ? q.questionType : q.section) === selected);
  const update = (key: string, value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));
  useEffect(() => {
    if (skill !== "Writing" || submitted) return;
    const timer = setInterval(() => { if (navigator.onLine && !document.hidden) setSeconds((value) => Math.max(0, value - 1)); }, 1000);
    return () => clearInterval(timer);
  }, [skill, submitted]);
  if (skill === "Speaking") return <ContentContainer><Card className="locked"><EmptyState title="Speaking is conducted offline by your trainer." description="Speaking practice, recording and submission are unavailable in the portal." action={<LinkButton to="/student/practice">Back to practice</LinkButton>} /></Card></ContentContainer>;
  if (practiceId !== "sample") return <ContentContainer><EmptyState title="Practice not found" action={<LinkButton to="/student/practice">Back to practice</LinkButton>} /></ContentContainer>;
  const answered = displayed.filter((q) => answers[q.id]?.trim());
  const correct = displayed.filter((q) => (Array.isArray(q.answer)?q.answer:[q.answer]).some(key=>answers[q.id]?.trim().toLowerCase()===key.trim().toLowerCase())).length;
  return <ContentContainer>
    <PageHeader eyebrow={`Practice / ${courseName(course)}`} title={`${skill} practice`} description="Choose a question type or practise a complete section." actions={<Badge>{courseName(course)}</Badge>} />
    <div className="actions"><Tabs options={["Question type", "Section"]} value={mode} onChange={(value) => { setMode(value); setSelection(""); setSubmitted(false); setAnswers({}); }} label="Practice mode" /><label className="field">{mode}<select value={selected} onChange={(e) => { setSelection(e.target.value); setAnswers({}); setSubmitted(false); setSeconds(e.target.value === "Task 2" ? 40 * 60 : 20 * 60); }}>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>{skill === "Writing" && <Badge tone="amber">Preview timer {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Badge>}</div>
    {skill === "Writing" ? <><Notice>The preview timer stops when disconnected or the page is hidden. Refresh recovery and remote saving require the backend.</Notice><fieldset disabled={seconds === 0 || submitted} className="border-0 p-0 min-w-0"><WritingEditor course={course} drafts={answers} setDraft={update} onlyTask={selected} /></fieldset></> : displayed.length ? <fieldset disabled={submitted} className="border-0 p-0 min-w-0"><ObjectivePractice key={mode + selected + attemptRevision} skill={skill} course={course} answers={answers} setAnswer={update} practice questionType={mode === "Question type" ? selected : undefined} section={mode === "Section" ? selected : undefined} /></fieldset> : <Card><EmptyState title="No published questions for this selection" /></Card>}
    <div className="actions justify-between"><LinkButton secondary to="/student/practice">Back to practice</LinkButton><Button onClick={() => { if (!submitted && student) { addPracticeRecord({ id: crypto.randomUUID(), studentId: student.id, course, skill, date: new Date().toISOString(), correct: skill === "Writing" ? null : correct, total: skill === "Writing" ? null : displayed.length, answers: { ...answers } }); setSubmitted(true); } setReview(true); }}>{submitted ? "View submission" : "Submit practice"}</Button>{submitted && <Button variant="secondary" onClick={() => { setAttemptRevision(v => v + 1); setSubmitted(false); setAnswers({}); setSeconds(selected === "Task 2" ? 40 * 60 : 20 * 60); }}>New practice attempt</Button>}</div>
    {review && <Modal title="Practice preview review" onClose={() => setReview(false)}><div className="stack">
      <Notice>{skill === "Writing" ? "Writing requires AI evaluation or trainer review. No score has been generated." : `Sample answer-key score: ${correct}/${displayed.length}. ${answered.length} questions answered. This short set does not produce a full IELTS band.`}</Notice>
      <p className="muted text-xs">Submission added to your preview history. It resets on reload; remote saving is not connected.</p>
      {Object.entries(answers).filter(([key, value]) => !key.startsWith("flag:") && value.trim()).map(([key, value]) => <div key={key}><h3>{key}</h3><p className="muted text-sm whitespace-pre-wrap break-words mt-2">{value}</p></div>)}
      {!Object.values(answers).some(Boolean) && <p>No responses entered yet.</p>}
      <Button onClick={() => setReview(false)}>Close review</Button>
    </div></Modal>}
  </ContentContainer>;
}
