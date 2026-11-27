import "../../styles/dashboard.css";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { api } from "../../services/api";
import { Badge, Button, Card, ContentContainer, EmptyState, Modal, Notice, PageHeader } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { REQUEST_STATUSES, REQUEST_TYPES, type RequestPage, type SupportRequest } from "../../types/domain";
import { courseName, dateLabel } from "../../utils/format";

const tone = (s: string) =>
  s === "Done"
    ? "green"
    : s === "Planned" || s === "In review"
      ? "blue"
      : s === "Declined" || s === "Withdrawn"
        ? "gray"
        : "amber";
type Filters = { status: string; type: string; course: string; page: number; limit: number };

function useRequests(filters: Filters, reload: number, enabled = true) {
  const { mode } = usePreview();
  const [data, setData] = useState<RequestPage | null>(
      mode === "demo" ? { count: 0, page: 1, open: 0, rows: [] } : null,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (mode === "demo" || !enabled) return;
    const c = new AbortController();
    const params = new URLSearchParams({
      page: String(filters.page),
      limit: String(filters.limit),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.course ? { course: filters.course } : {}),
    });
    api<RequestPage>(`/requests?${params}`, { signal: c.signal })
      .then(d => {
        setData(d);
        setError("");
      })
      .catch(e => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Requests could not be loaded");
      });
    return () => c.abort();
  }, [mode, filters, reload, enabled]);
  return { data, error };
}

