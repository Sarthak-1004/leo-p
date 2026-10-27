import {ReleaseScope} from "../../components/ReleaseScope";
import { activeStudent } from "../../utils/policy";
import { canRelease, overallBand } from "../../utils/scoring";
import { Link } from "react-router";
import { useState } from "react";
import { usePreview } from "../../app/PreviewContext";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  ProgressRing,
  SectionTitle,
  StatCard,
  Tabs,
} from "../../components/ui";
import { ResultRows } from "../student/Results";
import { courseName } from "../../utils/format";
import type { Course } from "../../types/domain";
export function ActivityChart() {
  const {results,mode}=usePreview();
  const [chartTime]=useState(() => Date.now());
  const dates=Array.from({length:7},(_,i)=>new Date(chartTime-(6-i)*86400000).toISOString().slice(0,10));
  const values=mode === "demo" ? [6,8,9,7,8,12,10] : dates.map(date=>results.filter(r=>r.date.slice(0,10)===date).length);
  return (
    <div>
      <div
        className="metric-bars"
        role="img"
        aria-label={`Assessment counts for the last 7 days: ${values.join(", ")}`}
      >
        {values.map((n, i) => (
          <div className="metric-bar" key={i}>
            <small>{n}</small>
            <div style={{ height: `${n * 9}px` }} />
            <small>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
            </small>
          </div>
        ))}
      </div>
      <p className="muted text-xs mt-5">
        Illustrative weekly activity · Sample counts
      </p>
    </div>
  );
}
export function AdminDashboard() {
  const { students, tests, results, progress, trainers, mode, statistics } = usePreview();
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Administration"
        title="Operations & academic dashboard"
        description="A clear overview of students, practice and course content."
        actions={<LinkButton to="/admin/students">Manage students</LinkButton>}
      />
      {mode === "demo" && <Notice>
        Preview data only. Account, access and publication changes are
        temporary.
      </Notice>}
      <div className="stats-grid">
        <StatCard
          label="Total students"
          value={statistics?.students ?? students.length}
          detail={`${statistics?.activeStudents ?? students.filter(s => activeStudent(s)).length} active accounts`}
          icon="users"
        />
        <StatCard
          label="Unlocked FLTs"
          value={statistics?.unlocked ?? tests.filter((t) => t.kind === "FLT" && t.published && t.available).length}
          detail="Across both courses"
          icon="test"
        />
        <StatCard
          label="Completed assessments"
          value={statistics?.results ?? results.length}
          detail="Saved submissions"
          icon="chart"
        />
        <StatCard
          label="Pending evaluation"
          value={statistics?.pending ?? results.filter((r) => r.reviewStatus !== "Completed").length}
          detail="Writing & Speaking"
          icon="clock"
        />
      </div>
      <div className="stats-grid"><StatCard label="Trainers" value={statistics?.trainers ?? trainers.length} icon="users" /><StatCard label="General students" value={statistics?.generalStudents ?? students.filter(s => s.course === "GENERAL").length} icon="book" /><StatCard label="Academic students" value={statistics?.academicStudents ?? students.filter(s => s.course === "ACADEMIC").length} icon="book" /><StatCard label="Ready for release" value={statistics?.ready ?? results.filter(canRelease).length} icon="check" /></div>
      <Card><SectionTitle title="Trainer workload" detail={<Link to="/admin/trainers">Manage trainers</Link>} />{trainers.map(t => <div className="list-row" key={t.id}><strong>{t.name}</strong><span className="text-sm">{students.filter(s => s.trainerId === t.id).length} assigned students / {results.filter(r => students.some(s => s.id === r.studentId && s.trainerId === t.id) && r.reviewStatus !== "Completed").length} pending</span></div>)}</Card>
      <div className="two-column">
        <Card>
          <SectionTitle
            title="Platform activity"
            detail={<Badge>{mode === "demo" ? "Sample week" : "Last 7 days"}</Badge>}
          />
          <ActivityChart />
        </Card>
        <Card>
          <SectionTitle title="Module competency" />
          <div className="grid grid-cols-2 gap-6">
            {progress.map((p) => (
              <div className="flex flex-col items-center gap-2" key={p.skill}>
                <ProgressRing
                  value={p.percent}
                  label={mode === "demo" ? `${p.percent}%` : String(p.completed)}
                  size={74}
                />
                <strong className="text-xs">{p.skill}</strong>
              </div>
            ))}
          </div>
          <p className="muted text-xs mt-5">Available assessment counts</p>
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Student directory"
          detail={<Link to="/admin/students">View all students →</Link>}
        />
        {students.slice(0, 4).map((s) => (
          <div className="list-row" key={s.id}>
            <div className="row">
              <span className="avatar">
                {s.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                <h3>{s.name}</h3>
                <p className="muted text-xs">{courseName(s.course)}</p>
              </div>
            </div>
            <div className="actions">
              <Badge tone={s.enabled ? "green" : "gray"}>
                {s.enabled ? "Active" : "Disabled"}
              </Badge>
              <Link
                className="table-link text-xs"
                to={`/admin/students/${s.id}`}
              >
                View student
              </Link>
            </div>
          </div>
        ))}
      </Card>
    </ContentContainer>
  );
}
export function AdminResults({ reports = false }: { reports?: boolean }) {
  const { results, students, trainers, releaseResults, mode } = usePreview();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("All");
  const [teacher, setTeacher] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [course, setCourse] = useState<Course>("GENERAL");
  const [search, setSearch] = useState("");
  const filtered = results.filter(
    (r) =>
      r.course === course &&
      (kind === "All" || r.kind === kind) &&
      (!teacher || students.find(s => s.id === r.studentId)?.trainerId === teacher) &&
      (!from || r.date >= from) && (!to || r.date.slice(0,10) <= to) &&
      `${r.name} ${r.studentId}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <ContentContainer>
      <PageHeader
        title={reports ? "Results & course reports" : "Student results"}
        description={
          reports
            ? "Explore sample performance across the two IELTS courses."
            : "Review submitted attempts and evaluation status."
        }
        actions={<Badge tone="gray">{mode === "demo" ? "Report preview" : "Reports"}</Badge>}
      />
      <Tabs
        options={["GENERAL", "ACADEMIC"]}
        value={course}
        onChange={setCourse}
        label="Results course"
      />
      <Card><div className="form-grid"><label className="field">Test type<select value={kind} onChange={e => setKind(e.target.value)}><option value="All">All tests</option><option value="FLT">Full Length Tests</option><option value="PRACTICE_MOCK">Practice Mock Tests</option><option value="PRACTICE">Module practice</option></select></label><label className="field">Assigned trainer<select value={teacher} onChange={e => setTeacher(e.target.value)}><option value="">All trainers</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="field">From date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="field">To date<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label></div></Card>
      <div className="stats-grid">
        <StatCard label="Assessment attempts" value={filtered.length} icon="test" />
        <StatCard
          label="Evaluated"
          value={filtered.filter((r) => r.reviewStatus === "Completed").length}
          icon="check"
        />
        <StatCard
          label="Pending"
          value={filtered.filter((r) => r.reviewStatus !== "Completed").length}
          icon="clock"
        />
        <StatCard
          label="Course"
          value={course === "GENERAL" ? "General" : "Academic"}
          icon="book"
        />
      </div>
      {reports && <Card><SectionTitle title="Course performance" />{["Listening", "Reading", "Writing", "Speaking"].map(skill => { const bands = filtered.map(r => r[skill.toLowerCase() as "listening" | "reading" | "writing" | "speaking"]).filter((n): n is number => n !== null); return <div className="list-row" key={skill}><span>{skill} average</span><strong>{bands.length ? (bands.reduce((a,b) => a+b,0)/bands.length).toFixed(2) : "Pending"}</strong></div>; })}<div className="list-row"><span>Overall average (available records)</span><strong>{(() => { const bands = filtered.map(overallBand).filter((n): n is number => n !== null); return bands.length ? (bands.reduce((a,b) => a+b,0)/bands.length).toFixed(2) : "Pending"; })()}</strong></div></Card>}
      {reports && (
        <div className="two-column">
          <Card>
            <SectionTitle title="Assessment activity" />
            <ActivityChart />
          </Card>
          <Card>
            <SectionTitle title="Evaluation status" />
            {["Listening & Reading", "Writing & Speaking"].map((s, i) => (
              <div className="list-row" key={s}>
                <span>{s}</span>
                <Badge tone={i === 0 ? "green" : "amber"}>
                  {i === 0 ? "Sample scores" : "Includes pending"}
                </Badge>
              </div>
            ))}
            <p className="muted text-sm mt-5">
              Exports and live report calculations will be connected after
              backend implementation.
            </p>
          </Card>
        </div>
      )}
      {!reports && mode === "live" && <ReleaseScope/>}
      <Card>
        <SectionTitle title="Attempt records" />
        <label className="field mb-5">
          Search by test or student ID
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a sample result…"
          />
        </label>
        {!reports && <div className="stack mb-6"><div className="actions"><Button variant="secondary" onClick={() => setSelected(filtered.filter(canRelease).map(r => r.id))}>Select ready results</Button><Button disabled={!selected.some(id => filtered.some(r => r.id === id && canRelease(r)))} onClick={async () => { const count = await releaseResults(selected.filter(id => filtered.some(r => r.id === id))); setSelected([]); setMessage(`${count} results released. Student notifications added.`); }}>Release selected results</Button></div><p className="muted text-xs">Only completed L/R/W reviews can be released. Speaking may remain pending.</p>{filtered.filter(canRelease).map(r => <label className="row text-sm" key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev,r.id] : prev.filter(id => id !== r.id))} />{r.studentId} ? {r.name}</label>)}</div>}
        {message && <Notice>{message}</Notice>}
        {filtered.length ? (
          <ResultRows results={filtered} admin />
        ) : (
          <EmptyState title="No matching results" />
        )}
      </Card>
    </ContentContainer>
  );
}
