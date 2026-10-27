import { LiveExam } from "./LiveExam";
import { activeStudent } from "../../utils/policy";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { ObjectivePractice, WritingEditor } from "../../components/Assessment";
import { Badge, Button, ContentContainer, EmptyState, LinkButton, Modal, Notice, PageHeader, Tabs } from "../../components/ui";
import type { TestAttempt } from "../../types/domain";
import { Icon } from "../../components/Icon";

const sections = ["Listening", "Reading", "Writing"] as const;
export function Exam() { const {mode}=usePreview(); return mode === "live" ? <LiveExam /> : <DemoExam />; }
function DemoExam() {
  const { attemptId } = useParams();
  const { course, tests, attempts, students, updateAttempt, status } = usePreview();
  const [confirm, setConfirm] = useState(false);
  const [display, setDisplay] = useState(false);
  const [connected, setConnected] = useState(navigator.onLine && !document.hidden);
  const student = students.find((s) => s.course === course);
  const attempt = attempts.find((a) => a.id === attemptId && a.course === course && a.studentId === student?.id);
  const test = tests.find((t) => t.id === attempt?.testId && t.course === course);
  const current = useRef(attempt);
  const commit = useRef(updateAttempt);
  useEffect(() => { current.current = attempt; commit.current = updateAttempt; }, [attempt, updateAttempt]);
  const running = attempt?.state === "In progress";
  useEffect(() => {
    if (!running) return;
    let active = navigator.onLine && !document.hidden;
    const change = () => {
      const next = navigator.onLine && !document.hidden;
      if (active && !next && current.current) commit.current({ ...current.current, interruptions: current.current.interruptions + 1 });
      active = next;
      setConnected(next);
    };
    const timer = window.setInterval(() => {
      const value = current.current;
      if (active && value && value.state === "In progress" && value.remainingSeconds > 0) {
        commit.current({ ...value, remainingSeconds: Math.max(0, value.remainingSeconds - 1) });
      }
    }, 1000);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    document.addEventListener("visibilitychange", change);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      document.removeEventListener("visibilitychange", change);
    };
  }, [attemptId, running]);
  if (status === "loading") return <ContentContainer><p role="status">Loading assessment preview…</p></ContentContainer>;
  if (!attempt || !test || !student || !activeStudent(student)) return <ContentContainer><EmptyState title="Assessment unavailable" description="Start or resume a test from your course catalogue." action={<LinkButton to="/student/mock-tests">Back to tests</LinkButton>} /></ContentContainer>;
  const patch = (changes: Partial<TestAttempt>) => updateAttempt({ ...attempt, ...changes });
  if (attempt.state === "Submitted") return <ContentContainer><PageHeader title="Attempt submitted in preview" /><Notice>Your responses remain in this preview session. Scoring and remote saving are not connected.</Notice><p>{test.kind === "FLT" ? "Writing evaluation and offline Speaking marks are pending. Admin releases the final result." : "Results will appear once scoring is complete; no Admin release is required."}</p><LinkButton to="/student/history">View test history</LinkButton></ContentContainer>;
  const section = sections[attempt.section] || "Listening";
  const sectionAnswers = Object.fromEntries(Object.entries(attempt.answers).filter(([key]) => key.startsWith(section + ":")).map(([key, value]) => [key.slice(section.length + 1), value]));
  const setAnswer = (key: string, value: string) => patch({ answers: { ...attempt.answers, [section + ":" + key]: value } });
  const expired = attempt.remainingSeconds <= 0;
  return <div className={`test-display test-theme-${attempt.theme} test-font-${attempt.fontSize}`}>
    <ContentContainer>
      <div className="exam-toolbar">
        <Tabs options={sections} value={section} onChange={(value) => patch({ section: sections.indexOf(value), question: 0 })} label="Exam sections" />
        <div className="actions"><Icon name="clock" /><strong aria-label="Preview remaining time">{String(Math.floor(attempt.remainingSeconds / 60)).padStart(2, "0")}:{String(attempt.remainingSeconds % 60).padStart(2, "0")}</strong><Badge tone="amber">Preview timer</Badge><Button variant="secondary" onClick={() => setDisplay(!display)}><Icon name="settings" size={16} />Display settings</Button></div>
      </div>
      {display && <div className="card form-grid" aria-label="Test display settings">
        <label className="field">Colour theme<select value={attempt.theme} onChange={(e) => patch({ theme: e.target.value as TestAttempt["theme"] })}><option value="standard">Black on white</option><option value="dark">White on black</option><option value="yellow">Yellow on black</option></select></label>
        <label className="field">Font size<select value={attempt.fontSize} onChange={(e) => patch({ fontSize: e.target.value as TestAttempt["fontSize"] })}><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra Large</option></select></label>
      </div>}
      <PageHeader title={`Section ${attempt.section + 1}: ${section}`} description={`${test.kind === "FLT" ? "Full Length Test" : "Practice Mock"} ${String(test.number).padStart(2, "0")} · Attempt ${attempt.number} of ${test.kind === "FLT" ? 1 : 2}`} />
      {!connected && <Notice>Connection interrupted. The preview timer has stopped.</Notice>}
      {expired && <Notice>The preview time has ended. Submit your responses to complete this attempt.</Notice>}
      <fieldset disabled={expired || !connected} className="min-w-0 border-0 p-0">
        {section === "Writing" ? <WritingEditor course={course} drafts={sectionAnswers} setDraft={setAnswer} /> : <ObjectivePractice skill={section} course={course} answers={sectionAnswers} setAnswer={setAnswer} selectedQuestion={attempt.question} onQuestionChange={(question) => patch({ question })} />}
      </fieldset>
      <p className="muted text-xs" role="status">Responses kept in preview memory · {attempt.interruptions} interruptions · Refresh recovery requires backend integration</p>
    </ContentContainer>
    <div className="exam-footer"><Button variant="ghost" disabled={attempt.section === 0} onClick={() => patch({ section: attempt.section - 1, question: 0 })}>Previous section</Button><span className="text-xs muted">Speaking is conducted offline</span>{section === "Writing" || expired ? <Button onClick={() => setConfirm(true)}>Submit test</Button> : <Button onClick={() => patch({ section: attempt.section + 1, question: 0 })}>Submit section & continue <Icon name="arrow" size={16} /></Button>}</div>
    {confirm && <Modal title="Submit this attempt?" onClose={() => setConfirm(false)}><div className="stack"><p>Submitted responses cannot be edited. This counts toward the test's attempt limit.</p><Notice>This records the submission in preview memory only. It does not produce a score.</Notice><Button onClick={() => { patch({ state: "Submitted" }); setConfirm(false); }}>Confirm submission</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Keep working</Button></div></Modal>}
  </div>;
}
