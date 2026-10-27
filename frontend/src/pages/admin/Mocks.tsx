import { ConversionEditor } from "../../components/ConversionEditor";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { BuilderDraft, Course, Skill } from "../../types/domain";
const skills: Skill[] = ["Listening", "Reading", "Writing"];
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
  Tabs,
  Toggle,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { courseName } from "../../utils/format";
export function AdminMocks() {
  const { tests, updateTest, mode, pending } = usePreview();
  const [course, setCourse] = useState<Course>("GENERAL");
  const [changed, setChanged] = useState(false);
  const [create,setCreate]=useState(false);
  const [number,setNumber]=useState(1);
  const [kind, setKind] = useState("Full Length Tests");
  const catalog = tests.filter((t) => t.course === course && t.kind === (kind === "Full Length Tests" ? "FLT" : "PRACTICE_MOCK"));
  return (
    <ContentContainer>
      <PageHeader
        title="Test management"
        description="Manage publication and availability independently for each course."
        actions={<><Badge>80 FLTs / 2 courses</Badge>{mode === "live" && <Button onClick={() => setCreate(true)}>Add Practice Mock Test</Button>}</>}
      />
      <Tabs
        options={["GENERAL", "ACADEMIC"]}
        value={course}
        onChange={setCourse}
        label="Mock course"
      />
      <Tabs options={["Full Length Tests", "Practice Mock Tests"]} value={kind} onChange={setKind} label="Test type" />
      <Notice>{kind === "Full Length Tests" ? "Availability affects all active students in this course. One attempt per FLT." : "Published Practice Mock Tests are always available. Two attempts per test. Add drafts as needed; the final catalog count can be confirmed later."} {mode === "demo" ? "Changes reset on reload." : "Changes are saved on the server."}</Notice>
      {changed && (
        <p className="sr-status" role="status">
          {mode === "demo" ? "Course-level preview updated." : "Test settings updated."}
        </p>
      )}
      {create && <Modal title="Create Practice Mock Test" onClose={() => setCreate(false)}><form className="stack" onSubmit={async e => {e.preventDefault();const saved=await updateTest({id:`practice-mock-${String(number).padStart(2,"0")}`,course,kind:"PRACTICE_MOCK",number,published:false,available:false,duration:150,version:1,builder:{questionIds:{Listening:[],Reading:[],Writing:[],Speaking:[]},duration:{Listening:30,Reading:60,Writing:60,Speaking:0}}});if(saved!==false)setCreate(false);}}><Notice>Creates a draft in {course}. Practice Mocks allow two attempts and need no availability unlock.</Notice><label className="field">Test number<input required type="number" min={1} value={number} onChange={e=>setNumber(Number(e.target.value))}/></label><Button type="submit" disabled={pending}>Create draft</Button></form></Modal>}
      <Card>
        <SectionTitle title={`${courseName(course)} / ${catalog.length} ${kind}`} />
        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Mock test</th>
                <th>Publication</th>
                <th>Available to whole course</th>
                <th>Attempts / completed</th>
                <th>Builder</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>
                      {t.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} {String(t.number).padStart(2, "0")}
                    </strong>
                    <small>Listening / Reading / Writing</small>
                  </td>
                  <td>
                    <label className="field">
                      <span className="sr-only">
                        Publication for Mock {t.number}
                      </span>
                      <select
                        aria-label={`Publication for Mock ${t.number}`}
                        value={t.published ? "published" : "draft"}
                        onChange={async (e) => {
                          const saved=await updateTest({
                            ...t,
                            published: e.target.value === "published",
                          });
                          if(saved!==false)setChanged(true);
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </label>
                  </td>
                  <td>
                    <div className="row">
                      {t.kind === "FLT" ? <><Toggle
                        label={`Availability for ${course} Mock ${t.number}`}
                        checked={t.available}
                        onChange={async (value) => {
                          const saved=await updateTest({ ...t, available: value });
                          if(saved!==false)setChanged(true);
                        }}
                      />
                      <span>{t.available ? "ON" : "OFF"}</span></> : <Badge tone="green">Automatic when published</Badge>}
                      {t.available && !t.published && (
                        <Badge tone="amber">Draft remains locked</Badge>
                      )}
                    </div>
                  </td>
                  <td>{t.attempts??0} / {t.completed??0}</td>
                  <td>
                    <Link
                      className="table-link"
                      to={`/admin/mock-tests/${course}/${t.id}/builder`}
                    >
                      Open builder
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-cards">
          {catalog.map((t) => (
            <div className="mobile-record" key={t.id}>
              <div className="row between">
                <h3>{t.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} {String(t.number).padStart(2, "0")}</h3>
                <Badge tone={t.published ? "green" : "gray"}>
                  {t.published ? "Published" : "Draft"}
                </Badge>
              </div>
              <label className="field">
                Publication
                <select
                  aria-label={`Mobile publication for Mock ${t.number}`}
                  value={t.published ? "published" : "draft"}
                  onChange={async (e) => {
                    const saved=await updateTest({
                      ...t,
                      published: e.target.value === "published",
                    });
                    if(saved!==false)setChanged(true);
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              {t.kind === "FLT" && <div className="row between">
                <span className="text-xs">Whole-course availability</span>
                <Toggle
                  label={`Mobile availability for ${course} Mock ${t.number}`}
                  checked={t.available}
                  onChange={async (value) => {
                    const saved=await updateTest({ ...t, available: value });
                    if(saved!==false)setChanged(true);
                  }}
                />
              </div>
              }
              {!t.published && t.available && (
                <Badge tone="amber">Draft remains locked</Badge>
              )}
              <Link
                className="table-link"
                to={`/admin/mock-tests/${course}/${t.id}/builder`}
              >
                Open builder →
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </ContentContainer>
  );
}
export function MockBuilder() {
  const { courseId, testId } = useParams();
  const { tests, questions, updateTest, mode } = usePreview();
  const test = tests.find((t) => t.course === courseId && t.id === testId);
  const [skill, setSkill] = useState<Skill>("Writing");
  const [draft, setDraft] = useState<BuilderDraft>(test?.builder ?? {
    questionIds: {
      Listening: ["L01"],
      Reading: courseId === "GENERAL" ? ["R01"] : ["R03"],
      Writing: courseId === "GENERAL" ? ["W01", "W03"] : ["W02", "W03"],
      Speaking: [],
    },
    duration: { Listening: 30, Reading: 60, Writing: 60, Speaking: 0 },
  });
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  if (!test)
    return (
      <ContentContainer>
        <EmptyState
          title="Mock test not found"
          action={<LinkButton to="/admin/mock-tests">Back to mocks</LinkButton>}
        />
      </ContentContainer>
    );
  const eligible = questions.filter(
    (q) =>
      q.skill === skill && q.published && (q.course === "BOTH" || q.course === test.course),
  );
  const selected = draft.questionIds[skill];
  function toggle(id: string) {
    setDraft((prev) => ({
      ...prev,
      questionIds: {
        ...prev.questionIds,
        [skill]: selected.includes(id)
          ? selected.filter((q) => q !== id)
          : [...selected, id],
      },
    }));
  }
  function move(index: number, direction: number) {
    const next = [...selected];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setDraft((prev) => ({
      ...prev,
      questionIds: { ...prev.questionIds, [skill]: next },
    }));
  }
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Mock tests / Builder"
        title={`${test.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} ${String(test.number).padStart(2, "0")} builder`}
        description={courseName(test.course)}
        actions={
          <>
            <Badge tone={test.published ? "green" : "amber"}>
              {test.published ? "Published" : "Draft"}
            </Badge>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Preview test
            </Button>
          </>
        }
      />
      <Notice>
        {mode === "demo" ? "Builder edits are temporary." : "Save the test structure to apply edits."} Only Listening, Reading and Writing are delivered online. FLT Speaking is assessed offline.
      </Notice>
      <Tabs
        options={skills}
        value={skill}
        onChange={setSkill}
        label="Builder sections"
      />
      <div className="two-column">
        <div className="stack">
          <Card>
            <SectionTitle title={`${skill} question selection`} />
            {eligible.map((q) => (
              <label className="answer-option" key={q.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={() => toggle(q.id)}
                />
                <span>
                  <strong className="block">{q.title}</strong>
                  <span className="muted">{q.prompt}</span>
                </span>
              </label>
            ))}
            {!eligible.length && <EmptyState title="No eligible questions" />}
          </Card>
          <Card>
            <SectionTitle title="Question order" />
            <div className="stack">
              {selected.map((id, i) => (
                <div className="builder-question" key={id}>
                  <span className="text-sm">
                    {i + 1}. {questions.find((q) => q.id === id)?.title || id}
                  </span>
                  <div className="actions">
                    <button
                      className="icon-button"
                      aria-label={`Move ${id} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move ${id} down`}
                      disabled={i === selected.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
              {!selected.length && (
                <p className="muted text-sm">
                  Select questions above to build this section.
                </p>
              )}
            </div>
          </Card>
        </div>
        <Card>
          <SectionTitle title="Test overview" />
          <label className="field">
            {skill} duration (minutes)
            <input
              type="number"
              min={1}
              max={180}
              value={draft.duration[skill]}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  duration: {
                    ...prev.duration,
                    [skill]: Math.max(
                      1,
                      Math.min(180, Number(e.target.value) || 1),
                    ),
                  },
                }))
              }
            />
          </label>
          <div className="list-row">
            <span>Total duration</span>
            <strong>
              {Object.values(draft.duration).reduce((a, b) => a + b, 0)} min
            </strong>
          </div>
          <div className="list-row">
            <span>Selected questions</span>
            <strong>{Object.values(draft.questionIds).flat().length}</strong>
          </div>
          <label className="field mt-5">
            Publication
            <select
              value={test.published ? "published" : "draft"}
              onChange={async (e) => {
                const saved=await updateTest({
                  ...test,builder:draft,duration:Object.values(draft.duration).reduce((a,b)=>a+b,0),
                  published: e.target.value === "published",
                });
                if(saved!==false)setMessage(mode === "demo" ? "Publication changed in preview only." : "Structure and publication saved.");
              }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <p className="muted text-xs mt-4">
            Availability is managed for the whole course in Mock Test
            Management.
          </p>
          <div className="mt-5">
            <Button
              onClick={async () => { if ((await updateTest({ ...test, builder: draft, duration: Object.values(draft.duration).reduce((a, b) => a + b, 0) })) !== false) setMessage(mode === "demo" ? "Draft applied to this preview. Changes reset on reload." : "Test structure saved."); }}
            >
              <Icon name="check" size={16} />
              Apply draft
            </Button>
          </div>
          {message && (
            <p role="status" className="text-xs mt-4">
              {message}
            </p>
          )}
        </Card>
      </div>
      {mode === "live" && <ConversionEditor key={`${test.id}-${test.version}`} test={test} />}
      <LinkButton secondary to="/admin/mock-tests">
        Back to mock management
      </LinkButton>
      {preview && (
        <Modal title="Test structure preview" onClose={() => setPreview(false)}>
          <div className="stack">
            {skills.map((s) => (
              <section key={s}>
                <h3>
                  {s} · {draft.duration[s]} min
                </h3>
                <ol className="list-decimal pl-5 mt-3 text-sm muted">
                  {draft.questionIds[s].map((id) => (
                    <li key={id}>
                      {questions.find((q) => q.id === id)?.title || id}
                    </li>
                  ))}
                </ol>
                {!draft.questionIds[s].length && (
                  <p className="muted text-xs">No questions selected</p>
                )}
              </section>
            ))}
            <Notice>Unsaved structure preview. Saving applies these changes to the test.</Notice>
          </div>
        </Modal>
      )}
    </ContentContainer>
  );
}
