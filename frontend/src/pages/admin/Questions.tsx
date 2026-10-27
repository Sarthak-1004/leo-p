import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../utils/usePagination";
import { AssetUpload } from "../../components/AssetUpload";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import type { Question, Skill } from "../../types/domain";
import { skills } from "../../mocks/practice";
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
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import {skillIcon} from "../../components/iconNames";
export function QuestionBank() {
  const { questions, updateQuestion } = usePreview();
  const [skill, setSkill] = useState("All");
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("ALL");
  const [preview, setPreview] = useState<Question | null>(null);
  const [questionType, setQuestionType] = useState("All");
  const [status,setStatus]=useState("All");const [order,setOrder]=useState("Title");
  const [section, setSection] = useState("All");
  const filtered = questions.filter(
    (q) =>
      (status === "All" || status === "Archived" && q.archived || status === "Published" && q.published && !q.archived || status === "Draft" && !q.published && !q.archived) && (skill === "All" || q.skill === skill) &&
      (questionType === "All" || q.questionType === questionType) &&
      (section === "All" || q.section === section) &&
      (course === "ALL" || q.course === "BOTH" || q.course === course) &&
      `${q.title} ${q.prompt}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a,b)=>order==="ID"?a.id.localeCompare(b.id):a.title.localeCompare(b.title));
  const pagination=usePagination(filtered);
  return (
    <ContentContainer>
      <PageHeader
        title="Question bank & item repository"
        description="Prompts, passages and practice questions across all four skills."
        actions={
          <LinkButton to="/admin/questions/new">
            <Icon name="plus" size={16} />
            Create question
          </LinkButton>
        }
      />
      <Tabs
        options={["All", ...skills]}
        value={skill}
        onChange={setSkill}
        label="Question skill"
      />
      <Card>
        <div className="actions justify-between mb-4">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Search questions"
              placeholder="Search question bank…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="sr-only">Question course filter</span>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="ALL">All course eligibility</option>
              <option value="GENERAL">General eligible</option>
              <option value="ACADEMIC">Academic eligible</option>
            </select>
          </label>
        </div>
        <div className="form-grid mb-5"><label className="field">Question status<select aria-label="Question status" value={status} onChange={e=>setStatus(e.target.value)}>{["All","Published","Draft","Archived"].map(value=><option key={value}>{value}</option>)}</select></label><label className="field">Sort questions<select aria-label="Sort questions" value={order} onChange={e=>setOrder(e.target.value)}><option>Title</option><option>ID</option></select></label><label className="field">Question type<select value={questionType} onChange={e => setQuestionType(e.target.value)}><option>All</option>{[...new Set(questions.map(q => q.questionType).filter(Boolean))].map(t => <option key={t}>{t}</option>)}</select></label><label className="field">Section<select value={section} onChange={e => setSection(e.target.value)}><option>All</option>{[...new Set(questions.map(q => q.section).filter(Boolean))].map(t => <option key={t}>{t}</option>)}</select></label></div>
        {pagination.items.map((q) => (
          <div className="list-row" key={q.id}>
            <div className="row">
              <span className="icon-tile">
                <Icon name={skillIcon[q.skill]} />
              </span>
              <div>
                <div className="actions mb-2">
                  <Badge>{q.skill === "Speaking" ? "Speaking ? Offline only" : q.skill}</Badge>
                  <Badge tone="gray">
                    {q.course === "BOTH" ? "General & Academic" : q.course}
                  </Badge>
                  <Badge tone={q.published ? "green" : "amber"}>
                    {q.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <h3>{q.title}</h3>
                <p className="muted text-xs mt-1">
                  {q.id} · {q.prompt}
                </p>
              </div>
            </div>
            <div className="actions">
              <Button variant="ghost" onClick={() => setPreview(q)}>
                Preview
              </Button>
              <Link
                to={`/admin/questions/${q.id}/edit`}
                className="table-link text-xs"
              >
                Edit
              </Link>
              <Button
                variant="ghost"
                onClick={() =>
                  updateQuestion({
                    ...q,
                    id: `${q.skill[0]}-${crypto.randomUUID().slice(0, 8)}`,
                    title: `${q.title} (copy)`,
                    published: false,
                  })
                }
              >
                Duplicate
              </Button>
              <Button variant="ghost" onClick={() => updateQuestion({...q,published:!q.published})}>{q.published ? "Unpublish" : "Publish"}</Button>
              <Button variant="ghost" onClick={() => updateQuestion({...q,archived:!q.archived,published:false})}>{q.archived ? "Restore" : "Archive"}</Button>
            </div>
          </div>
        ))}
        <Pagination {...pagination} />
        {!filtered.length && <EmptyState title="No matching questions" />}
      </Card>
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          <div className="stack">
            <Badge>{preview.skill}</Badge>
            <p>{preview.prompt}</p>
            {preview.options.map((option) => (
              <div key={option} className="answer-option">
                {option}
              </div>
            ))}
            {preview.answer && (
              <p className="muted text-xs">
                Admin reference answer: {Array.isArray(preview.answer)?preview.answer.join(" / "):preview.answer}
              </p>
            )}
            <Notice>Question preview only. No assessment is started.</Notice>
          </div>
        </Modal>
      )}
    </ContentContainer>
  );
}
function QuestionEditorForm({ initial }: { initial: Question }) {
  const { updateQuestion, mode } = usePreview();
  const [draft, setDraft] = useState(initial);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  function set<K extends keyof Question>(key: K, value: Question[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setNotice(false);
  }
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Question bank / Editor"
        title={
          initial.id === "new"
            ? "Create new question / stimulus"
            : "Edit question / stimulus"
        }
        actions={
          <Badge tone={draft.published ? "green" : "amber"}>
            {draft.published ? "Published" : "Draft"}
          </Badge>
        }
      />
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.title.trim() || !draft.prompt.trim() || !draft.questionType?.trim() || !draft.section?.trim()) {
            setError("Enter a title, prompt, question type and section.");
            return;
          }
          const clean = {
            ...draft,
            id:
              draft.id === "new"
                ? `${draft.skill[0]}-${crypto.randomUUID().slice(0, 8)}`
                : draft.id,
            title: draft.title.trim(),
            prompt: draft.prompt.trim(),
            options: draft.options.filter(Boolean),
          };
          const saved = await updateQuestion(clean);
          if (saved === false) return;
          setDraft(typeof saved === "object" ? saved : clean);
          setError("");
          setNotice(true);
        }}
      >
        <div className="two-column">
          <div className="stack">
            <Card>
              <SectionTitle title="1. Module & classification" />
              <Tabs
                options={skills}
                value={draft.skill}
                onChange={(value) => set("skill", value)}
                label="Editor skill"
              />
              <div className="form-grid mt-6">
                <label className="field full-span">
                  Question title
                  <input
                    required
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                </label>
                <label className="field">
                  Course eligibility
                  <select
                    value={draft.course}
                    onChange={(e) =>
                      set("course", e.target.value as Question["course"])
                    }
                  >
                    <option value="BOTH">General & Academic</option>
                    <option value="GENERAL">IELTS General</option>
                    <option value="ACADEMIC">IELTS Academic</option>
                  </select>
                </label>
                <label className="field">Question type<input required value={draft.questionType ?? ""} onChange={e => set("questionType", e.target.value)} placeholder="e.g. Multiple choice" /></label>
                <label className="field">Section<input required value={draft.section ?? ""} onChange={e => set("section", e.target.value)} placeholder="e.g. Part 1" /></label>
                <label className="field">Difficulty<select value={draft.difficulty ?? "Medium"} onChange={e => set("difficulty", e.target.value as Question["difficulty"])}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
                <label className="field">
                  Publication status
                  <select
                    value={draft.published ? "published" : "draft"}
                    onChange={(e) =>
                      set("published", e.target.value === "published")
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>
            </Card>
            <Card>
              {mode === "live" && <div className="stack mb-5">{draft.skill === "Reading" && <label className="field">Reading passage<textarea value={draft.passage ?? ""} onChange={e => set("passage",e.target.value)} /></label>}<AssetUpload onUpload={id => set("assetIds",[...new Set([...(draft.assetIds ?? []),id])])}/><p className="muted text-xs">{draft.assetIds?.length ?? 0} media assets attached</p>{draft.assetIds?.map(id=><div className="list-row" key={id}><a className="table-link text-xs" href={`/api/assets/${id}/stream`} target="_blank" rel="noreferrer">View {id.slice(0,8)}</a><Button variant="ghost" onClick={()=>set("assetIds",draft.assetIds?.filter(item=>item!==id))}>Detach asset</Button></div>)}<label className="row text-sm"><input type="checkbox" checked={draft.practiceEligible ?? true} onChange={e => set("practiceEligible",e.target.checked)}/>Include in module practice</label></div>}
              <SectionTitle title={`2. ${draft.skill} stimulus`} />
              <label className="field">
                {draft.skill === "Reading"
                  ? "Passage and question prompt"
                  : draft.skill === "Writing"
                    ? "Task prompt"
                    : draft.skill === "Speaking"
                      ? "Part prompt / cue card"
                      : "Listening question prompt"}
                <textarea
                  required
                  className="editor"
                  value={draft.prompt}
                  onChange={(e) => set("prompt", e.target.value)}
                />
              </label>
              {draft.skill === "Listening" && mode === "demo" && (
                <div className="mt-4">
                  <Notice>
                    Audio upload is not connected. No media will be uploaded.
                  </Notice>
                </div>
              )}
              {(draft.skill === "Listening" || draft.skill === "Reading") && (
                <div className="form-grid mt-5">
                  <label className="field full-span">
                    Answer options (one per line; leave empty for text response)
                    <textarea
                      value={draft.options.join("\n")}
                      onChange={(e) =>
                        set("options", e.target.value.split("\n"))
                      }
                    />
                  </label>
                  <label className="field full-span">
                    Accepted answers (one alternative per line)
                    <textarea
                      value={Array.isArray(draft.answer)?draft.answer.join("\n"):draft.answer}
                      onChange={(e) => set("answer",e.target.value.includes("\n")?e.target.value.split("\n"):e.target.value)}
                    />
                  </label>
                </div>
              )}
            </Card>
          </div>
          <Card>
            <SectionTitle title="Candidate preview" />
            <Badge>{draft.skill}</Badge>
            <h3 className="mt-4">{draft.title || "Your question title"}</h3>
            <p className="muted text-sm my-5 whitespace-pre-wrap">
              {draft.prompt || "Your prompt will appear here."}
            </p>
            {draft.options.filter(Boolean).map((option, i) => (
              <div className="answer-option" key={i}>
                {option}
              </div>
            ))}
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Open preview
            </Button>
          </Card>
        </div>
        {notice && (
          <Notice>
            {mode === "demo" ? "Question applied to the in-memory preview." : "Question saved on the server."}
          </Notice>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="actions justify-between">
          <LinkButton secondary to="/admin/questions">
            Back to question bank
          </LinkButton>
          <Button type="submit">{mode === "demo" ? "Apply question to preview" : "Save question"}</Button>
        </div>
      </form>
      {preview && (
        <Modal title="Question preview" onClose={() => setPreview(false)}>
          <div className="stack">
            <h3>{draft.title}</h3>
            <p className="whitespace-pre-wrap">{draft.prompt}</p>
            <Badge>{draft.skill}</Badge>
          </div>
        </Modal>
      )}
    </ContentContainer>
  );
}
export function QuestionEditor() {
  const { questionId } = useParams();
  const { questions } = usePreview();
  const question = questionId
    ? questions.find((q) => q.id === questionId)
    : {
        id: "new",
        skill: "Listening" as Skill,
        course: "BOTH" as const,
        title: "",
        prompt: "",
        options: [],
        answer: "",
        published: false,
      };
  if (!question)
    return (
      <ContentContainer>
        <EmptyState
          title="Question not found"
          action={<LinkButton to="/admin/questions">Question bank</LinkButton>}
        />
      </ContentContainer>
    );
  return <QuestionEditorForm key={questionId || "new"} initial={question} />;
}
