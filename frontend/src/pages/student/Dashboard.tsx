import "../../styles/dashboard.css";
import { ResultRows } from "./Results";
import { Link } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  LinkButton,
  Notice,
  PageHeader,
  ProgressRing,
  SectionTitle,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import {skillIcon} from "../../components/iconNames";
import { courseName, dateLabel } from "../../utils/format";
import { Countdown, SkillCard, TodayPlan, TypeAnalytics, WritingAnalytics } from "./StudentInsights";
import { useInsights } from "../../utils/useInsights";
import { SkillProgressChart } from "../../components/SkillProgressChart";
import { sampleInsights } from "../../mocks/insights";
export function Dashboard() {
  const { course, students, tests, results, attempts, mode, questions } = usePreview();
  const student = students.find((s) => s.course === course)!;
  const history = results.filter((r) => r.studentId === student.id && r.course === course);
  const resumable = attempts.filter(a => a.studentId === student.id && a.course === course && a.state === "In progress");
  const { data, setData, error } = useInsights(mode, sampleInsights);
  const done = new Set(history.filter(r => r.kind === "FLT").map(r => r.testId));
  const nextFlt = tests.filter(t => t.kind === "FLT" && t.course === course && t.available && t.published && !done.has(t.id)).sort((a, b) => a.number - b.number)[0];
  const target = data?.goals.targetBand ?? null;
  const series = (key: "listening" | "reading" | "writing" | "speaking" | "overall") => (data?.progress ?? []).map(p => p[key]);
  const compare = (mine: number | null, cohort: number | null) => cohort !== null ? `${mine === null ? "—" : mine.toFixed(1)} vs ${cohort.toFixed(1)} avg` : `Target ${target === null ? "—" : target.toFixed(1)}`;
  const band = (n: number | null) => n === null ? "—" : n.toFixed(1);
  return (
    <ContentContainer>
      <div className="dash-head">
        <div><h1>Welcome, {student.name.split(" ")[0]}</h1><p className="muted">Your IELTS progress, analytics and today’s plan in one place.</p>
          <div className="actions mt-2"><Badge>{courseName(course)}</Badge><span className="row text-xs muted"><Icon name="calendar" size={14} />Access until {dateLabel(student.expiryDate)}</span></div></div>
        <div className="kpi-chips">
          <div className="kpi card"><span className="stat-icon tone-blue"><Icon name="calendar" /></span><div><small>Active days</small><strong>{data?.activity.activeDays ?? "—"}</strong></div></div>
          <div className="kpi card"><span className="stat-icon tone-green"><Icon name="trophy" /></span><div><small>Tests taken</small><strong>{data?.activity.testsGiven ?? "—"}</strong></div></div>
          <div className="kpi card"><span className="stat-icon tone-amber"><Icon name="flame" /></span><div><small>Day streak</small><strong>{data?.activity.streak ?? "—"}</strong></div></div>
        </div>
      </div>
      {mode === "demo" && <Notice>Sample dashboard data for the preview.</Notice>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {resumable.map(a => <Card key={a.id} className="resume-card"><SectionTitle title={`Resume ${a.kind === "FLT" ? "Full Length Test" : a.kind === "PRACTICE" ? "module practice" : "Practice Mock"}`} /><LinkButton to={`/student/attempts/${a.id}`}>Resume test</LinkButton></Card>)}
      {!data && !error ? <p role="status" className="muted">Loading your dashboard…</p> : data && <>
        <div className="skill-stats">
          <SkillCard tone="blue" icon="test" title="Full Length Tests" value={`${data.tests.flt.done} / ${data.tests.flt.available}`} bar={data.tests.flt.available ? data.tests.flt.done / data.tests.flt.available * 100 : 0} values={series("overall")} compare={`Target ${band(target)}`} href="/student/mock-tests" />
          <SkillCard tone="navy" icon="clock" title="Practice Mock Tests" value={`${data.tests.practiceMock.done} / ${data.tests.practiceMock.available}`} bar={data.tests.practiceMock.available ? data.tests.practiceMock.done / data.tests.practiceMock.available * 100 : 0} values={(data.progress ?? []).filter(p => p.kind === "PRACTICE_MOCK").map(p => p.overall)} compare="2 attempts each" href="/student/practice-mocks" />
          <SkillCard tone="sky" icon="headphones" title="Listening" value={band(data.skills.listening.band)} bar={(data.skills.listening.band ?? 0) / 9 * 100} values={series("listening")} compare={compare(data.skills.listening.band, data.cohort.listening)} href="/student/practice/listening/sample" />
          <SkillCard tone="green" icon="book" title="Reading" value={band(data.skills.reading.band)} bar={(data.skills.reading.band ?? 0) / 9 * 100} values={series("reading")} compare={compare(data.skills.reading.band, data.cohort.reading)} href="/student/practice/reading/sample" />
          <SkillCard tone="coral" icon="writing" title="Writing" value={band(data.skills.writing.band)} bar={(data.skills.writing.band ?? 0) / 9 * 100} values={series("writing")} compare={compare(data.skills.writing.band, data.cohort.writing)} href="/student/practice/writing/sample" />
          <SkillCard tone="amber" icon="mic" title="Speaking" value={band(data.skills.speaking)} bar={(data.skills.speaking ?? 0) / 9 * 100} values={series("speaking")} compare="Offline with your trainer" />
        </div>
        <div className="dash-two">
          <Countdown insights={data} live={mode === "live"} onGoals={goals => setData({ ...data, goals })} />
          <TodayPlan insights={data} questions={questions} nextFlt={nextFlt} />
        </div>
        <section><SectionTitle title="Question type analytics" detail={<span className="muted text-xs">Your accuracy{data.cohort.students >= 5 ? " vs the institute average" : ""}</span>} />
          <div className="dash-two"><TypeAnalytics module="Listening" rows={data.questionTypes} tone="sky" /><TypeAnalytics module="Reading" rows={data.questionTypes} tone="green" /></div></section>
        <section><SectionTitle title="Writing analytics" detail={<span className="muted text-xs">Average criterion bands from AI marking</span>} />
          <div className="dash-two"><WritingAnalytics task="Task 1" data={data.writingTasks["Task 1"]} tone="coral" /><WritingAnalytics task="Task 2" data={data.writingTasks["Task 2"]} tone="amber" /></div></section>
        <section><SectionTitle title="Skill progress tracker" detail={<span className="muted text-xs">Bands from Practice Mocks and released Full Length Tests</span>} /><Card><SkillProgressChart points={data.progress} /></Card></section>
      </>}
      <Card>
        <SectionTitle title="Recent results" detail={<Link to="/student/history">Test history →</Link>} />
        <ResultRows results={history.slice(0, 3)} />
      </Card>
    </ContentContainer>
  );
}
export function PracticeHub({ practiceMode = "type" }: { practiceMode?: "type" | "section" }) {
  const { progress, course, mode } = usePreview();
  const sectional = practiceMode === "section";
  const to = (skill: string) => `/student/practice/${skill.toLowerCase()}/sample?mode=${practiceMode}`;
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Tests / Learning Arena"
        title={sectional ? "Sectional practice" : "Question Specific practice"}
        description={sectional ? "Practise a whole section or passage at a time." : "Practise one question type at a time, with answers and explanations."}
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
            {p.skill === "Speaking" ? <><Badge tone="gray">Speaking is conducted offline by your trainer.</Badge><Button disabled variant="secondary">Offline only</Button></> : <LinkButton to={to(p.skill)}>Start practice <Icon name="arrow" size={15} /></LinkButton>}
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
                  'a[href^="/student/practice/writing/sample"]',
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
