import { PasswordReset } from "../../components/PasswordReset";
import { ImportPanel } from "../../components/ImportPanel";
import { useState } from "react";
import { usePreview } from "../../app/PreviewContext";
import { Badge, Button, Card, ContentContainer, EmptyState, Modal, Notice, PageHeader, SectionTitle } from "../../components/ui";
import type { Student, Trainer } from "../../types/domain";
import { courseName } from "../../utils/format";

function TrainerForm({ trainer, onClose }: { trainer?: Trainer; onClose: () => void }) {
  const { trainers, updateTrainer, mode } = usePreview();
  const [draft, setDraft] = useState<Trainer>(trainer ?? { id: "", name: "", email: "", enabled: true });
  const [error, setError] = useState("");
  return <Modal title={trainer ? "Edit trainer" : "Create sample trainer"} onClose={onClose}><form className="stack" onSubmit={async (event) => {
    event.preventDefault();
    const next = { ...draft, id: draft.id.trim(), name: draft.name.trim(), email: draft.email.trim() };
    if (!next.id || !next.name || !next.email) { setError("Complete the Trainer ID, name and email."); return; }
    if (!trainer && trainers.some((item) => item.id.toLowerCase() === next.id.toLowerCase())) { setError("This Trainer ID already exists."); return; }
    if (trainers.some((item) => item.id !== trainer?.id && item.email.toLowerCase() === next.email.toLowerCase())) { setError("This trainer email already exists."); return; }
    if ((await updateTrainer(next)) !== false) onClose();
  }}><Notice>{mode === "demo" ? "Preview only. No login credentials are created." : "Admin controls trainer credentials and account status."}</Notice><div className="form-grid"><label className="field">Trainer ID<input required readOnly={Boolean(trainer)} value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></label><label className="field">Name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field">Email<input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>{mode === "live" && !trainer && <label className="field">Initial password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={draft.password ?? ""} onChange={e => setDraft({...draft,password:e.target.value})}/></label>}<label className="field">Status<select value={draft.enabled ? "active" : "disabled"} onChange={(event) => setDraft({ ...draft, enabled: event.target.value === "active" })}><option value="active">Active</option><option value="disabled">Disabled</option></select></label></div>{error && <p role="alert" className="error-text">{error}</p>}<Button type="submit">{mode === "demo" ? "Save to preview" : "Save trainer"}</Button></form></Modal>;
}

