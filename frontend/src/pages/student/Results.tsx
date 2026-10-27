import { MarksheetResponses } from "../../components/MarksheetResponses";
import {api} from "../../services/api";
import { useEffect,useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { Badge, Card, ContentContainer, EmptyState, LinkButton, Notice, PageHeader, ProgressBar, ProgressRing, SectionTitle, StatCard, Tabs } from "../../components/ui";
import { Icon } from "../../components/Icon";
import {skillIcon} from "../../components/iconNames";
import { courseName, dateLabel } from "../../utils/format";
import { isResultVisible, overallBand, overallLabel } from "../../utils/scoring";
import type { Result } from "../../types/domain";

export function ResultRows({ results, admin = false }: { results: Result[]; admin?: boolean }) {
  return <>{results.map((r) => {
    const visible = admin || isResultVisible(r);
    const overall = overallBand(r);
    return <div className="list-row" key={r.id}><div className="row"><span className="icon-tile"><Icon name="test" /></span><div><h3>{r.name}</h3><p className="muted text-xs">{dateLabel(r.date)} · {admin ? r.studentId + " · " : ""}{courseName(r.course)} · Attempt {r.attemptNumber}{r.kind === "PRACTICE_MOCK" ? " of 2" : r.kind === "FLT" ? " of 1" : ""}</p></div></div><div className="actions"><Badge tone={visible && overall !== null ? "green" : "amber"}>{!visible ? (r.kind === "FLT" ? "Awaiting result release" : "Scoring pending") : overall === null ? "Pending evaluation" : overallLabel(r) + ": " + overall.toFixed(1)}</Badge>{admin && <Link className="table-link text-xs" to={`/admin/results/${r.id}`}>Review marksheet</Link>}{!admin && visible && <Link className="table-link text-xs" to={`/student/results/${r.id}`}>View result</Link>}</div></div>;
  })}</>;
}
export function Results({ detailed = false }: { detailed?: boolean }) {
  const { attemptId } = useParams();
  const { results, course, students, mode } = usePreview();
  const student = students.find((s) => s.course === course);
  const found = results.find((r) => r.id === attemptId && r.course === course && r.studentId === student?.id);
  const [record,setRecord]=useState<Result>();const [error,setError]=useState("");
  useEffect(()=>{if(mode!=="live")return;const controller=new AbortController();api<Result>(`/results/${attemptId}`,{signal:controller.signal}).then(r=>{setRecord(r);setError("");}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[mode,attemptId]);
  const result=mode==="live"?record??found:found;
  if(mode==="live"&&!result&&!error)return <ContentContainer><p role="status">Loading result...</p></ContentContainer>;
  if (!result || !isResultVisible(result)) return <ContentContainer><Card><EmptyState title={result ? "Result not released yet" : "Result unavailable"} description={result ? "Your result will appear after evaluation and the required release." : "Select a result from your own test history."} action={<LinkButton to="/student/history">View history</LinkButton>} /></Card></ContentContainer>;
  const skills = result.kind === "PRACTICE" ? result.modules??[] : result.kind === "FLT" ? ["Listening", "Reading", "Writing", "Speaking"] : ["Listening", "Reading", "Writing"];
  const overall = overallBand(result);
  return <ContentContainer>
    <PageHeader eyebrow="Test history / Result" title={result.name + (detailed ? " — Detailed result" : "")} description={`Completed ${dateLabel(result.date)} · ${result.minutes} minutes · Attempt ${result.attemptNumber}`} actions={<Badge>{courseName(course)}</Badge>} />
    {mode === "demo" && <Notice>Sample result data. These marks are independent of the answers entered in the test preview.</Notice>}
    <Card className="result-hero"><div><Badge tone="green">{result.kind === "FLT" ? "Released result" : "Scored practice result"}</Badge><h2 className="mt-4">{overallLabel(result)}</h2><p className="muted text-sm mt-3">{result.kind === "FLT" && result.speaking === null ? "Your trainer will add Speaking marks after the offline test. The overall band will then include all four skills." : "Final approved section marks are shown below."}</p></div>{overall !== null && <ProgressRing value={overall / 9 * 100} label={overall.toFixed(1)} size={120} />}</Card>
    <div className="score-grid">{skills.map(skill => {const value=result[skill.toLowerCase() as "listening"];const raw=result.rawScores?.[skill];return <Card key={skill}><div className="row between"><h3>{skill}</h3><Icon name={skillIcon[skill as keyof typeof skillIcon]} /></div>{value === null ? <div className="mt-6"><Badge tone="amber">{skill === "Speaking" ? "Speaking Marks Pending" : raw?.total ? `${raw.correct}/${raw.total} correct` : "Evaluation pending"}</Badge></div> : <><div className="score-number">{value?.toFixed(1)}<small className="muted ml-2">/ 9.0</small></div><ProgressBar value={(value || 0) / 9 * 100} label={skill + " band"} /></>}</Card>;})}</div>
    <div className="two-column"><Card><SectionTitle title="Trainer feedback" /><p className="text-sm whitespace-pre-wrap">{result.remarks || "No trainer remarks added."}</p>{result.speakingDate && <p className="muted text-xs mt-4">Offline Speaking test: {dateLabel(result.speakingDate)}</p>}</Card>{skills.includes("Writing")&&<Card><SectionTitle title="Writing evaluation" /><Badge tone={result.aiStatus === "Completed" ? "green" : "amber"}>{result.aiStatus === "Completed" ? "AI evaluation complete" : result.writing!==null?"Manually evaluated":result.aiStatus === "Failed" ? "Retry required" : result.aiStatus === "Manual review"?"Manual review pending":"AI evaluation pending"}</Badge><p className="muted text-sm mt-4">AI marks are estimates. Trainer or Admin revisions determine the final approved score.</p>{mode === "demo" && <p className="muted text-xs mt-3">Detailed AI feedback is not supplied in this preview.</p>}</Card>}</div>
    {detailed && mode === "live" && <MarksheetResponses id={result.id} />}
    {detailed && result.kind === "FLT" && <Card><SectionTitle title="Offline Speaking criteria" />{result.speakingCriteria ? Object.entries(result.speakingCriteria).map(([key, value]) => <div className="list-row" key={key}><span>{{ fluency: "Fluency and Coherence", lexical: "Lexical Resource", grammar: "Grammatical Range and Accuracy", pronunciation: "Pronunciation" }[key]}</span><strong>{value.toFixed(1)}</strong></div>) : <p className="muted text-sm">{result.kind === "FLT" ? "Speaking marks have not been entered." : "Speaking is not part of Practice Mock Tests."}</p>}</Card>}
    <div className="actions"><LinkButton secondary to="/student/history">Back to history</LinkButton><LinkButton to={`/student/results/${result.id}${detailed ? "" : "/details"}`}>{detailed ? "Result summary" : "View details"}</LinkButton></div>
  </ContentContainer>;
}
export function TestHistory() {
  const { results, course, students, attempts, tests, practiceRecords } = usePreview();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const student = students.find((s) => s.course === course);
  const history = results.filter((r) => r.course === course && r.studentId === student?.id);
  const filtered = history.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || r.kind === ({ "Practice": "PRACTICE", "Practice Mock Tests": "PRACTICE_MOCK", "Full Length Tests": "FLT" } as Record<string, string>)[filter]));
  const unfinished = attempts.filter((a) => a.course === course && a.studentId === student?.id && !history.some((r) => r.testId === a.testId && r.attemptNumber === a.number) && (filter === "All" || (filter === "Full Length Tests" && a.kind === "FLT") || (filter === "Practice Mock Tests" && a.kind === "PRACTICE_MOCK")));
  const practice = practiceRecords.filter((r) => r.studentId === student?.id && r.course === course && (filter === "All" || filter === "Practice") && r.skill.toLowerCase().includes(search.toLowerCase()));
  const visibleBands = history.filter(isResultVisible).map(overallBand).filter((band): band is number => band !== null);
  return <ContentContainer>
    <PageHeader title="Test history" description="Your attempts, results and feedback." actions={<LinkButton to="/student/practice-mocks">Practice Mock Tests</LinkButton>} />
    <div className="stats-grid"><StatCard label="Completed records" value={history.length + practiceRecords.filter((r) => r.studentId === student?.id).length} icon="test" /><StatCard label="Highest released band" value={visibleBands.length ? Math.max(...visibleBands).toFixed(1) : "—"} icon="trophy" /><StatCard label="Awaiting release or scoring" value={history.filter((r) => !isResultVisible(r)).length} icon="clock" /><StatCard label="Your course" value={course === "GENERAL" ? "General" : "Academic"} icon="book" /></div>
    <Card><div className="actions justify-between mb-5"><Tabs options={["All", "Practice", "Practice Mock Tests", "Full Length Tests"]} value={filter} onChange={setFilter} label="History type" /><label className="search-field"><Icon name="search" size={16} /><input aria-label="Search history" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <ResultRows results={filtered} />
      {unfinished.filter((a) => { const t = tests.find((t) => t.id === a.testId); return (`${a.kind === "FLT" ? "Full Length Test" : "Practice Mock"} ${t?.number}`).toLowerCase().includes(search.toLowerCase()); }).map((a) => <div className="list-row" key={a.id}><div><h3>{a.kind === "FLT" ? "Full Length Test" : "Practice Mock"} {tests.find((t) => t.id === a.testId)?.number}</h3><p className="muted text-xs">Attempt {a.number} of {a.kind === "FLT" ? 1 : 2} · {a.interruptions} interruptions</p></div><div className="actions"><Badge tone="amber">{a.state === "Submitted" ? "Submitted · Scoring pending" : "In progress"}</Badge>{a.state === "In progress" && <LinkButton secondary to={`/student/attempts/${a.id}`}>Resume</LinkButton>}</div></div>)}
      {practice.map((p) => <div className="list-row" key={p.id}><div><h3>{p.skill} practice</h3><p className="muted text-xs">{dateLabel(p.date)} · Module practice</p></div><Badge tone={p.correct === null ? "amber" : "green"}>{p.correct === null ? "Writing evaluation pending" : `${p.correct}/${p.total} correct`}</Badge></div>)}
      {!filtered.length && !unfinished.length && !practice.length && <EmptyState title="No matching attempts" />}
    </Card>
  </ContentContainer>;
}