function Filters({ filters, set, admin }: { filters: Filters; set: (f: Filters) => void; admin?: boolean }) {
  return (
    <div className="issue-filters">
      <label className="field">
        <span className="sr-only">Status</span>
        <select
          aria-label="Status"
          value={filters.status}
          onChange={e => set({ ...filters, status: e.target.value, page: 1 })}
        >
          <option value="">All statuses</option>
          {REQUEST_STATUSES.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="sr-only">Request type</span>
        <select
          aria-label="Request type"
          value={filters.type}
          onChange={e => set({ ...filters, type: e.target.value, page: 1 })}
        >
          <option value="">All types</option>
          {REQUEST_TYPES.map(t => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {admin && (
        <label className="field">
          <span className="sr-only">Course</span>
          <select
            aria-label="Course"
            value={filters.course}
            onChange={e => set({ ...filters, course: e.target.value, page: 1 })}
          >
            <option value="">Both courses</option>
            <option value="GENERAL">General</option>
            <option value="ACADEMIC">Academic</option>
          </select>
        </label>
      )}
      <label className="rows-field">
        <span>Rows per page</span>
        <select
          aria-label="Rows per page"
          value={filters.limit}
          onChange={e => set({ ...filters, limit: Number(e.target.value), page: 1 })}
        >
          {[10, 20, 50].map(n => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function NewRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<(typeof REQUEST_TYPES)[number]>("Improvement idea"),
    [subject, setSubject] = useState(""),
    [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/requests", { method: "POST", body: { type, subject, description } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request could not be sent");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="New request" onClose={onClose}>
      <div className="stack">
        <label className="field">
          Request type
          <select value={type} onChange={e => setType(e.target.value as typeof type)}>
            {REQUEST_TYPES.map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Subject
          <input
            maxLength={150}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="For example: Download my result as a PDF"
          />
        </label>
        <label className="field">
          Details
          <textarea
            rows={5}
            maxLength={3000}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What happened, or what would help you, and why"
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button
            onClick={() => void submit()}
            disabled={busy || subject.trim().length < 5 || description.trim().length < 10}
          >
            {busy ? "Sending…" : "Submit request"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function StudentRequests() {
  const { mode } = usePreview();
  const [view, setView] = useState<"home" | "mine">("home"),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState("");
  const [filters, setFilters] = useState<Filters>({ status: "", type: "", course: "", page: 1, limit: 10 }),
    [reload, setReload] = useState(0);
  const { data, error } = useRequests(filters, reload, view === "mine");
  const withdraw = async (r: SupportRequest) => {
    try {
      await api(`/requests/${r.id}/withdraw`, { method: "POST" });
      setMessage("Request withdrawn.");
      setReload(n => n + 1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not withdraw");
    }
  };
  return (
    <ContentContainer>
      <PageHeader
        title="Raise a request"
        description="Share a portal problem, an improvement idea or a new feature request."
        actions={
          view === "mine" ? (
            <Button variant="secondary" onClick={() => setView("home")}>
              Back
            </Button>
          ) : undefined
        }
      />
      {mode === "demo" && <Notice>Requests are available in the connected portal.</Notice>}
      {message && (
        <p className="muted text-sm" role="status">
          {message}
        </p>
      )}
      {view === "home" ? (
        <>
          <div className="request-choices">
            <button
              type="button"
              className="card request-choice"
              onClick={() => setCreating(true)}
              disabled={mode === "demo"}
            >
              <Icon name="file-plus" size={40} />
              <strong>+ New request</strong>
              <span>Submit a new request</span>
            </button>
            <button
              type="button"
              className="card request-choice"
              onClick={() => {
                setView("mine");
                setMessage("");
              }}
              disabled={mode === "demo"}
            >
              <Icon name="list-check" size={40} />
              <strong>My requests</strong>
              <span>Track and view all your requests</span>
            </button>
          </div>
          <div className="request-info" role="note">
            <Icon name="info" size={20} />
            <div>
              <p>This is for general portal problems, feedback and feature requests.</p>
              <p>
                For a problem with a specific test question, answer, audio or content, use <b>Report an issue</b> on the
                result’s details page, or <Link to="/student/issues">Issue Reports</Link>.
              </p>
            </div>
          </div>
        </>
      ) : (
        <Card>
          <Filters filters={filters} set={setFilters} />
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : !data ? (
            <p role="status" className="muted">
              Loading requests…
            </p>
          ) : !data.rows.length ? (
            <EmptyState
              title="No requests yet"
              description={
                filters.status || filters.type
                  ? "No requests match these filters."
                  : "Use New request to share a problem or idea with the office."
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table issue-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Reply</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.subject}</b>
                        <small className="block muted issue-desc">{r.description}</small>
                      </td>
                      <td data-label="Type">{r.type}</td>
                      <td data-label="Status">
                        <Badge tone={tone(r.status)}>{r.status}</Badge>
                      </td>
                      <td data-label="Submitted">{dateLabel(r.createdAt)}</td>
                      <td className="issue-note" data-label="Reply">
                        {r.adminNote || <span className="muted">—</span>}
                      </td>
                      <td>
                        {r.status === "Open" && (
                          <Button variant="ghost" onClick={() => void withdraw(r)}>
                            Withdraw
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && (
            <Pagination
              page={data.page}
              pages={Math.max(1, Math.ceil(data.count / filters.limit))}
              setPage={page => setFilters({ ...filters, page })}
              count={data.count}
            />
          )}
        </Card>
      )}
      {creating && (
        <NewRequestModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setMessage("Thank you. Your request was sent to the office. Track it under My requests.");
            setReload(n => n + 1);
          }}
        />
      )}
    </ContentContainer>
  );
}

function AdminRequestRow({ request, onSaved }: { request: SupportRequest; onSaved: () => void }) {
  const [status, setStatus] = useState(request.status === "Withdrawn" ? "Open" : request.status),
    [note, setNote] = useState(request.adminNote),
    [state, setState] = useState("");
  const changed = status !== request.status || note.trim() !== request.adminNote;
  const save = async () => {
    setState("Saving…");
    try {
      await api(`/admin/requests/${request.id}`, {
        method: "PUT",
        body: { status, adminNote: note, version: request.version },
      });
      setState("Saved");
      onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : "Could not save");
    }
  };
  return (
    <article className="issue-card">
      <div className="issue-card-head">
        <div>
          <b>{request.subject}</b> · {request.type}
          <small className="block muted">
            {request.studentName ?? request.studentId} · {courseName(request.course)} · {dateLabel(request.createdAt)}
          </small>
        </div>
        <Badge tone={tone(request.status)}>{request.status}</Badge>
      </div>
      <p className="issue-text">{request.description}</p>
      {request.status === "Withdrawn" ? (
        <p className="muted text-xs">The student withdrew this request.</p>
      ) : (
        <div className="issue-edit">
          <label className="field">
            Status
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              {REQUEST_STATUSES.filter(s => s !== "Withdrawn").map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Reply to the student
            <textarea
              rows={2}
              maxLength={3000}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What will happen next"
            />
          </label>
          <div className="actions">
            <Button onClick={() => void save()} disabled={!changed || state === "Saving…"}>
              Save and notify
            </Button>
            {state && (
              <span className="muted text-xs" role="status">
                {state}
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function AdminRequests() {
  const { mode } = usePreview();
  const [filters, setFilters] = useState<Filters>({ status: "", type: "", course: "", page: 1, limit: 10 }),
    [reload, setReload] = useState(0);
  const { data, error } = useRequests(filters, reload);
  const refresh = useCallback(() => setReload(n => n + 1), []);
  return (
    <ContentContainer>
      <PageHeader
        title="Student requests"
        description="Portal problems, improvement ideas and feature requests from students."
        actions={data ? <Badge tone={data.open ? "amber" : "green"}>{data.open} awaiting action</Badge> : undefined}
      />
      {mode === "demo" && <Notice>Requests are available in the connected portal.</Notice>}
      <Card>
        <Filters filters={filters} set={setFilters} admin />
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : !data ? (
          <p role="status" className="muted">
            Loading requests…
          </p>
        ) : !data.rows.length ? (
          <EmptyState title="No requests" description="Nothing matches these filters." />
        ) : (
          <div className="stack">
            {data.rows.map(r => (
              <AdminRequestRow key={`${r.id}-${r.version}`} request={r} onSaved={refresh} />
            ))}
          </div>
        )}
        {data && (
          <Pagination
            page={data.page}
            pages={Math.max(1, Math.ceil(data.count / filters.limit))}
            setPage={page => setFilters({ ...filters, page })}
            count={data.count}
          />
        )}
      </Card>
    </ContentContainer>
  );
}
