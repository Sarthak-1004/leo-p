import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../utils/usePagination";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { Badge, Card, ContentContainer, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard, Tabs } from "../../components/ui";
import type { Result } from "../../types/domain";
import { courseName, dateLabel } from "../../utils/format";

const assignedTo=(result:Result,studentTrainer?:string)=>result.assignedTrainerId===undefined?studentTrainer:result.assignedTrainerId;
function EvaluationRows({ results }: { results: Result[] }) {
  const { students, trainers } = usePreview();
  if (!results.length) return <EmptyState title="No evaluations found" />;
  return <div className="stack">{results.map((result) => <div className="mobile-record" key={result.id}>
    <div className="row between"><div><h3>{students.find((student) => student.id === result.studentId)?.name ?? result.studentId}</h3><p className="muted text-xs">{result.name} · {courseName(result.course)} · {dateLabel(result.date)}</p></div><Badge tone={result.reviewStatus === "Completed" ? "green" : "amber"}>{result.reviewStatus}</Badge></div>
    <div className="actions"><Badge tone={result.aiStatus === "Failed" ? "red" : "gray"}>Writing AI: {result.aiStatus}</Badge>{result.kind === "FLT" && result.speaking === null && <Badge tone="amber">Speaking marks pending</Badge>}{result.reviewStatus === "In review" && result.evaluatedBy && <span className="text-xs">Being checked by {trainers.find((trainer) => trainer.id === result.evaluatedBy)?.name ?? result.evaluatedBy}</span>}</div>
    <Link className="table-link" to={`/trainer/evaluations/${result.id}`}>Open marksheet →</Link>
  </div>)}</div>;
}

export function TrainerDashboard() {
  const { students, results, trainers, trainerId, notifications } = usePreview();
  const trainer = trainers.find((item) => item.id === trainerId);
  const assigned = students.filter((student) => student.trainerId === trainerId);
  const queue = results.filter(result=>assignedTo(result,students.find(s=>s.id===result.studentId)?.trainerId)===trainerId);
  const pending = queue.filter((result) => result.reviewStatus !== "Completed");
  const completed = results.filter((result) => result.reviewStatus === "Completed" && result.evaluatedBy === trainerId);
  return <ContentContainer>
    <PageHeader eyebrow="Trainer workspace" title={`Welcome, ${trainer?.name ?? "Trainer"}`} description="Review marksheets and record offline Speaking scores." actions={<LinkButton to="/trainer/evaluations">Open evaluation queue</LinkButton>} />
    <div className="stats-grid">
      <StatCard label="Assigned students" value={assigned.length} icon="users" />
      <StatCard label="Pending evaluations" value={pending.length} detail="Your assigned queue" icon="clock" />
      <StatCard label="Completed by you" value={completed.length} detail="Includes other trainers' students" icon="check" />
      <StatCard label="Speaking marks pending" value={queue.filter((result) => result.kind === "FLT" && result.speaking === null).length} detail="Offline tests" icon="mic" />
    </div>
    <div className="two-column"><Card><SectionTitle title="Your evaluation queue" detail={<Badge>{pending.filter((result) => result.writing === null).length} Writing pending</Badge>} /><EvaluationRows results={pending.slice(0, 4)} /></Card>
      <Card><SectionTitle title="Recent notifications" detail={<Link to="/trainer/notifications">View all →</Link>} />{notifications.filter((notification) => notification.role === "trainer" && (!notification.recipientId || notification.recipientId === trainerId)).slice(0, 5).map((notification) => <div className="list-row" key={notification.id}><Link className="table-link" to={notification.href}>{notification.title}</Link>{!notification.read && <Badge>New</Badge>}</div>)}<div className="mt-6"><LinkButton secondary to="/trainer/students">View all students</LinkButton></div></Card></div>
    <Card><SectionTitle title="Recently completed" /><EvaluationRows results={completed.slice(0, 4)} /></Card>
  </ContentContainer>;
}

