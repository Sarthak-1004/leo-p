import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../services/api";
import { Icon } from "../../components/Icon";
import type { Question, StudentInsights } from "../../types/domain";

// Building blocks of the student dashboard: skill cards, exam countdown, today's plan and analytics.
const BANDS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5);
const fmt = (n: number | null | undefined) => n === null || n === undefined ? "—" : n.toFixed(1);
const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

function Trend({ values }: { values: (number | null)[] }) {
  const xs = values.filter((v): v is number => v !== null);
  if (xs.length < 2) return <span className="trend">{xs.length ? "First result" : "No results yet"}</span>;
  const d = xs[xs.length - 1]! - xs[xs.length - 2]!;
  if (d === 0) return <span className="trend">— No change</span>;
  return <span className={`trend ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} since last test</span>;
}

export function SkillCard({ tone, icon, title, value, bar, values, compare, href }: {
  tone: string; icon: string; title: string; value: string; bar: number; values: (number | null)[]; compare: string; href?: string;
}) {
  const body = <><div className="skill-stat-top"><span className={`stat-icon tone-${tone}`}><Icon name={icon} /></span><strong className={`stat-value tone-${tone}`}>{value}</strong></div>
    <h3>{title}</h3>
    <div className={`stat-track tone-${tone}`} aria-hidden="true"><div style={{ width: pct(bar) }} /></div>
    <div className="skill-stat-foot"><Trend values={values} /><span>{compare}</span></div></>;
  return href ? <Link to={href} className="skill-stat card">{body}</Link> : <div className="skill-stat card">{body}</div>;
}

function useNow(ms: number) { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]); return now; }

export function Countdown({ insights, live, onGoals }: { insights: StudentInsights; live: boolean; onGoals: (g: StudentInsights["goals"]) => void }) {
  const now = useNow(1000), [status, setStatus] = useState("");
  const { examDate, targetBand } = insights.goals;
  const left = examDate ? Math.max(0, new Date(`${examDate}T09:00:00+05:30`).getTime() - now) : 0;
  const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  const save = async (goals: StudentInsights["goals"]) => {
    onGoals(goals); if (!live) return setStatus("Sample preview — not saved");
    setStatus("Saving…");
    try { await api("/student/goals", { method: "PUT", body: goals }); setStatus("Saved"); } catch (e) { setStatus(e instanceof Error ? e.message : "Could not save"); }
  };
  const latest = [...insights.progress].reverse().find(p => p.overall !== null)?.overall ?? null;
  return <section className="card countdown">
    <div className="countdown-head"><h2>IELTS exam countdown</h2>
      <label className="date-field"><span className="sr-only">Exam date</span><input type="date" value={examDate ?? ""} min={new Date().toISOString().slice(0, 10)} onChange={e => void save({ examDate: e.target.value || null, targetBand })} /></label></div>
    {examDate ? <div className="count-tiles" role="timer" aria-label={`${parts[0]} days ${parts[1]} hours to your exam`}>
      {(["Days", "Hours", "Minutes", "Seconds"] as const).map((label, i) => <div key={label}><div className="digits">{String(parts[i]).padStart(2, "0").split("").map((d, k) => <span key={k}>{d}</span>)}</div><small>{label}</small></div>)}
    </div> : <p className="muted text-sm countdown-empty">Set your exam date to start the countdown.</p>}
    <div className="band-trio">
      <div><strong>{fmt(latest)}</strong><span>Latest band</span></div>
      <div><strong>{fmt(insights.estimatedBand)}</strong><span>Estimated band</span></div>
      <div><label><strong><select aria-label="Target band" value={targetBand ?? ""} onChange={e => void save({ examDate, targetBand: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{BANDS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}</select></strong><span>Target band</span></label></div>
    </div>
    {status && <p className="muted text-xs mt-2" role="status">{status}</p>}
    <p className="muted text-xs mt-2">Estimated band averages your last three scored full tests. It is a guide, not an official score.</p>
  </section>;
}

export function TodayPlan({ insights, questions, nextFlt }: { insights: StudentInsights; questions: Question[]; nextFlt?: { number: number } }) {
  const [dayIndex] = useState(() => Math.floor(Date.now() / 86400000));
  const weakest = (module: string) => insights.questionTypes.filter(t => t.module === module && t.total >= 3).sort((a, b) => a.accuracy - b.accuracy)[0]?.questionType;
  const practice = (skill: string) => questions.filter(q => q.skill === skill);
  const pick = <T,>(xs: T[]) => xs.length ? xs[dayIndex % xs.length] : undefined;
  const writing = pick(practice("Writing"));
  const items = [
    ...(["Listening", "Reading"] as const).map(skill => {
      const has = practice(skill).length > 0, focus = weakest(skill);
      return { skill, title: has ? `${skill} practice${focus ? `: ${focus}` : ""}` : `${skill} section of a Practice Mock`, to: has ? `/student/practice/${skill.toLowerCase()}/sample` : "/student/practice-mocks", done: insights.activity.today.includes(skill) };
    }),
    { skill: "Writing", title: writing ? `${writing.section ?? "Writing"}: ${writing.title.replace(/^Original practice:\s*/, "")}` : "Writing tasks in a Practice Mock", to: writing ? "/student/practice/writing/sample" : "/student/practice-mocks", done: insights.activity.today.includes("Writing") },
    ...(nextFlt ? [{ skill: "Full test", title: `Full Length Test ${String(nextFlt.number).padStart(2, "0")}`, to: "/student/mock-tests", done: insights.activity.today.includes("Full test") }] : []),
  ];
  return <section className="card today-plan"><h2>Today’s plan</h2>
    <ol className="plan-list">{items.map(it => <li key={it.skill} className={it.done ? "done" : ""}>
      <span className="plan-dot" aria-hidden="true">{it.done && <Icon name="check" size={12} />}</span>
      <Link to={it.to} className="plan-item"><span><strong>{it.skill}</strong><small>{it.title}</small></span><span className={`pill ${it.done ? "pill-done" : ""}`}>{it.done ? "Done" : "Pending"}</span></Link>
    </li>)}</ol>
  </section>;
}

export function TypeAnalytics({ module, rows, tone }: { module: string; rows: StudentInsights["questionTypes"]; tone: string }) {
  const [all, setAll] = useState(false);
  const mine = rows.filter(r => r.module === module), shown = all ? mine : mine.slice(0, 4);
  return <section className={`card analytics tone-bg-${tone}`}><h3>{module}</h3>
    {!mine.length ? <p className="muted text-sm">Question-type accuracy appears after your first scored {module} questions.</p> : <>
      {shown.map(r => <div className="analytics-row" key={r.questionType}>
        <div className="row between"><span>{r.questionType}</span><b>{r.accuracy}%{r.cohortAccuracy !== null && <span className="muted"> vs {r.cohortAccuracy}%</span>}</b></div>
        <div className={`stat-track tone-${tone}`} aria-hidden="true"><div style={{ width: pct(r.accuracy) }} /></div>
        <span className="muted text-xs">{r.correct}/{r.total} correct</span>
      </div>)}
      {mine.length > 4 && <button type="button" className="link-button" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all (${mine.length})`}</button>}
    </>}
  </section>;
}

