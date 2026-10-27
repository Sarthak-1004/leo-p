import {accessStatus} from "../../utils/policy";
import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../utils/usePagination";
import { PasswordReset } from "../../components/PasswordReset";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { Course, Student } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  EmptyState,
  LinkButton,
  Modal,
  Notice,
  PageHeader,
  SectionTitle,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { courseName, dateLabel } from "../../utils/format";
import { ResultRows } from "../student/Results";
function StudentForm({
  student,
  onClose,
}: {
  student?: Student;
  onClose: () => void;
}) {
  const { students, updateStudent, trainers, mode, settings } = usePreview();
  const start=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const expiry=new Date(`${start}T00:00:00Z`);expiry.setUTCDate(expiry.getUTCDate()+(settings.defaultAccessDays??180)-1);
  const [draft, setDraft] = useState<Student>(
    student ?? {
      id: "",
      name: "",
      course: "GENERAL",
      startDate: start,
      expiryDate: expiry.toISOString().slice(0,10),
      enabled: true,
    },
  );
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  function change<K extends keyof Student>(key: K, value: Student[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  return (
    <Modal
      title={student ? "Edit student" : "Create student"}
      onClose={onClose}
    >
      {done ? (
        <div className="stack">
          <Notice>
            Student {student ? "updated" : "added"}{mode === "demo" ? " in this preview only." : "."}
          </Notice>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (draft.expiryDate < draft.startDate) {
              setError("Expiry must be on or after the start date.");
              return;
            }
            if (!student && students.some((s) => s.id === draft.id.trim())) {
              setError("This Student ID already exists.");
              return;
            }
            if (!draft.name.trim() || !draft.id.trim()) {
              setError("Enter a name and Student ID.");
              return;
            }
            const saved = await updateStudent({
              ...draft,
              id: draft.id.trim(),
              name: draft.name.trim(),
            });
            if (saved === false) return;
            setDone(true);
          }}
        >
          <Notice>
            {mode === "demo" ? "Changes affect the preview only and reset on reload." : "Account access and credentials are controlled by Admin."}
          </Notice>
          {mode === "live" && !student && <label className="field">Initial password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={draft.password ?? ""} onChange={e => change("password", e.target.value)} /></label>}
          {mode === "live" && <div className="form-grid">{(["phone","email","address","guardianContact"] as const).map(key => <label className="field" key={key}>{({phone:"Phone",email:"Contact email",address:"Postal address",guardianContact:"Guardian contact"})[key]}<input value={draft.contacts?.[key] ?? ""} onChange={e => change("contacts", {phone:"",email:"",address:"",guardianContact:"",...draft.contacts,[key]:e.target.value})} /></label>)}</div>}
          <div className="form-grid">
            <label className="field">
              Student ID
              <input
                required
                value={draft.id}
                readOnly={Boolean(student)}
                onChange={(e) => change("id", e.target.value)}
              />
            </label>
            <label className="field">
              Name
              <input
                required
                value={draft.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label className="field">
              Assigned course
              <select
                value={draft.course}
                onChange={(e) => change("course", e.target.value as Course)}
              >
                <option value="GENERAL">IELTS General</option>
                <option value="ACADEMIC">IELTS Academic</option>
              </select>
            </label>
            <label className="field">Assigned trainer<select value={draft.trainerId ?? ""} onChange={e => change("trainerId", e.target.value || undefined)}><option value="">Unassigned</option>{trainers.filter(t => t.enabled).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="field">
              Status
              <select
                value={draft.enabled ? "active" : "disabled"}
                onChange={(e) => change("enabled", e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label className="field">
              Start date
              <input
                type="date"
                required
                value={draft.startDate}
                onChange={(e) => change("startDate", e.target.value)}
              />
            </label>
            <label className="field">
              Expiry date
              <input
                type="date"
                required
                min={draft.startDate}
                value={draft.expiryDate}
                onChange={(e) => change("expiryDate", e.target.value)}
              />
            </label>
          </div>
          {mode === "live" && student && <label className="row text-sm"><input type="checkbox" checked={draft.movePending??false} onChange={e=>change("movePending",e.target.checked)}/>Move pending evaluations to the selected trainer</label>}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <Button type="submit">{mode === "demo" ? "Apply to preview" : "Save student"}</Button>
        </form>
      )}
    </Modal>
  );
}
export function Students() {
  const { students } = usePreview();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("ALL");
  const [status,setStatus]=useState("All");const [order,setOrder]=useState("Name");
  const [create, setCreate] = useState(false);
  const filtered = students.filter(
    (s) =>
      `${s.name} ${s.id}`.toLowerCase().includes(search.toLowerCase()) &&
      (course === "ALL" || s.course === course) && (status === "All" || accessStatus(s)===status),
  ).sort((a,b)=>order==="Expiry"?a.expiryDate.localeCompare(b.expiryDate):a.name.localeCompare(b.name));
  const pagination=usePagination(filtered);
  return (
    <ContentContainer>
      <PageHeader
        title="Student management"
        description="Student details, course assignment and access periods."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Icon name="plus" size={16} />
            Add student
          </Button>
        }
      />
      <Card>
        <div className="actions justify-between mb-6">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label="Search students"
              placeholder="Search name or Student ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="sr-only">Filter student course</span>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="ALL">All courses</option>
              <option value="GENERAL">IELTS General</option>
              <option value="ACADEMIC">IELTS Academic</option>
            </select>
          </label>
        </div>
        <div className="form-grid mb-5"><label className="field">Access status<select aria-label="Access status" value={status} onChange={e=>setStatus(e.target.value)}>{["All","Active","Expired","Disabled","Upcoming"].map(value=><option key={value}>{value}</option>)}</select></label><label className="field">Sort students<select aria-label="Sort students" value={order} onChange={e=>setOrder(e.target.value)}><option>Name</option><option>Expiry</option></select></label></div>
        {filtered.length ? (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Start date</th>
                    <th>Access expiry</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <small>{s.id}</small>
                      </td>
                      <td>
                        <Badge>{courseName(s.course)}</Badge>
                      </td>
                      <td>{dateLabel(s.startDate)}</td>
                      <td>{dateLabel(s.expiryDate)}</td>
                      <td>
                        <Badge tone={s.enabled ? "green" : "gray"}>
                          {accessStatus(s)}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          to={`/admin/students/${s.id}`}
                          className="table-link"
                        >
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {pagination.items.map((s) => (
                <div className="mobile-record" key={s.id}>
                  <div className="row between">
                    <h3>{s.name}</h3>
                    <Badge tone={s.enabled ? "green" : "gray"}>
                      {accessStatus(s)}
                    </Badge>
                  </div>
                  <p className="muted text-xs">
                    {s.id} · {courseName(s.course)}
                  </p>
                  <p className="text-xs">Expires {dateLabel(s.expiryDate)}</p>
                  <Link to={`/admin/students/${s.id}`} className="table-link">
                    View details →
                  </Link>
                </div>
              ))}
            </div>
            <p className="muted text-xs mt-5">
              Showing {filtered.length} sample students
            </p>
          </>
        ) : (
          <EmptyState title="No matching students" />
        )}
      </Card>
      <Pagination {...pagination} />
      {create && <StudentForm onClose={() => setCreate(false)} />}
    </ContentContainer>
  );
}
export function StudentDetails() {
  const { studentId } = useParams();
  const { students, results } = usePreview();
  const student = students.find((s) => s.id === studentId);
  const [edit, setEdit] = useState(false);
  const [reset, setReset] = useState(false);
  if (!student)
    return (
      <ContentContainer>
        <EmptyState
          title="Student not found"
          action={
            <LinkButton to="/admin/students">Back to students</LinkButton>
          }
        />
      </ContentContainer>
    );
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Student directory / Details"
        title={student.name}
        description={student.id}
        actions={
          <>
            <Button variant="ghost" onClick={() => setReset(true)}>
              Reset password
            </Button>
            <Button onClick={() => setEdit(true)}>Edit student</Button>
          </>
        }
      />
      <div className="two-column">
        <Card>
          <SectionTitle
            title="Account information"
            detail={
              <Badge tone={student.enabled ? "green" : "gray"}>
                {student.enabled ? "Active" : "Disabled"}
              </Badge>
            }
          />
          {[
            ["Student ID", student.id],
            ["Course", courseName(student.course)],
            ["Start date", dateLabel(student.startDate)],
            ["Expiry date", dateLabel(student.expiryDate)],
          ].map(([label, value]) => (
            <div className="list-row" key={label}>
              <span className="muted text-xs">{label}</span>
              <strong className="text-sm">{value}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle title="Course assignment" />
          <div className="course-card">
            <Badge>Assigned course</Badge>
            <h2 className="mt-3">{courseName(student.course)}</h2>
            <p className="muted text-sm mt-3">
              Each student belongs to one course.
            </p>
            <div className="mt-5">
              <Button variant="secondary" onClick={() => setEdit(true)}>
                Change assignment
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Progress & results preview" />
        {results.some((r) => r.studentId === student.id) ? (
          <ResultRows
            results={results.filter((r) => r.studentId === student.id)}
            admin
          />
        ) : (
          <EmptyState
            title="No sample results"
            description="There are no result fixtures for this student."
          />
        )}
      </Card>
      <LinkButton secondary to="/admin/students">
        Back to students
      </LinkButton>
      {edit && <StudentForm student={student} onClose={() => setEdit(false)} />}
      {reset && <PasswordReset id={student.id} onClose={() => setReset(false)} />}
    </ContentContainer>
  );
}