interface AssignmentRow { row: number; studentId: string; studentName: string; trainerId: string; course: string; error: string; }
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { field += '"'; index++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index++; row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
function validateRows(rows: AssignmentRow[], students: Student[], trainers: Trainer[]): AssignmentRow[] {
  return rows.map((row) => {
    const student = students.find((item) => item.id === row.studentId);
    const trainer = trainers.find((item) => item.id === row.trainerId);
    const errors: string[] = [];
    if (!row.studentId || !row.trainerId || !row.course) errors.push("Student ID, Teacher ID and Course are required");
    if (row.studentId && !student) errors.push("Student ID not found");
    if (row.trainerId && !trainer) errors.push("Teacher ID not found");
    if (trainer && !trainer.enabled) errors.push("Trainer is disabled");
    if (rows.filter((item) => item.studentId === row.studentId).length > 1) errors.push("Duplicate Student ID in this file");
    if (student && row.studentName && student.name.toLowerCase() !== row.studentName.toLowerCase()) errors.push("Student name does not match the Student ID");
    if (student && row.course !== student.course) errors.push("Course does not match the student");
    if (student?.trainerId === row.trainerId) errors.push("Student is already assigned to this trainer");
    return { ...row, error: errors.join("; ") };
  });
}
function downloadCSV(name: string, lines: string[][]) {
  const escaped = lines.map((row) => row.map((value) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", escaped], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function BulkAssignments() { const {mode}=usePreview();return mode === "live" ? <ImportPanel kind="assignments" /> : <DemoBulkAssignments />; }
function DemoBulkAssignments() {
  const { students, trainers, updateStudent, addAudit } = usePreview();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState(false);
  const valid = rows.filter((row) => !row.error);
  async function upload(file?: File) {
    setRows([]); setError(""); setMessage(""); setApplied(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a CSV file. XLSX import is awaiting the backend import service."); return; }
    if (file.size > 1024 * 1024) { setError("Choose a CSV smaller than 1 MB for this preview."); return; }
    try {
      const parsed = parseCSV((await file.text()).replace(/^\uFEFF/, ""));
      const headers = parsed[0]?.map((value) => value.toLowerCase().replace(/[ _-]/g, "")) ?? [];
      const studentIndex = headers.indexOf("studentid"), nameIndex = headers.indexOf("studentname"), trainerIndex = Math.max(headers.indexOf("teacherid"), headers.indexOf("trainerid")), courseIndex = headers.indexOf("course");
      if ([studentIndex, trainerIndex, courseIndex].some((index) => index < 0)) throw new Error("CSV headers must include Student ID, Teacher ID and Course. Student Name is optional.");
      if (parsed.length < 2) throw new Error("The CSV contains no assignment rows.");
      const next = parsed.slice(1).map((row, index) => ({ row: index + 2, studentId: row[studentIndex] ?? "", studentName: nameIndex >= 0 ? row[nameIndex] ?? "" : "", trainerId: row[trainerIndex] ?? "", course: (row[courseIndex] ?? "").toUpperCase().replace(/^IELTS\s+/, "").replace("GENERAL TRAINING", "GENERAL"), error: "" }));
      setRows(validateRows(next, students, trainers));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read this CSV."); }
  }
  return <Card><SectionTitle title="Bulk student assignment" detail={<Badge tone="gray">CSV preview</Badge>} /><p className="muted text-sm mb-5">Upload, review validation, then apply valid rows. XLSX import will use the backend import service.</p><div className="actions"><label className="field">Assignment CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { void upload(event.target.files?.[0]); }} /></label><Button variant="secondary" onClick={() => downloadCSV("trainer-assignment-template.csv", [["Student ID", "Student Name", "Teacher ID", "Course"]])}>Download template</Button></div>
    {error && <p role="alert" className="error-text mt-4">{error}</p>}
    {rows.length > 0 && <><div className="actions my-5"><Badge tone="green">{valid.length} valid</Badge><Badge tone={rows.length > valid.length ? "red" : "gray"}>{rows.length - valid.length} errors</Badge></div><div className="stack">{rows.map((row) => <div className="mobile-record" key={row.row}><div className="row between"><strong className="text-sm">Row {row.row}: {row.studentId || "Missing Student ID"} → {row.trainerId || "Missing Teacher ID"}</strong><Badge tone={row.error ? "red" : "green"}>{row.error ? "Invalid" : "Valid"}</Badge></div><p className={row.error ? "error-text text-xs" : "muted text-xs"}>{row.error || `${row.course} · Ready to assign`}</p></div>)}</div><div className="actions mt-6"><Button disabled={!valid.length || applied} onClick={() => {
      const rechecked = validateRows(rows, students, trainers); const ready = rechecked.filter((row) => !row.error);
      setRows(rechecked); if (!ready.length) { setError("No valid assignments remain. Review the errors and upload a corrected file."); return; }
      ready.forEach((row) => { const student = students.find((item) => item.id === row.studentId); if (student) updateStudent({ ...student, trainerId: row.trainerId }); });
      addAudit("Bulk assignment", "CSV import", `${ready.length} assignments applied; ${rows.length - ready.length} rows rejected`);
      setApplied(true); setMessage(`${ready.length} assignments applied to this preview. ${rows.length - ready.length} rows were not imported.`);
    }}>Confirm {valid.length} assignments</Button>{rows.some((row) => row.error) && <Button variant="secondary" onClick={() => downloadCSV("assignment-errors.csv", [["Row", "Student ID", "Teacher ID", "Course", "Error"], ...rows.filter((row) => row.error).map((row) => [String(row.row), row.studentId, row.trainerId, row.course, row.error])])}>Download errors</Button>}</div></>}
    {message && <div className="mt-5"><Notice>{message}</Notice></div>}
  </Card>;
}

export function Trainers() {
  const { trainers, students, results, updateTrainer, updateStudent,mode } = usePreview();
  const [reset, setReset] = useState<string | null>(null);
  const [edit, setEdit] = useState<Trainer | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [studentId, setStudentId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [movePending,setMovePending]=useState(false);
  const filtered = trainers.filter((trainer) => `${trainer.name} ${trainer.id} ${trainer.email}`.toLowerCase().includes(search.toLowerCase()));
  return <ContentContainer><PageHeader title="Trainer management" description="Manage trainers, assignments and evaluation workload." actions={<Button onClick={() => setEdit("new")}>Add trainer</Button>} />
    <Card><label className="field mb-6">Search trainers<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Trainer ID or email" /></label>{filtered.length ? <div className="stack">{filtered.map((trainer) => {
      const assigned = students.filter((student) => student.trainerId === trainer.id);
      const pending = results.filter((result) => result.kind === "FLT" && result.reviewStatus !== "Completed" && assigned.some((student) => student.id === result.studentId));
      const completed = results.filter((result) => result.evaluatedBy === trainer.id && result.reviewStatus === "Completed");
      return <div className="mobile-record" key={trainer.id}><div className="row between"><div><h3>{trainer.name}</h3><p className="muted text-xs">{trainer.id} · {trainer.email}</p></div><Badge tone={trainer.enabled ? "green" : "gray"}>{trainer.enabled ? "Active" : "Disabled"}</Badge></div><div className="actions text-xs"><span>{assigned.length} assigned students</span><span>{pending.length} pending</span><span>{completed.length} completed</span></div><div className="actions"><Button variant="secondary" onClick={() => setEdit(trainer)}>Edit</Button><Button variant="ghost" onClick={() => updateTrainer({ ...trainer, enabled: !trainer.enabled })}>{trainer.enabled ? "Disable" : "Enable"}</Button><Button variant="ghost" onClick={() => setReset(trainer.id)}>Reset password</Button></div><details><summary className="text-sm">Assigned students ({assigned.length})</summary>{assigned.length ? assigned.map((student) => <div className="list-row" key={student.id}><span className="text-sm">{student.name} · {courseName(student.course)}</span><Button variant="ghost" onClick={() => updateStudent({ ...student, trainerId: undefined })}>Remove assignment</Button></div>) : <p className="muted text-sm mt-3">No students assigned.</p>}</details></div>;
    })}</div> : <EmptyState title="No matching trainers" />}</Card>
    {message && <Notice>{message}</Notice>}
    <Card><SectionTitle title="Assign a student" /><form className="stack" onSubmit={async (event) => { event.preventDefault(); const student = students.find((item) => item.id === studentId); const trainer = trainers.find((item) => item.id === trainerId); if (!student || !trainer?.enabled) return; if ((await updateStudent({ ...student, trainerId,movePending })) === false) return; setMessage(`${student.name} assigned to ${trainer.name}${mode === "demo" ? " in this preview" : ""}.`); }}><div className="form-grid"><label className="field">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.id})</option>)}</select></label><label className="field">Trainer<select required value={trainerId} onChange={(event) => setTrainerId(event.target.value)}><option value="">Select trainer</option>{trainers.filter((trainer) => trainer.enabled).map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label></div>{mode === "live" && <label className="row text-sm"><input type="checkbox" checked={movePending} onChange={e=>setMovePending(e.target.checked)}/>Move pending evaluations to this trainer</label>}<Button type="submit">Apply assignment</Button></form></Card>
    <BulkAssignments />
    {reset && <PasswordReset id={reset} onClose={() => setReset(null)} />}
    {edit && <TrainerForm trainer={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
  </ContentContainer>;
}
