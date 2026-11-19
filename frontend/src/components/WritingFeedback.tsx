import { useMemo, useState } from "react";
import type { WritingAiFeedback, WritingAiTask } from "../types/domain";

// AI Writing marking: a band and remarks per criterion, the student's answer with every error highlighted,
// a correction table, guidance and a model rewrite. Older evaluations (criteria as plain numbers) still render.
const criterionNames = (task: string): Record<string, string> => ({
  taskAchievement: task === "Task 1" ? "Task Achievement" : "Task Response",
  coherence: "Coherence & Cohesion",
  lexical: "Lexical Resource",
  grammar: "Grammatical Range & Accuracy",
});
const tone = (type = "") => /spelling|punctuation/i.test(type) ? "spell" : /vocab|word|preposition/i.test(type) ? "vocab" : /register|tone/i.test(type) ? "tone" : "grammar";
// Criteria always appear in the standard IELTS order, whatever order the model returned.
const ORDER = ["taskAchievement", "coherence", "lexical", "grammar"];
const order = <T,>(criteria: Record<string, T>) => Object.entries(criteria).sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
const band = (value: number | { band: number }) => typeof value === "number" ? value : value.band;
const taskBand = (task: WritingAiTask) => { const values = Object.values(task.criteria).map(band); return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 2) / 2; };

// Split the answer into plain text and highlighted spans; each correction marks its first unused exact match.
function segments(answer: string, task: WritingAiTask) {
  const spans: { at: number; end: number; n: number }[] = [];
  task.corrections.forEach((c, n) => {
    if (!c.original) return;
    for (let from = 0, at = answer.indexOf(c.original); at >= 0; from = at + 1, at = answer.indexOf(c.original, from)) {
      const end = at + c.original.length;
      if (!spans.some(s => at < s.end && end > s.at)) { spans.push({ at, end, n }); return; }
    }
  });
  spans.sort((a, b) => a.at - b.at);
  const out: ({ text: string } | { text: string; n: number })[] = []; let pos = 0;
  for (const s of spans) { if (s.at > pos) out.push({ text: answer.slice(pos, s.at) }); out.push({ text: answer.slice(s.at, s.end), n: s.n }); pos = s.end; }
  if (pos < answer.length) out.push({ text: answer.slice(pos) });
  return out;
}

function TaskFeedback({ task, answer }: { task: WritingAiTask; answer: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const parts = useMemo(() => segments(answer, task), [answer, task]);
  const names = criterionNames(task.task), words = answer.split(/\s+/).filter(Boolean).length;
  return <section className="response-record ai-task">
    <div className="ai-task-head"><h3>{task.task}: AI evaluation</h3><span className="ai-band" aria-label={`Estimated ${task.task} band ${taskBand(task).toFixed(1)}`}>{taskBand(task).toFixed(1)}</span></div>
    <table className="ai-criteria"><tbody>{order(task.criteria).map(([key, value]) => <tr key={key}>
      <th scope="row">{names[key] ?? key}</th><td className="ai-criteria-band">{band(value)}</td><td>{typeof value === "number" ? "" : value.remarks}</td>
    </tr>)}</tbody></table>
    {answer.trim() && <>
      <h4 className="mt-4">Your answer <span className="muted text-xs">{words} words{task.corrections.length ? ` · ${task.corrections.length} corrections highlighted` : ""}</span></h4>
      <div className="ai-essay">{parts.map((p, i) => "n" in p
        ? <mark key={i} role="button" tabIndex={0} className={`ai-mark ai-${tone(task.corrections[p.n]!.type)}`} aria-expanded={open === p.n} aria-label={`${p.text}: correction ${p.n + 1}`} onClick={() => setOpen(open === p.n ? null : p.n)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(open === p.n ? null : p.n); } }}>{p.text}<sup>{p.n + 1}</sup></mark>
        : <span key={i}>{p.text}</span>)}</div>
      {open !== null && task.corrections[open] && <p className="ai-tip" role="status"><b>{open + 1}. {task.corrections[open]!.suggestion}</b> — {task.corrections[open]!.reason}</p>}
      {task.corrections.length > 0 && <p className="ai-legend"><span className="ai-mark ai-grammar">grammar</span> <span className="ai-mark ai-spell">spelling / punctuation</span> <span className="ai-mark ai-vocab">vocabulary</span> <span className="ai-mark ai-tone">tone</span> Select a highlight to see its correction.</p>}
    </>}
    {task.feedback && <p className="text-sm whitespace-pre-wrap mt-4">{task.feedback}</p>}
    {([["Strengths", task.strengths], ["Areas to improve", task.weaknesses], ["How to improve", task.improvements ?? []]] as [string, string[]][]).map(([label, items]) => items.length > 0 && <div key={label} className="mt-4"><h4>{label}</h4><ul className="list-disc pl-5 text-sm">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}
    {task.corrections.length > 0 && <details className="mt-4"><summary>All corrections ({task.corrections.length})</summary>
      <div className="table-scroll"><table className="ai-corrections"><thead><tr><th>#</th><th>You wrote</th><th>Correction</th><th>Type</th><th>Why</th></tr></thead><tbody>{task.corrections.map((c, i) => <tr key={i}>
        <td>{i + 1}</td><td><s>{c.original}</s></td><td><b>{c.suggestion}</b></td><td>{c.type && <span className={`ai-mark ai-${tone(c.type)}`}>{c.type}</span>}</td><td>{c.reason}</td></tr>)}</tbody></table></div></details>}
    {task.improvedParagraph && <div className="mt-4"><h4>Model rewrite of your weakest paragraph</h4><blockquote className="ai-rewrite">{task.improvedParagraph}</blockquote></div>}
  </section>;
}

export function WritingFeedback({ evaluation, answers }: { evaluation: WritingAiFeedback; answers: Record<string, string> }) {
  const { output } = evaluation;
  return <div className="stack">
    {(output.summary || output.priorities?.length) && <section className="response-record">
      <h3>AI Writing feedback</h3>
      <p className="muted text-xs">An estimated training band, not an official IELTS score.</p>
      {output.summary && <p className="text-sm mt-3">{output.summary}</p>}
      {output.priorities?.length ? <><h4 className="mt-4">Top priorities</h4><ol className="list-decimal pl-5 text-sm">{output.priorities.map((p, i) => <li key={i}>{p}</li>)}</ol></> : null}
    </section>}
    {output.tasks.map(task => <TaskFeedback key={task.task} task={task} answer={answers[task.task] ?? ""} />)}
  </div>;
}