const CRITERIA: [string, string, string][] = [["taskAchievement", "Task Achievement", "Task Response"], ["coherence", "Coherence & Cohesion", "Coherence & Cohesion"], ["lexical", "Lexical Resource", "Lexical Resource"], ["grammar", "Grammatical Range & Accuracy", "Grammatical Range & Accuracy"]];
export function WritingAnalytics({ task, data, tone }: { task: "Task 1" | "Task 2"; data?: StudentInsights["writingTasks"][string]; tone: string }) {
  return <section className={`card analytics tone-bg-${tone}`}><h3>Writing {task}</h3>
    {!data ? <p className="muted text-sm">Criterion bands appear after your first AI-marked {task}.</p> : <>
      {CRITERIA.map(([key, t1, t2]) => { const v = data.criteria[key] ?? null; return <div className="analytics-row" key={key}>
        <div className="row between"><span>{task === "Task 1" ? t1 : t2}</span><b>Band {fmt(v)}</b></div>
        <div className={`stat-track tone-${tone}`} aria-hidden="true"><div style={{ width: pct((v ?? 0) / 9 * 100) }} /></div>
      </div>; })}
      <p className="muted text-xs mt-2">{data.scripts} marked {data.scripts === 1 ? "script" : "scripts"} · average task band {fmt(data.band)}</p>
    </>}
  </section>;
}
