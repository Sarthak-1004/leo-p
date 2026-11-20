import "../../styles/dashboard.css";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { api } from "../../services/api";
import { Badge, Button, Card, ContentContainer, EmptyState, Notice, PageHeader } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { ReportIssueModal } from "../../components/ReportIssue";
import { ISSUE_STATUSES, ISSUE_TYPES, type IssuePage, type IssueReport } from "../../types/domain";
import { courseName, dateLabel } from "../../utils/format";

const tone = (status: string) => status === "Resolved" ? "green" : status === "Rejected" || status === "Withdrawn" ? "gray" : status === "In review" ? "blue" : "amber";
type Filters = { status: string; type: string; course: string; page: number; limit: number };

function useIssues(filters: Filters, reload: number) {
  const { mode } = usePreview();
  const [data, setData] = useState<IssuePage | null>(mode === "demo" ? { count: 0, page: 1, open: 0, rows: [] } : null), [error, setError] = useState("");
  useEffect(() => {
    if (mode === "demo") return;
    const c = new AbortController();
    const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit), ...(filters.status ? { status: filters.status } : {}), ...(filters.type ? { type: filters.type } : {}), ...(filters.course ? { course: filters.course } : {}) });
    api<IssuePage>(`/issues?${params}`, { signal: c.signal }).then(d => { setData(d); setError(""); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Reports could not be loaded"); });
    return () => c.abort();
  }, [mode, filters, reload]);
  return { data, error };
}

