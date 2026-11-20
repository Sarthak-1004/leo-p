import "../styles/dashboard.css";
import { useState } from "react";
import { api } from "../services/api";
import { ISSUE_MODULES, ISSUE_TYPES, type IssueReport, type Question } from "../types/domain";
import { Button, Modal } from "./ui";

// Report form. From a result it offers that test's questions, numbered as the student saw them.
export function ReportIssueModal({ resultId, testName, questions = [], onClose, onSaved }: {
  resultId?: string; testName?: string; questions?: Question[]; onClose: () => void; onSaved: (issue: IssueReport) => void;
}) {
  const skills = ["Listening", "Reading", "Writing"] as const;
  const [module, setModule] = useState<typeof ISSUE_MODULES[number]>(resultId ? "Listening" : "General");
  const [type, setType] = useState<typeof ISSUE_TYPES[number]>(resultId ? "Wrong answer key" : "Technical problem");
  const [picked, setPicked] = useState<string[]>([]), [description, setDescription] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const options = skills.includes(module as typeof skills[number]) ? questions.filter(q => q.skill === module).map((q, i) => ({ id: q.id, label: module === "Writing" ? (q.section ?? `Task ${i + 1}`) : `Q${i + 1}` })) : [];
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= 20 ? p : [...p, id]);
  const submit = async () => {
    setBusy(true); setError("");
    try { onSaved(await api<IssueReport>("/issues", { method: "POST", body: { resultId: resultId ?? null, module, type, questionIds: picked.filter(id => options.some(o => o.id === id)), description } })); }
    catch (e) { setError(e instanceof Error ? e.message : "The report could not be sent"); }
    finally { setBusy(false); }
  };
  return <Modal title="Report an issue" onClose={onClose}>
    <div className="stack issue-form">
      {testName && <p className="muted text-sm">Test: <b>{testName}</b></p>}
      <div className="form-grid">
        <label className="field">Section<select value={module} onChange={e => { setModule(e.target.value as typeof module); setPicked([]); }}>{ISSUE_MODULES.map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="field">Issue type<select value={type} onChange={e => setType(e.target.value as typeof type)}>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
      </div>
      {options.length > 0 && <fieldset className="field"><legend>Questions (optional)</legend>
        <div className="question-picks">{options.map(o => <label key={o.id} className={picked.includes(o.id) ? "on" : ""}><input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />{o.label}</label>)}</div>
      </fieldset>}
      <label className="field">What is wrong?<textarea rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} placeholder="For example: the answer key says “Tuesday” but the audio says “Thursday”." /></label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><Button onClick={() => void submit()} disabled={busy || description.trim().length < 10}>{busy ? "Sending…" : "Send report"}</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></div>
      <p className="muted text-xs">The office reviews every report. You will get a notification when its status changes.</p>
    </div>
  </Modal>;
}
