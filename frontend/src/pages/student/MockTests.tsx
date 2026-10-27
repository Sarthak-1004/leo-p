import {Pagination} from "../../components/Pagination";
import {usePagination} from "../../utils/usePagination";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { MockTest } from "../../types/domain";
import { Badge, Button, Card, ContentContainer, EmptyState, LinkButton, Notice, PageHeader, Tabs } from "../../components/ui";
import { Icon } from "../../components/Icon";
import {skillIcon} from "../../components/iconNames";
import { courseName } from "../../utils/format";
import { isResultVisible } from "../../utils/scoring";

const testName = (test: MockTest) => `${test.kind === "PRACTICE_MOCK" ? "Practice Mock" : "Full Length Test"} ${String(test.number).padStart(2, "0")}`;

export function MockCard({ test }: { test: MockTest }) {
  const { results, students, course, attempts } = usePreview();
  const student = students.find((s) => s.course === course);
  const history = results.filter((r) => r.course === test.course && r.testId === test.id && r.studentId === student?.id);
  const started = attempts.filter((a) => a.testId === test.id && a.studentId === student?.id && a.course === course);
  const active = started.find((a) => a.state === "In progress");
  const used = Math.max(history.length, started.length);
  const limit = test.kind === "FLT" ? 1 : 2;
  const complete = used >= limit && !active;
  const locked = !test.published || (test.kind === "FLT" && !test.available);
  const visible = history.filter(isResultVisible).at(-1);
  return <Card className={`mock-card ${locked ? "locked" : ""}`}>
    <div className="row between"><span className="icon-tile"><Icon name={locked ? "lock" : complete ? "check" : "test"} size={18} /></span>
      <Badge tone={locked ? "gray" : complete ? "green" : "blue"}>{locked ? "Locked" : active ? "In progress" : complete ? (limit === 2 ? "Attempts used (2/2)" : "Completed") : "Available"}</Badge></div>
    <h3>{testName(test)}</h3>
    <p className="muted text-xs">Listening · Reading · Writing</p>
    <p className="muted text-xs">{used}/{limit} attempts used{test.kind === "FLT" ? " · Speaking offline" : ""}</p>
    {locked ? <Button variant="ghost" disabled><Icon name="lock" size={13} />{test.published ? "Course locked" : "Not published"}</Button>
      : active ? <LinkButton to={`/student/attempts/${active.id}`}>Resume test</LinkButton>
      : !complete ? <LinkButton to={`/student/mock-tests/${test.course}/${test.id}/instructions`}>{used ? "Start second attempt" : "Start test"}</LinkButton>
      : !visible ? <Badge tone="amber">{test.kind === "FLT" ? "Awaiting result release" : "Scoring pending"}</Badge> : null}
    {visible && <LinkButton secondary to={`/student/results/${visible.id}`}>View result</LinkButton>}
  </Card>;
}

export function MockTests({ practice = false }: { practice?: boolean }) {
  const { tests, course, results, students, attempts } = usePreview();
  const [filter, setFilter] = useState("All");
  const student = students.find((s) => s.course === course);
  const catalog = tests.filter((t) => t.course === course && t.kind === (practice ? "PRACTICE_MOCK" : "FLT"));
  const filtered = catalog.filter((t) => {
    const started = attempts.filter((a) => a.studentId === student?.id && a.testId === t.id);
    const completed = results.some((r) => r.studentId === student?.id && r.testId === t.id) || started.some((a) => a.state === "Submitted");
    const available = t.published && (practice || t.available);
    return filter === "All" || (filter === "Available" ? available : filter === "Locked" ? !available : filter === "In progress" ? started.some((a) => a.state === "In progress") : completed);
  });
  const pagination=usePagination(filtered,8);
  return <ContentContainer>
    <PageHeader title={practice ? "Practice Mock Tests" : "Full Length Tests"} description={practice ? "Three skills. Two attempts per test. Results after scoring." : "One attempt per test. Results released by Admin."} actions={<Badge>{courseName(course)}{!practice && " · 40 tests"}</Badge>} />
    <div className="actions"><LinkButton secondary to={practice ? "/student/mock-tests" : "/student/practice-mocks"}>{practice ? "Full Length Tests" : "Practice Mock Tests"}</LinkButton></div>
    <Tabs options={["All", "Available", "In progress", "Locked", "Completed"]} value={filter} onChange={value=>{setFilter(value);pagination.setPage(1);}} label="Test status" />
    <p className="muted text-xs">{practice ? "Published practice mocks need no Admin unlock. Sample catalogue; final test count is awaiting confirmation." : "Availability applies to all active students in your course. Speaking is conducted offline by your trainer."}</p>
    <div className="mock-grid">{pagination.items.map((t) => <MockCard key={t.id} test={t} />)}</div>
    {filtered.length>0&&<Pagination {...pagination}/>}
    {!filtered.length && <Card><EmptyState title="No tests in this view" /></Card>}
  </ContentContainer>;
}

