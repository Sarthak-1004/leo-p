import { MarksheetResponses } from "../../components/MarksheetResponses";
import { api } from "../../services/api";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { Badge, Button, Card, ContentContainer, EmptyState, LinkButton, Notice, PageHeader, SectionTitle } from "../../components/ui";
import type { Result } from "../../types/domain";
import { courseName } from "../../utils/format";

const criteriaLabels = [
  ["fluency", "Fluency and Coherence"],
  ["lexical", "Lexical Resource"],
  ["grammar", "Grammatical Range and Accuracy"],
  ["pronunciation", "Pronunciation"],
] as const;

function EvaluationForm({ result, admin, onChanged }: { result: Result; admin: boolean; onChanged:()=>void }) {
  const { students, trainers, trainerId, reviseResult, releaseResults, updateResult, addAudit, mode, refresh } = usePreview();
  const student = students.find((item) => item.id === result.studentId);
  const trainer = trainers.find((item) => item.id === trainerId);
  const modules=result.modules??["Listening","Reading","Writing"];
  const [baseVersion,setBaseVersion]=useState(result.version);
  const advanceVersion=()=>setBaseVersion(v=>v===undefined?undefined:v+1);
  const source = result.evaluationDraft ?? result;
  const [scores, setScores] = useState({ listening: source.listening === null ? "" : String(source.listening), reading: source.reading === null ? "" : String(source.reading), writing: source.writing === null ? "" : String(source.writing) });
  const [criteria, setCriteria] = useState<Record<(typeof criteriaLabels)[number][0], string>>({ fluency: source.speakingCriteria ? String(source.speakingCriteria.fluency) : "", lexical: source.speakingCriteria ? String(source.speakingCriteria.lexical) : "", grammar: source.speakingCriteria ? String(source.speakingCriteria.grammar) : "", pronunciation: source.speakingCriteria ? String(source.speakingCriteria.pronunciation) : "" });
  const [speakingDate, setSpeakingDate] = useState(source.speakingDate ?? "");
  const [remarks, setRemarks] = useState(result.evaluationDraft?.remarks ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const completeCriteria = criteriaLabels.every(([key]) => criteria[key] !== "");
  const anyCriteria = criteriaLabels.some(([key]) => criteria[key] !== "");
  const speaking = completeCriteria ? Math.round(criteriaLabels.reduce((sum, [key]) => sum + Number(criteria[key]), 0) / 4 * 2) / 2 : result.speaking;
  const writing = scores.writing === "" ? null : Number(scores.writing);
  const draftOverall = writing === null || scores.listening === "" || scores.reading === "" ? null : Math.round((Number(scores.listening) + Number(scores.reading) + writing + (speaking ?? 0)) / (speaking === null ? 3 : 4) * 2) / 2;
  useEffect(() => { if (mode === "live") void api<{claimed:boolean;reviewer:string}>(`/results/${result.id}/claim`,{method:"POST"}).then(response => { if (!response.claimed) setMessage(`Being checked by ${response.reviewer}. Reload before saving concurrent changes.`); }).catch(reason => setError(reason.message)); }, [result.id,mode]);
  const canRelease = result.kind === "FLT" && result.listening !== null && result.reading !== null && result.writing !== null && result.reviewStatus === "Completed" && !result.released;

  async function save(completed: boolean) {
    setError(""); setMessage("");
    const validBand = (value: string) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 9 && Number.isInteger(Number(value) * 2);
    if ((["listening","reading","writing"] as const).some(key=>scores[key]!==""&&!validBand(scores[key]))) { setError("Enter bands from 0 to 9 in half-band steps."); return; }
    if (anyCriteria && (!completeCriteria || criteriaLabels.some(([key]) => !Number.isInteger(Number(criteria[key])) || Number(criteria[key]) < 0 || Number(criteria[key]) > 9) || !speakingDate)) { setError("Enter all four whole-number Speaking criteria (0–9) and the offline test date."); return; }
    if (completed && ((result.kind === "PRACTICE"?modules.includes("Writing"):true) && writing === null || result.kind !== "PRACTICE" && (scores.listening === "" || scores.reading === ""))) { setError("Evaluate Writing before completing the review. Speaking can remain pending."); return; }
    const changed = (scores.listening === "" ? null : Number(scores.listening)) !== result.listening || (scores.reading === "" ? null : Number(scores.reading)) !== result.reading || writing !== result.writing || speaking !== result.speaking || (anyCriteria && (speakingDate !== result.speakingDate || criteriaLabels.some(([key]) => Number(criteria[key]) !== result.speakingCriteria?.[key])));
    if (changed && !remarks.trim()) { setError("Add remarks explaining the score change before saving."); return; }
    const next: Result = { ...result, version:baseVersion,listening: (scores.listening === "" ? null : Number(scores.listening)), reading: (scores.reading === "" ? null : Number(scores.reading)), writing, speaking, overall: draftOverall, reviewStatus: completed ? "Completed" : "In review", evaluatedBy: admin ? "admin" : trainerId, remarks: remarks.trim() || result.remarks };
    if (anyCriteria) { next.speakingCriteria = { fluency: Number(criteria.fluency), lexical: Number(criteria.lexical), grammar: Number(criteria.grammar), pronunciation: Number(criteria.pronunciation) }; next.speakingDate = speakingDate; }
    if (!completed) {
      const saved = await updateResult({ ...result, version:baseVersion,reviewStatus: result.released ? result.reviewStatus : "In review", evaluatedBy: result.released ? result.evaluatedBy : next.evaluatedBy, evaluationDraft: { listening: next.listening, reading: next.reading, writing: next.writing, speaking: next.speaking, speakingCriteria: next.speakingCriteria, speakingDate: next.speakingDate, remarks: remarks.trim(), actor: next.evaluatedBy ?? "admin" } });
      if (saved === false) return;advanceVersion();onChanged();
      addAudit("Evaluation draft saved", result.id, "Draft kept separate from approved scores");
      setMessage(mode === "demo" ? "Draft saved in this preview. Approved scores remain unchanged." : "Draft saved. Approved scores remain unchanged."); return;
    }
    next.evaluationDraft = undefined;
    if (!await reviseResult(next, admin ? "Kanan Admin" : trainer?.name ?? trainerId, remarks.trim())) { setError("The evaluation could not be saved. Check scores and required remarks."); return; }
    advanceVersion();onChanged();setRemarks("");
    setMessage(mode === "demo" ? (completed ? "Review completed in this preview." : "Evaluation draft saved in this preview.") : "Review completed.");
  }

  return <ContentContainer>
    <PageHeader eyebrow={`${admin ? "Admin" : "Trainer"} / Marksheet`} title={result.name} description={`${student?.name ?? result.studentId} · ${result.studentId} · ${courseName(result.course)}`} actions={<LinkButton secondary to={admin ? "/admin/results" : "/trainer/evaluations"}>Back to {admin ? "results" : "queue"}</LinkButton>} />
    <div className="actions"><Button variant="secondary" onClick={()=>{if(window.confirm("Reload the marksheet? Unsaved edits will be replaced by the latest saved evaluation."))window.location.reload();}}>Reload marksheet</Button><Badge tone={result.released ? "green" : "amber"}>{result.released ? "Released" : "Not released"}</Badge><Badge tone="gray">Review: {result.reviewStatus}</Badge><Badge tone={result.aiStatus === "Failed" ? "red" : "gray"}>Writing AI: {result.aiStatus}</Badge>{result.kind === "FLT" && result.speaking === null && <Badge tone="amber">Speaking marks pending</Badge>}</div>
    {result.reviewStatus === "In review" && result.evaluatedBy && result.evaluatedBy !== trainerId && <Notice>Being checked by {trainers.find((item) => item.id === result.evaluatedBy)?.name ?? result.evaluatedBy}. Coordinate before changing this marksheet.</Notice>}
    <form className="stack" onSubmit={(event) => { event.preventDefault(); save(true); }}>
      <div className="two-column"><Card><SectionTitle title="Section bands" detail={<Badge>0–9</Badge>} /><div className="form-grid">{(["listening", "reading", "writing"] as const).filter(skill=>modules.includes(skill[0].toUpperCase()+skill.slice(1))).map((skill) => <label className="field" key={skill}>{skill[0].toUpperCase() + skill.slice(1)}<input type="number" min="0" max="9" step="0.5" value={scores[skill]} onChange={(event) => setScores((previous) => ({ ...previous, [skill]: event.target.value }))} placeholder={skill === "writing" ? "Pending evaluation" : undefined} /></label>)}</div><p className="muted text-xs mt-5">Section overrides require remarks. Previous scores remain in the revision history.</p><div className="list-row"><span>{speaking === null ? "Overall (3 skills) — Speaking pending" : "Overall (4 skills)"}</span><strong>{draftOverall?.toFixed(1) ?? "Pending"}</strong></div></Card>
      {modules.includes("Writing") && <Card><SectionTitle title="Writing evaluation" /><p className="muted text-sm">AI-generated scores are estimates. Trainers and Admin approve the final band.</p><div className="list-row"><span>AI evaluation</span><Badge tone={result.aiStatus === "Failed" ? "red" : "gray"}>{result.aiStatus === "Failed" ? "Failed / Retry required" : result.aiStatus}</Badge></div><p className="text-sm mt-4">{mode === "demo" ? "This preview does not generate AI feedback." : "Submitted responses and available evaluation feedback appear below. Failed evaluations can be retried or reviewed manually."}</p><div className="mt-5"><Button variant="secondary" type="button" onClick={async () => { if(mode === "demo"){setMessage("AI evaluation is not connected. No request was sent; you can enter a manual Writing score with remarks.");return;}try{await api(`/results/${result.id}/retry-ai`,{method:"POST"});await refresh();advanceVersion();onChanged();setMessage("Writing evaluation queued.");}catch(reason){setError(reason instanceof Error?reason.message:"Could not queue evaluation");}}}>{result.aiStatus === "Failed" ? "Retry AI evaluation" : "Re-evaluate Writing"}</Button></div></Card>}</div>
      {result.kind === "FLT" && <Card><SectionTitle title="Offline Speaking" detail={<Badge tone="gray">Trainer assessed</Badge>} /><p className="muted text-sm mb-6">Record the test date and all four criteria. Each criterion uses a whole band from 0 to 9.</p><div className="form-grid"><label className="field">Offline Speaking date<input type="date" value={speakingDate} onChange={(event) => setSpeakingDate(event.target.value)} /></label>{criteriaLabels.map(([key, label]) => <label className="field" key={key}>{label}<select value={criteria[key]} onChange={(event) => setCriteria((previous) => ({ ...previous, [key]: event.target.value }))}><option value="">Pending</option>{Array.from({ length: 10 }, (_, value) => <option value={value} key={value}>{value}</option>)}</select></label>)}</div><div className="list-row"><span>Speaking band</span><strong>{speaking?.toFixed(1) ?? "Pending"}</strong></div></Card>}
      <Card><SectionTitle title="Evaluation remarks" /><label className="field">Reason for changes<textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Explain any score changes. Required when changing marks." /></label>{result.remarks && <p className="muted text-sm mt-4">Latest feedback: {result.remarks}</p>}<div className="actions mt-6"><Button type="button" variant="secondary" onClick={() => save(false)}>Save draft</Button><Button type="submit">Complete review</Button></div></Card>
    </form>
    {error && <p role="alert" className="error-text">{error}</p>}{message && <Notice>{message}</Notice>}
    {admin && <Card><SectionTitle title="Result release" detail={<Badge tone={result.released ? "green" : "amber"}>{result.released ? "Released" : "Internal"}</Badge>} /><p className="muted text-sm">Complete Listening, Reading, Writing and the review before release. Speaking may remain pending; adding it later updates the result.</p><div className="mt-5"><Button disabled={!canRelease} onClick={async () => { const count = await releaseResults([result.id]); if(count)advanceVersion();onChanged();setMessage(count ? (mode === "demo" ? "Result released in this preview. A student notification was added." : "Result released. Student notification sent.") : "The result is not ready to release."); }}>Release result</Button></div></Card>}
    {mode === "live" && <MarksheetResponses id={result.id} version={result.version} />}
    <Card><SectionTitle title="Score revision history" />{result.revisions?.length ? <div className="stack">{[...result.revisions].reverse().map((revision) => <div className="mobile-record" key={revision.id}><div className="row between"><strong>{revision.section}: {revision.previous === null ? "Pending" : revision.previous.toFixed(1)} → {revision.value === null ? "Pending" : revision.value.toFixed(1)}</strong><span className="muted text-xs">{new Date(revision.at).toLocaleString("en-GB",{timeZone:"Asia/Kolkata"})} IST</span></div><p className="text-sm">{revision.remarks}</p><p className="muted text-xs">{revision.actor}{revision.role?` / ${revision.role}`:""}</p></div>)}</div> : <EmptyState title="No score changes yet" description="Each saved score change records its previous value, author, time and remarks." />}</Card>
  </ContentContainer>;
}

export function Evaluation({ admin = false }: { admin?: boolean }) {
  const { attemptId } = useParams();const { results,mode } = usePreview();
  const found=results.find(item=>item.id===attemptId);
  const [record,setRecord]=useState<Result>();const [error,setError]=useState("");const [revision,setRevision]=useState(0);
  useEffect(()=>{if(mode!=="live")return;const controller=new AbortController();api<Result>(`/results/${attemptId}`,{signal:controller.signal}).then(r=>{setRecord(r);setError("");}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[attemptId,mode,found?.version,revision]);
  const result=mode==="live"?record:found;
  if(!result)return <ContentContainer><EmptyState title={error||"Loading marksheet..."} action={<LinkButton to={admin?"/admin/results":"/trainer/evaluations"}>Back to results</LinkButton>}/></ContentContainer>;
  return <EvaluationForm key={result.id} result={result} admin={admin} onChanged={()=>setRevision(n=>n+1)}/>;
}
