import { isResultVisible } from "../../utils/scoring";
import { ResultRows } from "./Results";
import { Link } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  LinkButton,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionTitle,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import {skillIcon} from "../../components/iconNames";
import { courseName, dateLabel } from "../../utils/format";
import { MockCard } from "./MockTests";
export function Dashboard() {
  const { course, students, tests, results, progress, attempts, mode } = usePreview();
  const student = students.find((s) => s.course === course)!;
  const history = results.filter((r) => r.studentId === student.id && r.course === course);
  const released = history.filter(isResultVisible);
  const resumable = attempts.filter(a => a.studentId === student.id && a.course === course && a.state === "In progress");
  const available = tests.filter(
    (t) => t.kind === "FLT" && t.course === course && t.available && t.published,
  );
  return (
    <ContentContainer>
      <Card className="hero">
        <div className="hero-copy">
          <div className="actions mb-4">
            <Badge>{courseName(course)}</Badge>
            <span className="row text-xs muted">
              <Icon name="calendar" size={14} />
              Valid until {dateLabel(student.expiryDate)}
            </span>
          </div>
          <h1>
            Welcome, {student.name.split(" ")[0]}{" "}
            <span aria-hidden="true">☀</span>
          </h1>
          <p>
            Ready for your next IELTS practice? Build confidence, one section at
            a time.
          </p>
          <LinkButton to="/student/practice">
            Continue your practice <Icon name="arrow" size={16} />
          </LinkButton>
        </div>
        <div className="hero-summary">
          <ProgressRing value={mode === "demo" ? 68 : 0} label={mode === "demo" ? "68%" : String(history.length)} size={110} />
          <div>
            <small className="muted">{mode === "demo" ? "TARGET BAND" : "COMPLETED ASSESSMENTS"}</small>
            <h2>{mode === "demo" ? "Band 8.0" : `${history.length} attempts`}</h2>
            <p className="text-xs muted mt-3">{mode === "demo" ? "Sample study progress" : "Your saved assessment history"}</p>
          </div>
        </div>
      </Card>
      <div className="actions"><LinkButton secondary to="/student/practice-mocks">Practice Mock Tests</LinkButton><LinkButton secondary to="/student/notifications">Notifications</LinkButton></div>
      {resumable.map(a => <Card key={a.id}><SectionTitle title={`Resume ${a.kind === "FLT" ? "Full Length Test" : a.kind === "PRACTICE" ? "module practice" : "Practice Mock"}`} /><LinkButton to={`/student/attempts/${a.id}`}>Resume test</LinkButton></Card>)}
      <section>
        <SectionTitle
          title="Skill competencies"
          detail={<Badge>Practice overview</Badge>}
        />
        <div className="skill-grid">
          {progress.map((p) => (
            p.skill === "Speaking" ? <Card className="skill-card locked" key={p.skill}><span className="icon-tile"><Icon name="mic" /></span><h3>Speaking</h3><Badge tone="gray">Offline assessment</Badge><span className="band">{released.find(r => r.speaking !== null)?.speaking?.toFixed(1) ?? "Pending"}</span><p className="muted text-xs">Speaking is conducted offline by your trainer.</p><Button disabled variant="secondary">Offline only</Button></Card> : <Card className="skill-card" key={p.skill}>
              <div className="row between">
                <span className="icon-tile">
                  <Icon name={skillIcon[p.skill]} />
                </span>
                <Badge tone={p.skill === "Writing" ? "amber" : "green"}>
                  {mode === "live" ? (p.band === null ? "Pending" : "Evaluated") : p.skill === "Writing" ? "Focus area" : "On track"}
                </Badge>
              </div>
              <h3>{p.skill}</h3>
              <div className="row between">
                <span className="band">{p.band?.toFixed(1) ?? "Pending"}</span>
                <span className="muted text-xs">{mode === "demo" ? "Sample band" : "Latest available band"}</span>
              </div>
              {mode === "demo" && <ProgressBar value={p.percent} label={`${p.skill} progress`} />}
              <p className="muted text-xs">
                {mode === "demo" ? `${p.completed} / ${p.total} practice activities` : `${p.completed} evaluated assessments`}
              </p>
              <Link
                to={`/student/practice/${p.skill.toLowerCase()}/sample`}
                className="btn btn-secondary"
              >
                Practice <Icon name="arrow" size={14} />
              </Link>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle
          title="Continue practice"
          detail={<Link to="/student/practice">View all modules →</Link>}
        />
        <div className="skill-grid">
          {progress.filter(p => p.skill !== "Speaking").map((p) => (
            <Card key={p.skill} className="skill-card" data-skill={p.skill}>
              <Badge>{p.skill}</Badge>
              <h3>
                {mode === "live" ? `${p.skill} practice` : p.skill === "Reading"
                  ? course === "GENERAL"
                    ? "Transport notices & guidelines"
                    : "Cities & the urban landscape"
                  : p.skill === "Writing"
                    ? course === "GENERAL"
                      ? "Task 1: A formal letter"
                      : "Task 1: Describe a dataset"
                    : p.skill === "Listening"
                      ? "Campus accommodation briefing"
                      : "A memorable journey"}
              </h3>
              <p className="muted text-xs">{p.description}</p>
              <LinkButton
                secondary
                to={`/student/practice/${p.skill.toLowerCase()}/sample`}
              >
                Continue <Icon name="play" size={13} />
              </LinkButton>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle
          title="Full Length Tests"
          detail={<Link to="/student/mock-tests">View all 40 tests →</Link>}
        />
        <p className="muted text-xs mb-4">
          {available.length} available · {history.filter(r=>r.kind === "FLT").length} completed
        </p>
        <div className="mock-grid">
          {tests
            .filter((t) => t.kind === "FLT" && t.course === course)
            .slice(0, 4)
            .map((t) => (
              <MockCard key={t.id} test={t} />
            ))}
        </div>
      </section>
      <Card>
        <SectionTitle
          title="Recent results"
          detail={<Link to="/student/history">Test history →</Link>}
        />
        <ResultRows results={history.slice(0, 3)} />
      </Card>
    </ContentContainer>
  );
}
export function PracticeHub() {
  const { progress, course, mode } = usePreview();
  return (
    <ContentContainer>
      <PageHeader
        title="Practice modules"
        description="Focused practice for your next step forward."
        actions={<Badge>{courseName(course)}</Badge>}
      />
      <div className="skill-grid">
        {progress.map((p) => (
          <Card key={p.skill} className="skill-card" data-skill={p.skill}>
            <div className="row between">
              <span className="icon-tile">
                <Icon name={skillIcon[p.skill]} size={24} />
              </span>
              <ProgressRing
                value={p.percent}
                label={mode === "demo" ? `${p.percent}%` : String(p.completed)}
                size={65}
              />
            </div>
            <h2>{p.skill}</h2>
            <p className="muted text-xs">{p.description}</p>
            <p className="text-xs muted">
              Completed activities{" "}
              <strong>
                {mode === "demo" ? `${p.completed} / ${p.total}` : p.completed}
              </strong>
            </p>
            {p.skill === "Speaking" ? <><Badge tone="gray">Speaking is conducted offline by your trainer.</Badge><Button disabled variant="secondary">Offline only</Button></> : <LinkButton to={`/student/practice/${p.skill.toLowerCase()}/sample`}>Start practice <Icon name="arrow" size={15} /></LinkButton>}
          </Card>
        ))}
      </div>
      <Card>
        <SectionTitle title="Make time for a little progress" />
        <p className="muted text-sm">
          Choose Listening, Reading or Writing while your portal access is active. Practice does
          not require a mock-test unlock.
        </p>
        <div className="mt-5">
          <Button
            variant="secondary"
            onClick={() =>
              document
                .querySelector<HTMLAnchorElement>(
                  'a[href="/student/practice/writing/sample"]',
                )
                ?.focus()
            }
          >
            Focus on Writing <Icon name="writing" size={14} />
          </Button>
        </div>
      </Card>
    </ContentContainer>
  );
}
