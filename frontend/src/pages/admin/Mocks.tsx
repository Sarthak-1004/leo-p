import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../utils/usePagination";

import { useState } from "react";
import { Link } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { Course } from "../../types/domain";
import {
  Badge,
  Button,
  Card,
  ContentContainer,
  Modal,
  Notice,
  PageHeader,
  SectionTitle,
  Tabs,
  Toggle,
} from "../../components/ui";

import { courseName } from "../../utils/format";
export function AdminMocks() {
  const { tests, updateTest, mode, pending } = usePreview();
  const [course, setCourse] = useState<Course>("GENERAL");
  const [changed, setChanged] = useState(false);
  const [create, setCreate] = useState(false);
  const [number, setNumber] = useState(1);
  const [kind, setKind] = useState("Full Length Tests");
  const catalog = tests.filter(
    t => t.course === course && t.kind === (kind === "Full Length Tests" ? "FLT" : "PRACTICE_MOCK"),
  );
  const pagination = usePagination(catalog, 10);
  return (
    <ContentContainer>
      <PageHeader
        title="Test management"
        description="Manage publication and availability independently for each course."
        actions={
          <>
            <Badge>80 FLTs / 2 courses</Badge>
            {mode === "live" && <Button onClick={() => setCreate(true)}>Add Practice Mock Test</Button>}
          </>
        }
      />
      <Tabs
        options={["GENERAL", "ACADEMIC"]}
        value={course}
        onChange={value => {
          setCourse(value);
          pagination.setPage(1);
        }}
        label="Mock course"
      />
      <Tabs
        options={["Full Length Tests", "Practice Mock Tests"]}
        value={kind}
        onChange={value => {
          setKind(value);
          pagination.setPage(1);
        }}
        label="Test type"
      />
      <Notice>
        {kind === "Full Length Tests"
          ? "Availability affects all active students in this course. One attempt per FLT."
          : "Published Practice Mock Tests are always available. Two attempts per test. Add drafts as needed; the final catalog count can be confirmed later."}{" "}
        {mode === "demo" ? "Changes reset on reload." : "Changes are saved on the server."}
      </Notice>
      {changed && (
        <p className="sr-status" role="status">
          {mode === "demo" ? "Course-level preview updated." : "Test settings updated."}
        </p>
      )}
      {create && (
        <Modal title="Create Practice Mock Test" onClose={() => setCreate(false)}>
          <form
            className="stack"
            onSubmit={async e => {
              e.preventDefault();
              const saved = await updateTest({
                id: `practice-mock-${String(number).padStart(2, "0")}`,
                course,
                kind: "PRACTICE_MOCK",
                number,
                published: false,
                available: false,
                duration: 150,
                version: 1,
                builder: {
                  questionIds: { Listening: [], Reading: [], Writing: [], Speaking: [] },
                  duration: { Listening: 30, Reading: 60, Writing: 60, Speaking: 0 },
                },
              });
              if (saved !== false) setCreate(false);
            }}
          >
            <Notice>
              Creates a draft in {course}. Practice Mocks allow two attempts and need no availability unlock.
            </Notice>
            <label className="field">
              Test number
              <input required type="number" min={1} value={number} onChange={e => setNumber(Number(e.target.value))} />
            </label>
            <Button type="submit" disabled={pending}>
              Create draft
            </Button>
          </form>
        </Modal>
      )}
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
              {pagination.items.map(t => (
                <tr key={t.id}>
                  <td>
                    <strong>
                      {t.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} {String(t.number).padStart(2, "0")}
                    </strong>
                    <small>Listening / Reading / Writing</small>
                  </td>
                  <td>
                    <label className="field">
                      <span className="sr-only">Publication for Mock {t.number}</span>
                      <select
                        aria-label={`Publication for Mock ${t.number}`}
                        value={t.published ? "published" : "draft"}
                        onChange={async e => {
                          const saved = await updateTest({
                            ...t,
                            published: e.target.value === "published",
                          });
                          if (saved !== false) setChanged(true);
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </label>
                  </td>
                  <td>
                    <div className="row">
                      {t.kind === "FLT" ? (
                        <>
                          <Toggle
                            label={`Availability for ${course} Mock ${t.number}`}
                            checked={t.available}
                            onChange={async value => {
                              const saved = await updateTest({ ...t, available: value });
                              if (saved !== false) setChanged(true);
                            }}
                          />
                          <span>{t.available ? "ON" : "OFF"}</span>
                        </>
                      ) : (
                        <Badge tone="green">Automatic when published</Badge>
                      )}
                      {t.available && !t.published && <Badge tone="amber">Draft remains locked</Badge>}
                    </div>
                  </td>
                  <td>
                    {t.attempts ?? 0} / {t.completed ?? 0}
                  </td>
                  <td>
                    <Link className="table-link" to={`/admin/mock-tests/${course}/${t.id}/builder`}>
                      Open builder
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-cards">
          {pagination.items.map(t => (
            <div className="mobile-record" key={t.id}>
              <div className="row between">
                <h3>
                  {t.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} {String(t.number).padStart(2, "0")}
                </h3>
                <Badge tone={t.published ? "green" : "gray"}>{t.published ? "Published" : "Draft"}</Badge>
              </div>
              <label className="field">
                Publication
                <select
                  aria-label={`Mobile publication for Mock ${t.number}`}
                  value={t.published ? "published" : "draft"}
                  onChange={async e => {
                    const saved = await updateTest({
                      ...t,
                      published: e.target.value === "published",
                    });
                    if (saved !== false) setChanged(true);
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              {t.kind === "FLT" && (
                <div className="row between">
                  <span className="text-xs">Whole-course availability</span>
                  <Toggle
                    label={`Mobile availability for ${course} Mock ${t.number}`}
                    checked={t.available}
                    onChange={async value => {
                      const saved = await updateTest({ ...t, available: value });
                      if (saved !== false) setChanged(true);
                    }}
                  />
                </div>
              )}
              {!t.published && t.available && <Badge tone="amber">Draft remains locked</Badge>}
              <Link className="table-link" to={`/admin/mock-tests/${course}/${t.id}/builder`}>
                Open builder →
              </Link>
            </div>
          ))}
        </div>
      </Card>
      <Pagination {...pagination} />
    </ContentContainer>
  );
}
