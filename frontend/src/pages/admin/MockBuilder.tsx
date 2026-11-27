import { Pagination } from "../../components/Pagination";

import { ConversionEditor } from "../../components/ConversionEditor";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { BuilderDraft, Question } from "../../types/domain";
import {
  QUESTION_PAGE_SIZE,
  useQuestionDetails,
  useQuestionSearch,
  type QuestionSearch,
} from "../../utils/useQuestionSearch";
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
import { courseName } from "../../utils/format";
import {
  bySection,
  conversionNames,
  emptyBuilder,
  maxMinutes,
  required,
  skills,
  structure,
  testName,
  type OnlineSkill,
} from "../../utils/mockBuilder";
export function MockBuilder() {
  const { courseId, testId } = useParams();
  const { tests, updateTest, mode, pending } = usePreview();
  const test = tests.find(t => t.course === courseId && t.id === testId);
  const [skill, setSkill] = useState<OnlineSkill>("Listening");
  const [draft, setDraft] = useState<BuilderDraft>(() => structuredClone(test?.builder ?? emptyBuilder()));
  const [filters, setFilters] = useState<Omit<QuestionSearch, "skill" | "course">>({
    search: "",
    section: "",
    questionType: "",
    status: "published",
    page: 1,
  });
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const results = useQuestionSearch({ skill, course: test?.course ?? "GENERAL", ...filters });
  const allSelected = skills.flatMap(s => draft.questionIds[s]);
  const { known } = useQuestionDetails(allSelected);
  const dirty = !!test && structure(draft) !== structure(test.builder ?? emptyBuilder());
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Other tests that already use each question, so reuse is a visible choice.
  const usage = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of tests) {
      if (t.course === courseId && t.id === testId) continue;
      for (const id of Object.values(t.builder?.questionIds ?? {}).flat())
        map.set(id, [...(map.get(id) ?? []), `${testName(t)} ${courseName(t.course)}`]);
    }
    return map;
  }, [tests, courseId, testId]);
  if (!test)
    return (
      <ContentContainer>
        <EmptyState
          title="Mock test not found"
          action={<LinkButton to="/admin/mock-tests">Back to mocks</LinkButton>}
        />
      </ContentContainer>
    );
  // FLT Speaking is assessed offline, so FLTs have no Speaking section here.
  const sections = test.kind === "FLT" ? skills.filter(s => s !== "Speaking") : skills;
  const info = (id: string): Question | undefined => results.rows.find(q => q.id === id) ?? known[id];
  const selected = draft.questionIds[skill];
  const remaining = required[skill] - selected.length;
  const total = sections.reduce((sum, s) => sum + draft.duration[s], 0);
  const blocked = (q: Question) =>
    q.practiceEligible
      ? "In module practice"
      : q.archived
        ? "Archived"
        : skill === "Writing" && selected.some(id => id !== q.id && info(id)?.section === q.section)
          ? `${q.section} already selected`
          : "";
  const addable = results.rows.filter(q => !selected.includes(q.id) && !blocked(q));
  function setSelected(next: string[]) {
    setDraft(prev => ({ ...prev, questionIds: { ...prev.questionIds, [skill]: next } }));
    setMessage("");
  }
  function toggle(q: Question) {
    if (selected.includes(q.id)) setSelected(selected.filter(id => id !== q.id));
    else if (remaining > 0 && !blocked(q)) setSelected([...selected, q.id]);
  }
  function addShown() {
    const next = [...selected];
    for (const q of addable) {
      if (next.length >= required[skill]) break;
      if (skill === "Writing" && next.some(id => info(id)?.section === q.section)) continue;
      next.push(q.id);
    }
    setSelected(next);
  }
  function moveTo(from: number, to: number) {
    const next = [...selected];
    const [id] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id!);
    setSelected(next);
  }
  function setFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }
  const selectedInfo = allSelected.map(info);
  const loaded = selectedInfo.every(Boolean);
  const writingSections = draft.questionIds.Writing.map(id => info(id)?.section);
  const checks = [
    { label: "Listening has 40 questions", ok: draft.questionIds.Listening.length === 40 },
    { label: "Reading has 40 questions", ok: draft.questionIds.Reading.length === 40 },
    {
      label: "Writing has Task 1 and Task 2",
      ok: writingSections.includes("Task 1") && writingSections.includes("Task 2"),
    },
    { label: "Every question is published", ok: loaded && selectedInfo.every(q => q!.published && !q!.archived) },
    { label: "No question is in module practice", ok: loaded && selectedInfo.every(q => !q!.practiceEligible) },
    ...(mode === "live"
      ? [
          {
            label: "Band conversion tables reach raw score 0",
            ok: conversionNames.every(n => test.conversions?.[n]?.at(-1)?.[0] === 0),
          },
        ]
      : []),
  ];
  const ready = checks.every(c => c.ok);
  async function save(published = test!.published) {
    const saved = await updateTest({ ...test!, builder: draft, duration: total, published });
    if (saved !== false)
      setMessage(
        mode === "demo"
          ? "Applied to this preview. Changes reset on reload."
          : published !== test!.published
            ? "Structure and publication saved."
            : "Test structure saved.",
      );
  }
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Mock tests / Builder"
        title={`${test.kind === "FLT" ? "Full Length Test" : "Practice Mock Test"} ${String(test.number).padStart(2, "0")} builder`}
        description={courseName(test.course)}
        actions={
          <>
            <Badge tone={test.published ? "green" : "amber"}>{test.published ? "Published" : "Draft"}</Badge>
            {dirty && <Badge tone="amber">Unsaved changes</Badge>}
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Preview test
            </Button>
          </>
        }
      />
      <Notice>
        {test.kind === "FLT"
          ? "FLT Speaking is assessed offline, so this test has Listening, Reading and Writing only."
          : "Speaking is optional: add up to 12 Speaking questions and give the section a time. It opens after Writing."}{" "}
        Questions in module practice cannot be used in tests because practice shows answer keys.
      </Notice>
      <div className="builder-progress" role="group" aria-label="Builder sections">
        {sections.map(s => {
          const count = draft.questionIds[s].length;
          return (
            <button
              type="button"
              key={s}
              className={`builder-progress-item ${s === skill ? "active" : ""}`}
              aria-pressed={s === skill}
              onClick={() => {
                setSkill(s as OnlineSkill);
                setFilters(prev => ({ ...prev, section: "", questionType: "", page: 1 }));
              }}
            >
              <span>{s}</span>
              <strong>
                {count}/{required[s as OnlineSkill]}
                {count === required[s as OnlineSkill] && <Icon name="check" size={14} />}
              </strong>
            </button>
          );
        })}
      </div>
      <div className="two-column">
        <div className="stack">
          <Card>
            <SectionTitle
              title={`Add ${skill} questions`}
              detail={
                <Badge tone={remaining ? "blue" : "green"}>{remaining ? `${remaining} to add` : "Section full"}</Badge>
              }
            />
            <div className="builder-filters">
              <label className="field">
                Search
                <input
                  type="search"
                  placeholder="ID, title or prompt"
                  value={filters.search}
                  onChange={e => setFilter("search", e.target.value)}
                />
              </label>
              <label className="field">
                Part / section
                <select value={filters.section} onChange={e => setFilter("section", e.target.value)}>
                  <option value="">All</option>
                  {results.sections.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Question type
                <select value={filters.questionType} onChange={e => setFilter("questionType", e.target.value)}>
                  <option value="">All</option>
                  {results.questionTypes.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Status
                <select
                  value={filters.status}
                  onChange={e => setFilter("status", e.target.value as "published" | "all")}
                >
                  <option value="published">Published</option>
                  <option value="all">All, incl. drafts</option>
                </select>
              </label>
            </div>
            <div className="actions justify-between mt-4">
              <span className="muted text-xs" role="status">
                {results.loading ? "Searching..." : `${results.count} matching questions`}
              </span>
              <Button variant="secondary" disabled={!remaining || !addable.length} onClick={addShown}>
                <Icon name="plus" size={16} />
                Add {Math.min(addable.length, remaining)} shown
              </Button>
            </div>
            {results.error && (
              <p role="alert" className="error-text mt-4">
                {results.error}
              </p>
            )}
            <div className="builder-results">
              {results.rows.map(q => {
                const position = selected.indexOf(q.id);
                const reason = blocked(q);
                const used = usage.get(q.id);
                return (
                  <label className="answer-option builder-result" key={q.id}>
                    <input
                      type="checkbox"
                      checked={position >= 0}
                      disabled={position < 0 && (!remaining || !!reason)}
                      onChange={() => toggle(q)}
                    />
                    <span className="builder-result-body">
                      <strong>{q.title}</strong>
                      <span className="muted text-xs">
                        {[q.id, q.section, q.questionType].filter(Boolean).join(" · ")}
                      </span>
                      <span className="muted text-xs builder-prompt">{q.prompt}</span>
                      <span className="row">
                        {position >= 0 && <Badge tone="green">#{position + 1}</Badge>}
                        {!q.published && <Badge tone="gray">Draft</Badge>}
                        {reason && <Badge tone="red">{reason}</Badge>}
                        {used && (
                          <Badge tone="amber">
                            Also in {used.slice(0, 2).join(", ")}
                            {used.length > 2 ? ` +${used.length - 2}` : ""}
                          </Badge>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
              {!results.loading && !results.rows.length && (
                <EmptyState
                  compact
                  title="No matching questions"
                  description="Adjust the filters or add questions in the Question Bank."
                />
              )}
            </div>
            {results.count > QUESTION_PAGE_SIZE && (
              <Pagination
                page={filters.page}
                pages={Math.ceil(results.count / QUESTION_PAGE_SIZE)}
                setPage={page => setFilters(prev => ({ ...prev, page }))}
                count={results.count}
              />
            )}
          </Card>
          <Card>
            <SectionTitle
              title={`${skill} order`}
              detail={
                <div className="actions">
                  <Button
                    variant="secondary"
                    disabled={selected.length < 2}
                    onClick={() =>
                      setSelected([...selected].sort((a, b) => bySection(info(a)?.section, info(b)?.section)))
                    }
                  >
                    Sort by part
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!selected.length}
                    onClick={() => {
                      if (window.confirm(`Remove all ${skill} questions from this test?`)) setSelected([]);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              }
            />
            <ol className="stack builder-order">
              {selected.map((id, i) => {
                const q = info(id);
                const name = q?.title ?? id;
                const commit = (input: HTMLInputElement) => {
                  const to = Number(input.value);
                  if (Number.isInteger(to) && to >= 1 && to <= selected.length && to !== i + 1) moveTo(i, to - 1);
                  else input.value = String(i + 1);
                };
                return (
                  <li className="builder-question" key={id}>
                    <input
                      key={`${id}-${i}`}
                      className="control builder-position"
                      type="number"
                      min={1}
                      max={selected.length}
                      defaultValue={i + 1}
                      aria-label={`Position of ${name}`}
                      onBlur={e => commit(e.currentTarget)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commit(e.currentTarget);
                      }}
                    />
                    <span className="builder-question-title">
                      <strong className="text-sm">{name}</strong>
                      <small className="muted">
                        {q ? [q.section, q.questionType].filter(Boolean).join(" · ") : id}
                      </small>
                    </span>
                    <div className="actions">
                      <button
                        className="icon-button"
                        aria-label={`Move ${name} up`}
                        disabled={i === 0}
                        onClick={() => moveTo(i, i - 1)}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move ${name} down`}
                        disabled={i === selected.length - 1}
                        onClick={() => moveTo(i, i + 1)}
                      >
                        ↓
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${name}`}
                        onClick={() => setSelected(selected.filter(x => x !== id))}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!selected.length && <p className="muted text-sm">Add questions above to build this section.</p>}
          </Card>
        </div>
        <Card>
          <SectionTitle title="Test overview" />
          <label className="field">
            {skill} duration (minutes, up to {maxMinutes[skill]})
            <input
              type="number"
              min={skill === "Speaking" ? 0 : 1}
              max={maxMinutes[skill]}
              value={draft.duration[skill]}
              onChange={e =>
                setDraft(prev => ({
                  ...prev,
                  duration: {
                    ...prev.duration,
                    [skill]: Math.max(
                      skill === "Speaking" ? 0 : 1,
                      Math.min(maxMinutes[skill], Number(e.target.value) || 0),
                    ),
                  },
                }))
              }
            />
          </label>
          <div className="list-row">
            <span>Total duration</span>
            <strong>{total} min</strong>
          </div>
          <div className="list-row">
            <span>Selected questions</span>
            <strong>{allSelected.length} / 82</strong>
          </div>
          <h3 className="mt-5">Ready to publish</h3>
          <ul className="readiness" aria-label="Publication checklist">
            {checks.map(c => (
              <li key={c.label} className={c.ok ? "ok" : "missing"}>
                <Icon name={c.ok ? "check" : "close"} size={16} />
                <span>{c.label}</span>
                <span className="sr-only">{c.ok ? "complete" : "incomplete"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Button disabled={pending} onClick={() => void save()}>
              <Icon name="check" size={16} />
              Save structure
            </Button>
          </div>
          <label className="field mt-5">
            Publication
            <select
              value={test.published ? "published" : "draft"}
              disabled={pending}
              onChange={e => void save(e.target.value === "published")}
            >
              <option value="draft">Draft</option>
              <option value="published" disabled={!ready && !test.published}>
                Published{!ready && !test.published ? " (complete the checklist)" : ""}
              </option>
            </select>
          </label>
          <p className="muted text-xs mt-4">
            Changing publication also saves the structure. Availability is managed for the whole course in Test
            Management.
          </p>
          {message && (
            <p role="status" className="text-xs mt-4">
              {message}
            </p>
          )}
        </Card>
      </div>
      {mode === "live" && <ConversionEditor key={`${test.id}-${test.version}`} test={test} />}
      <Link
        className="btn btn-secondary"
        to="/admin/mock-tests"
        onClick={e => {
          if (dirty && !window.confirm("Leave the builder? Unsaved structure changes will be lost."))
            e.preventDefault();
        }}
      >
        Back to mock management
      </Link>
      {preview && (
        <Modal title="Test structure preview" onClose={() => setPreview(false)}>
          <div className="stack">
            {sections.map(s => (
              <section key={s}>
                <h3>
                  {s} · {draft.duration[s]} min
                </h3>
                <ol className="list-decimal pl-5 mt-3 text-sm muted">
                  {draft.questionIds[s].map(id => (
                    <li key={id}>{info(id)?.title || id}</li>
                  ))}
                </ol>
                {!draft.questionIds[s].length && <p className="muted text-xs">No questions selected</p>}
              </section>
            ))}
            <Notice>
              {dirty ? "Includes unsaved changes. Save the structure to apply them." : "Matches the saved structure."}
            </Notice>
          </div>
        </Modal>
      )}
    </ContentContainer>
  );
}