export function TrainerStudents() {
  const { students, trainers, trainerId, results } = usePreview();
  const [scope, setScope] = useState("My assigned students");
  const [search, setSearch] = useState("");
  const [assignedTrainer, setAssignedTrainer] = useState("");
  const filtered = students.filter((student) => (scope === "All students" || student.trainerId === trainerId) && (!assignedTrainer || student.trainerId === assignedTrainer) && `${student.name} ${student.id}`.toLowerCase().includes(search.toLowerCase()));
  const pagination=usePagination(filtered);
  return <ContentContainer><PageHeader title="Students" description="Academic profiles and marksheets across both courses." />
    <Tabs options={["My assigned students", "All students"]} value={scope} onChange={setScope} label="Student scope" />
    <Card><div className="form-grid mb-6"><label className="field">Search students<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or Student ID" /></label><label className="field">Assigned trainer<select value={assignedTrainer} onChange={(event) => setAssignedTrainer(event.target.value)}><option value="">All trainers</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label></div>
      {!filtered.length ? <EmptyState title="No matching students" /> : <div className="stack">{pagination.items.map((student) => {
        const history = results.filter((result) => result.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
        const latest = history.find((result) => result.overall !== null);
        return <div className="mobile-record" key={student.id}><div className="row between"><div><h3>{student.name}</h3><p className="muted text-xs">{student.id} · {courseName(student.course)}</p></div><Badge>{trainers.find((trainer) => trainer.id === student.trainerId)?.name ?? "Unassigned"}</Badge></div><div className="actions text-xs"><span>{history.filter((result) => result.kind === "FLT").length} Full Length Tests</span><span>{history.filter((result) => result.kind === "FLT" && result.reviewStatus !== "Completed").length} pending reviews</span><span>Latest band: {latest?.overall?.toFixed(1) ?? "Pending"}</span><span>Last activity: {history[0] ? dateLabel(history[0].date) : "No attempts"}</span></div><Link to={`/trainer/students/${student.id}`} className="table-link">View academic profile →</Link></div>;
      })}</div>}
    </Card><Pagination {...pagination} />
  </ContentContainer>;
}

export function TrainerStudentProfile() {
  const { studentId } = useParams();
  const { students, results, trainers } = usePreview();
  const student = students.find((item) => item.id === studentId);
  if (!student) return <ContentContainer><EmptyState title="Student not found" action={<LinkButton to="/trainer/students">Back to students</LinkButton>} /></ContentContainer>;
  const history = results.filter((result) => result.studentId === student.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const state = !student.enabled ? "Disabled" : student.expiryDate < today ? "Expired" : student.startDate > today ? "Not started" : "Active";
  return <ContentContainer><PageHeader eyebrow="Academic profile" title={student.name} description={`${student.id} · ${courseName(student.course)}`} actions={<LinkButton secondary to="/trainer/students">Back to students</LinkButton>} />
    <Card><SectionTitle title="Student overview" detail={<Badge tone={state === "Active" ? "green" : "gray"}>{state}</Badge>} /><div className="list-row"><span>Assigned trainer</span><strong>{trainers.find((trainer) => trainer.id === student.trainerId)?.name ?? "Unassigned"}</strong></div><div className="list-row"><span>Practice attempts</span><strong>{history.filter((result) => result.kind !== "FLT").length}</strong></div><div className="list-row"><span>Full Length Tests</span><strong>{history.filter((result) => result.kind === "FLT").length}</strong></div></Card>
    <Card><SectionTitle title="Full Length Test marksheets" /><EvaluationRows results={history.filter((result) => result.kind === "FLT")} /></Card>
    <Card><SectionTitle title="Practice history" />{history.filter((result) => result.kind !== "FLT").length ? history.filter((result) => result.kind !== "FLT").map((result) => <div className="list-row" key={result.id}><div><Link className="table-link" to={`/trainer/evaluations/${result.id}`}>{result.name}</Link><p className="muted text-xs">{dateLabel(result.date)}</p></div><Badge>{result.overall?.toFixed(1) ?? "Scoring pending"}</Badge></div>) : <EmptyState title="No practice attempts yet" />}</Card>
  </ContentContainer>;
}

export function EvaluationQueue() {
  const { students, results, trainerId,trainers } = usePreview();
  const [course,setCourse]=useState("");const [teacher,setTeacher]=useState("");const [kind,setKind]=useState("");
  const [scope, setScope] = useState("My assigned students");
  const [status, setStatus] = useState("Pending");
  const [search, setSearch] = useState("");
  const filtered = results.filter((result) => {
    const student = students.find((item) => item.id === result.studentId);
    return (!kind || result.kind === kind) && (!course||result.course===course) && (!teacher||assignedTo(result,student?.trainerId)===teacher) && (scope === "All students" || assignedTo(result,student?.trainerId) === trainerId)
      && `${result.name} ${result.studentId} ${student?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
      && (status === "All" || (status === "Pending" && result.reviewStatus !== "Completed") || (status === "Writing pending" && result.writing === null) || (status === "Speaking marks pending" && result.kind === "FLT" && result.speaking === null) || (status === "Recheck required" && result.aiStatus === "Failed") || (status === "Completed" && result.reviewStatus === "Completed"));
  });
  const pagination=usePagination(filtered);
  return <ContentContainer><PageHeader title="Evaluation queue" description="Assignments route work; every trainer can review every student." /><Tabs options={["My assigned students", "All students"]} value={scope} onChange={setScope} label="Evaluation scope" /><Card><div className="form-grid mb-6"><label className="field">Search marksheets<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student or test" /></label><label className="field">Course<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Both courses</option><option value="GENERAL">General</option><option value="ACADEMIC">Academic</option></select></label><label className="field">Assessment type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option><option value="FLT">Full Length Tests</option><option value="PRACTICE_MOCK">Practice Mocks</option><option value="PRACTICE">Module practice</option></select></label><label className="field">Assigned trainer<select value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">All trainers</option>{trainers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="field">Evaluation status<select value={status} onChange={(event) => setStatus(event.target.value)}>{["All", "Pending", "Writing pending", "Speaking marks pending", "Recheck required", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></label></div><EvaluationRows results={pagination.items} /><Pagination {...pagination}/></Card></ContentContainer>;
}

export function TrainerProfile() {
  const { trainerId, trainers, students, results } = usePreview();
  const trainer = trainers.find((item) => item.id === trainerId);
  if (!trainer) return <ContentContainer><EmptyState title="Trainer not found" /></ContentContainer>;
  return <ContentContainer><PageHeader title={trainer.name} description="Trainer profile" /><Card>{[["Trainer ID", trainer.id], ["Email", trainer.email], ["Status", trainer.enabled ? "Active" : "Disabled"], ["Assigned students", String(students.filter((student) => student.trainerId === trainerId).length)], ["Completed evaluations", String(results.filter((result) => result.evaluatedBy === trainerId && result.reviewStatus === "Completed").length)]].map(([label, value]) => <div className="list-row" key={label}><span className="muted text-sm">{label}</span><strong className="text-sm">{value}</strong></div>)}</Card></ContentContainer>;
}