export function MockInstructions() {
  const { courseId, testId } = useParams();
  const { tests, course, startAttempt, attempts, results, students, mode } = usePreview();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const test = tests.find((t) => t.course === courseId && t.id === testId);
  const student = students.find((s) => s.course === course);
  const started = attempts.filter((a) => a.testId === testId && a.studentId === student?.id);
  const active = started.find((a) => a.state === "In progress");
  const used = Math.max(started.length, results.filter((r) => r.testId === testId && r.studentId === student?.id).length);
  if (!test || test.course !== course || (!active && (!test.published || (test.kind === "FLT" && !test.available)))) return <ContentContainer><Card><EmptyState title="Test unavailable" description="Choose a published, available test in your assigned course." action={<LinkButton to="/student/mock-tests">Back to tests</LinkButton>} /></Card></ContentContainer>;
  const limit = test.kind === "FLT" ? 1 : 2;
  const exhausted = used >= limit && !active;
  return <ContentContainer>
    <PageHeader eyebrow="Tests / Instructions" title={testName(test)} description="Find a quiet space before starting." actions={<Badge>{courseName(test.course)}</Badge>} />
    {mode === "demo" ? <Notice>Frontend preview: sample questions and in-memory attempts. Reloading clears answers and attempt limits. Secure saving, scoring and server timing require the backend.</Notice> : <Notice>Starting counts as an attempt. Answers and time are saved when the server acknowledges each save. Resume the same attempt after an interruption.</Notice>}
    <div className="stats-grid">{(["Listening", "Reading", "Writing"] as const).map((skill, i) => <Card key={skill}><span className="icon-tile"><Icon name={skillIcon[skill]} /></span><h3 className="mt-4">{skill}</h3><p className="muted text-xs my-3">{["Audio plays at normal speed only.", "Read passages and answer questions.", "Complete Task 1 and Task 2."][i]}</p><Badge>{test.sectionDurations?.[skill]??test.builder?.duration[skill]??[30,60,60][i]} min{mode === "demo" ? " sample configuration" : ""}</Badge></Card>)}
      {test.kind === "FLT" && <Card><span className="icon-tile"><Icon name="mic" /></span><h3 className="mt-4">Speaking · Offline</h3><p className="muted text-xs my-3">Your trainer conducts the Speaking test and enters the marks.</p><Badge tone="gray">No recording in portal</Badge></Card>}</div>
    <Card><h2>Before you start</h2><ul className="list-disc pl-5 space-y-3 mt-5"><li>{limit === 1 ? "This Full Length Test allows one attempt." : "This Practice Mock Test allows two attempts."} Starting counts as an attempt; resuming does not.</li><li>Use the question palette and flag questions for review.</li><li>Display settings apply throughout the test.</li><li>Interrupted tests resume with remaining time. There is no manual pause button.</li><li>{test.kind === "FLT" ? "Your result becomes visible after Admin releases it." : "Your result becomes visible after scoring, without Admin release."}</li></ul></Card>
    <Card><label className="row text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{mode === "demo" ? "I understand the attempt limit and preview limitations." : "I understand the attempt limit and instructions."}</label><div className="actions mt-5"><LinkButton secondary to={test.kind === "FLT" ? "/student/mock-tests" : "/student/practice-mocks"}>Back to catalogue</LinkButton><Button disabled={!agreed || exhausted} onClick={async () => { const attempt = await startAttempt(test); if (attempt) navigate(`/student/attempts/${attempt.id}`); else setError("This test cannot be started. Check access and remaining attempts."); }}>{active ? "Resume test" : exhausted ? "Attempts used" : "Start test"}</Button></div>{error && <p role="alert" className="error-text mt-4">{error}</p>}</Card>
  </ContentContainer>;
}