function FilterBar({ filters, set, admin }: { filters: Filters; set: (f: Filters) => void; admin?: boolean }) {
  return <div className="issue-filters">
    <label className="field"><span className="sr-only">Status</span><select aria-label="Status" value={filters.status} onChange={e => set({ ...filters, status: e.target.value, page: 1 })}><option value="">All statuses</option>{ISSUE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
    <label className="field"><span className="sr-only">Issue type</span><select aria-label="Issue type" value={filters.type} onChange={e => set({ ...filters, type: e.target.value, page: 1 })}><option value="">All types</option>{ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
    {admin && <label className="field"><span className="sr-only">Course</span><select aria-label="Course" value={filters.course} onChange={e => set({ ...filters, course: e.target.value, page: 1 })}><option value="">Both courses</option><option value="GENERAL">General</option><option value="ACADEMIC">Academic</option></select></label>}
    <label className="rows-field"><span>Rows per page</span><select aria-label="Rows per page" value={filters.limit} onChange={e => set({ ...filters, limit: Number(e.target.value), page: 1 })}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label>
  </div>;
}

export function StudentIssues() {
  const { mode } = usePreview();
  const [filters, setFilters] = useState<Filters>({ status: "", type: "", course: "", page: 1, limit: 10 });
  const [reload, setReload] = useState(0), [reporting, setReporting] = useState(false), [message, setMessage] = useState("");
  const { data, error } = useIssues(filters, reload);
  const withdraw = async (issue: IssueReport) => {
    try { await api(`/issues/${issue.id}/withdraw`, { method: "POST" }); setMessage("Report withdrawn."); setReload(n => n + 1); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not withdraw"); }
  };
  return <ContentContainer>
    <PageHeader title="My reported issues" description="Problems you reported with questions, marking or the portal, and the office’s response." actions={mode === "live" ? <Button onClick={() => setReporting(true)}><Icon name="flag" size={16} />Report an issue</Button> : undefined} />
    {mode === "demo" && <Notice>Issue reports are available in the connected portal.</Notice>}
    {message && <p className="muted text-sm" role="status">{message}</p>}
    <Card>
      <FilterBar filters={filters} set={setFilters} />
      {error ? <p className="error-text" role="alert">{error}</p> : !data ? <p role="status" className="muted">Loading reports…</p> : !data.rows.length
        ? <EmptyState title="No issues reported" description={filters.status || filters.type ? "No reports match these filters." : "If you find a problem, report it from a result’s details page or with Report an issue."} />
        : <div className="table-scroll"><table className="data-table issue-table"><thead><tr><th>Type</th><th>Section</th><th>Status</th><th>Questions</th><th>Date reported</th><th>Admin note</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{data.rows.map(i => <tr key={i.id}>
            <td><b>{i.type}</b>{i.testName && <small className="block muted">{i.testName}</small>}<small className="block muted issue-desc">{i.description}</small></td>
            <td data-label="Section">{i.module}</td><td data-label="Status"><Badge tone={tone(i.status)}>{i.status}</Badge></td>
            <td data-label="Questions">{i.questions.length ? i.questions.join(", ") : "—"}</td><td data-label="Reported">{dateLabel(i.createdAt)}</td>
            <td className="issue-note" data-label="Admin note">{i.adminNote || <span className="muted">—</span>}</td>
            <td>{i.status === "Open" && <Button variant="ghost" onClick={() => void withdraw(i)}>Withdraw</Button>}</td>
          </tr>)}</tbody></table></div>}
      {data && <Pagination page={data.page} pages={Math.max(1, Math.ceil(data.count / filters.limit))} setPage={page => setFilters({ ...filters, page })} count={data.count} />}
    </Card>
    {reporting && <ReportIssueModal onClose={() => setReporting(false)} onSaved={() => { setReporting(false); setMessage("Thank you. Your report was sent to the office."); setReload(n => n + 1); }} />}
  </ContentContainer>;
}

function AdminIssueRow({ issue, onSaved }: { issue: IssueReport; onSaved: () => void }) {
  const [status, setStatus] = useState(issue.status === "Withdrawn" ? "Open" : issue.status), [note, setNote] = useState(issue.adminNote), [state, setState] = useState("");
  const changed = status !== issue.status || note.trim() !== issue.adminNote;
  const save = async () => {
    setState("Saving…");
    try { await api(`/admin/issues/${issue.id}`, { method: "PUT", body: { status, adminNote: note, version: issue.version } }); setState("Saved"); onSaved(); }
    catch (e) { setState(e instanceof Error ? e.message : "Could not save"); }
  };
  return <article className="issue-card">
    <div className="issue-card-head"><div><b>{issue.type}</b> · {issue.module}{issue.questions.length > 0 && <> · {issue.questions.join(", ")}</>}
      <small className="block muted">{issue.studentName ?? issue.studentId} · {courseName(issue.course)}{issue.testName && ` · ${issue.testName}`} · {dateLabel(issue.createdAt)}</small></div>
      <Badge tone={tone(issue.status)}>{issue.status}</Badge></div>
    <p className="issue-text">{issue.description}</p>
    {issue.resultId && <Link className="table-link text-xs" to={`/admin/results/${issue.resultId}`}>Open the student’s result</Link>}
    {issue.status === "Withdrawn" ? <p className="muted text-xs mt-2">The student withdrew this report.</p> : <div className="issue-edit">
      <label className="field">Status<select value={status} onChange={e => setStatus(e.target.value as typeof status)}>{ISSUE_STATUSES.filter(s => s !== "Withdrawn").map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="field">Note to the student<textarea rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="What was found or changed" /></label>
      <div className="actions"><Button onClick={() => void save()} disabled={!changed || state === "Saving…"}>Save and notify</Button>{state && <span className="muted text-xs" role="status">{state}</span>}</div>
    </div>}
  </article>;
}

export function AdminIssues() {
  const { mode } = usePreview();
  const [filters, setFilters] = useState<Filters>({ status: "", type: "", course: "", page: 1, limit: 10 });
  const [reload, setReload] = useState(0);
  const { data, error } = useIssues(filters, reload);
  const refresh = useCallback(() => setReload(n => n + 1), []);
  return <ContentContainer>
    <PageHeader title="Issue reports" description="Problems students reported with questions, marking or the portal." actions={data ? <Badge tone={data.open ? "amber" : "green"}>{data.open} awaiting action</Badge> : undefined} />
    {mode === "demo" && <Notice>Issue reports are available in the connected portal.</Notice>}
    <Card>
      <FilterBar filters={filters} set={setFilters} admin />
      {error ? <p className="error-text" role="alert">{error}</p> : !data ? <p role="status" className="muted">Loading reports…</p> : !data.rows.length
        ? <EmptyState title="No reports" description="Nothing matches these filters." />
        : <div className="stack">{data.rows.map(i => <AdminIssueRow key={`${i.id}-${i.version}`} issue={i} onSaved={refresh} />)}</div>}
      {data && <Pagination page={data.page} pages={Math.max(1, Math.ceil(data.count / filters.limit))} setPage={page => setFilters({ ...filters, page })} count={data.count} />}
    </Card>
  </ContentContainer>;
}
