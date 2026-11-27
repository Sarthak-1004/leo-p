import "../../styles/practice-library.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { usePreview } from "../../app/PreviewContext";
import { api } from "../../services/api";
import { Button, ContentContainer, EmptyState, Modal } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { Pagination } from "../../components/Pagination";
import { DeviceCheck } from "../../components/DeviceCheck";
import type { Question, TestAttempt } from "../../types/domain";
import {
  buildBooks,
  buildSets,
  DIFFICULTY,
  tabOf,
  type Mode,
  type PracticeSet,
  type Tab,
} from "../../utils/practiceSets";

// Learning Arena: practice sets as cards. Question Specific groups a passage or recording by question type;
// Sectional groups the whole passage or recording. Speaking stays offline.
type History = {
  attemptId: string;
  state: "Completed" | "In progress";
  date: string;
  questionIds: string[];
  correct: number;
  total: number;
  writing: number | null;
  aiStatus: string | null;
};
const TABS: { tab: Tab; icon: string; tone: string }[] = [
  { tab: "Listening", icon: "headphones", tone: "sky" },
  { tab: "Reading", icon: "book", tone: "green" },
  { tab: "Writing Task 1", icon: "writing", tone: "violet" },
  { tab: "Writing Task 2", icon: "writing", tone: "rose" },
  { tab: "Speaking", icon: "mic", tone: "amber" },
];
// Sectional shows Writing as one tab (Task 1 and Task 2 parts side by side).
const SECTION_TABS = [TABS[0]!, TABS[1]!, { tab: "Writing" as Tab, icon: "writing", tone: "violet" }, TABS[4]!];

function Bars({ level }: { level: string }) {
  const n = DIFFICULTY[level] ?? 2;
  return (
    <span className={`diff-bars diff-${level.toLowerCase()}`} role="img" aria-label={`Difficulty: ${level}`}>
      {[1, 2, 3].map(i => (
        <i key={i} className={i <= n ? "on" : ""} style={{ height: 6 + i * 5 }} />
      ))}
    </span>
  );
}

function statusOf(set: PracticeSet, history: History[]) {
  const ids = set.questions.map(q => q.id);
  const covers = (h: History) => ids.every(id => h.questionIds.includes(id));
  const open = history.find(h => h.state === "In progress" && covers(h));
  if (open) return { label: "In progress", tone: "progress", attemptId: open.attemptId };
  const done = history.find(h => h.state === "Completed" && covers(h));
  if (done)
    return {
      label: done.total
        ? `Completed · ${done.correct}/${done.total}`
        : done.writing !== null
          ? `Completed · Band ${done.writing.toFixed(1)}`
          : "Completed",
      tone: "done",
      attemptId: done.attemptId,
    };
  return { label: "Not started", tone: "new" };
}

function SectionBooks({
  sets,
  history,
  onPick,
}: {
  sets: PracticeSet[];
  history: History[];
  onPick: (s: PracticeSet) => void;
}) {
  const books = useMemo(() => buildBooks(sets), [sets]);
  return (
    <div className="books">
      {books.map(book => (
        <section key={book.key} className="book">
          <header className="book-head">
            <h2>{book.title}</h2>
            <span>
              Sectional practice
              <b>
                {book.parts} {book.parts === 1 ? "part" : "parts"}
              </b>
            </span>
          </header>
          <div className="book-tests">
            {book.tests.map(test => (
              <div key={test.number} className="book-test">
                <h3>Test {test.number}</h3>
                {test.parts.map(part => {
                  const st = statusOf(part, history);
                  return (
                    <button
                      type="button"
                      key={part.key}
                      className={`book-part status-${st.tone}`}
                      onClick={() => onPick(part)}
                    >
                      <span className="book-part-head">
                        <strong>{part.section.toUpperCase().replace(/\s+/, " - ")}</strong>
                        <Bars level={part.difficulty} />
                      </span>
                      <span className="book-part-title">
                        {part.title} · {part.questions.length} {part.questions.length === 1 ? "question" : "questions"}
                      </span>
                      <span className={`set-status ${st.tone}`}>
                        <Icon name={st.tone === "done" ? "check" : "play"} size={13} />
                        {st.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PracticeLibrary({ mode }: { mode: Mode }) {
  const { questions, mode: portal, refresh, course } = usePreview();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Listening"),
    [search, setSearch] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [status, setStatus] = useState("");
  const [order, setOrder] = useState<"az" | "za">("az"),
    [part, setPart] = useState(""),
    [type, setType] = useState(""),
    [moreTypes, setMoreTypes] = useState(false);
  const [page, setPage] = useState(1),
    [size, setSize] = useState(20),
    [chosen, setChosen] = useState<PracticeSet | null>(null);
  const [history, setHistory] = useState<History[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [devicesReady, setDevicesReady] = useState(false);
  useEffect(() => {
    if (portal !== "live") return;
    const c = new AbortController();
    api<History[]>("/practice/history", { signal: c.signal })
      .then(setHistory)
      .catch(() => {});
    return () => c.abort();
  }, [portal]);
  const practice = useMemo(
    () => questions.filter(q => q.course === "BOTH" || q.course === course),
    [questions, course],
  );
  const tabs = mode === "section" ? SECTION_TABS : TABS;
  const tabFor = useCallback(
    (q: Question): Tab => (mode === "section" && q.skill === "Writing" ? "Writing" : tabOf(q)),
    [mode],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        tabs.map(t => [
          t.tab,
          buildSets(
            practice.filter(q => tabFor(q) === t.tab),
            mode,
          ).length,
        ]),
      ),
    [practice, mode, tabs, tabFor],
  );
  const sets = useMemo(
    () =>
      buildSets(
        practice.filter(q => tabFor(q) === tab),
        mode,
      ),
    [practice, tab, mode, tabFor],
  );
  const parts = useMemo(() => [...new Set(sets.map(s => s.section).filter(Boolean))].sort(), [sets]);
  // A set counts once for every question type it contains (Question Specific sets have exactly one).
  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sets)
      for (const t of new Set(s.questions.map(q => q.questionType).filter(Boolean) as string[]))
        m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sets]);
  const filtered = useMemo(
    () =>
      sets
        .filter(
          s =>
            (!search.trim() || s.title.toLowerCase().includes(search.trim().toLowerCase())) &&
            (!difficulty || s.difficulty === difficulty) &&
            (!part || s.section === part) &&
            (!type || s.questions.some(q => q.questionType === type)) &&
            (!status || statusOf(s, history).label.startsWith(status)),
        )
        .sort((a, b) => (order === "az" ? 1 : -1) * a.title.localeCompare(b.title) || a.number - b.number),
    [sets, search, difficulty, part, type, status, order, history],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size)),
    shown = filtered.slice((Math.min(page, pages) - 1) * size, Math.min(page, pages) * size);
  const reset = () => {
    setSearch("");
    setDifficulty("");
    setStatus("");
    setOrder("az");
    setPart("");
    setType("");
    setPage(1);
  };
  const pick = (t: Tab) => {
    setTab(t);
    setPart("");
    setType("");
    setPage(1);
    setMoreTypes(false);
  };
  const start = async (set: PracticeSet) => {
    setError("");
    const st = statusOf(set, history);
    if (st.tone === "progress" && st.attemptId) return navigate(`/student/attempts/${st.attemptId}`);
    if (portal !== "live") return navigate(`/student/practice/${set.skill.toLowerCase()}/sample?mode=${mode}`);
    setBusy(true);
    try {
      const a = await api<TestAttempt>("/practice/start", {
        method: "POST",
        body: {
          skill: set.skill,
          mode,
          selection: mode === "type" ? set.type : set.section || set.type,
          questionIds: set.questions.map(q => q.id),
        },
      });
      await refresh();
      navigate(`/student/attempts/${a.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Practice could not start");
    } finally {
      setBusy(false);
    }
  };
  const visibleTypes = moreTypes ? types : types.slice(0, 4);
  return (
    <ContentContainer>
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>Tests</span>
        <span aria-hidden="true">»</span>
        <span>Learning Arena</span>
        <span aria-hidden="true">»</span>
        <strong aria-current="page">{mode === "type" ? "Question Specific" : "Sectional"}</strong>
      </nav>
      <div className={`arena-tabs ${mode === "section" ? "four" : ""}`} role="tablist" aria-label="Skill">
        {tabs.map(t => (
          <button
            type="button"
            role="tab"
            key={t.tab}
            aria-selected={tab === t.tab}
            className={`arena-tab arena-${t.tone}`}
            onClick={() => pick(t.tab)}
          >
            <span className="arena-tab-icon">
              <Icon name={t.icon} />
            </span>
            <span className="arena-tab-label">{t.tab}</span>
            <span className="arena-count">{counts[t.tab]}</span>
          </button>
        ))}
      </div>
      {
        <>
          <section className="card arena-filters">
            <label className="search-field">
              <Icon name="search" size={16} />
              <input
                aria-label="Search by title"
                placeholder="Search by title"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Difficulty"
              value={difficulty}
              onChange={e => {
                setDifficulty(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Difficulty</option>
              {["Easy", "Medium", "Hard"].map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="Practice status"
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Status</option>
              {["Not started", "In progress", "Completed"].map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select aria-label="Sort" value={order} onChange={e => setOrder(e.target.value as "az" | "za")}>
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
            </select>
            <Button variant="secondary" onClick={reset}>
              Reset
            </Button>
            {parts.length > 1 && (
              <div className="part-switch" role="group" aria-label="Part">
                {parts.map(p => (
                  <button
                    type="button"
                    key={p}
                    aria-pressed={part === p}
                    onClick={() => {
                      setPart(part === p ? "" : p);
                      setPage(1);
                    }}
                  >
                    {p} <span>({sets.filter(s => s.section === p).length})</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="card arena-list">
            {types.length > 1 && tab !== "Writing" && (
              <div className="type-chips">
                <strong>Question types:</strong>
                <button
                  type="button"
                  aria-pressed={!type}
                  onClick={() => {
                    setType("");
                    setPage(1);
                  }}
                >
                  All <span>{sets.length}</span>
                </button>
                {visibleTypes.map(([t, n]) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={type === t}
                    onClick={() => {
                      setType(type === t ? "" : t);
                      setPage(1);
                    }}
                  >
                    {t} <span>{n}</span>
                  </button>
                ))}
                {types.length > 4 && (
                  <button type="button" className="link-button" onClick={() => setMoreTypes(!moreTypes)}>
                    {moreTypes ? "Show fewer" : `Show more (${types.length - 4})`}
                  </button>
                )}
              </div>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {!practice.length ? (
              <EmptyState
                title="No published practice yet"
                description="Your office will add practice material here."
              />
            ) : !filtered.length ? (
              <EmptyState title="No practice sets match" description="Change or reset the filters." />
            ) : mode === "section" ? (
              <SectionBooks sets={filtered} history={history} onPick={setChosen} />
            ) : (
              <div className="set-grid">
                {shown.map(s => {
                  const st = statusOf(s, history);
                  return (
                    <button
                      type="button"
                      key={s.key}
                      className={`set-card status-${st.tone}`}
                      onClick={() => setChosen(s)}
                    >
                      <div className="set-card-top">
                        <span className={`set-icon arena-${TABS.find(t => t.tab === tabOf(s.questions[0]!))?.tone}`}>
                          <Icon name={TABS.find(t => t.tab === tabOf(s.questions[0]!))?.icon ?? "book"} />
                        </span>
                        <strong className="set-title">
                          {s.number}. {s.title}
                        </strong>
                        <Bars level={s.difficulty} />
                      </div>
                      <span className="set-type">{s.skill === "Writing" ? s.section : s.type}</span>
                      <div className="set-foot">
                        <span>
                          <Icon name="test" size={14} /> {s.questions.length}{" "}
                          {s.questions.length === 1 ? "question" : "questions"}
                          {s.section && s.skill !== "Writing" ? ` · ${s.section}` : ""}
                        </span>
                        <span className={`set-status ${st.tone}`}>
                          <Icon name={st.tone === "done" ? "check" : "play"} size={13} />
                          {st.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {mode === "type" && filtered.length > 0 && (
              <div className="arena-pager">
                <label className="rows-field">
                  <span>Per page</span>
                  <select
                    aria-label="Per page"
                    value={size}
                    onChange={e => {
                      setSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[12, 20, 40].map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <Pagination page={Math.min(page, pages)} pages={pages} setPage={setPage} count={filtered.length} />
              </div>
            )}
          </section>
        </>
      }
      {chosen && (
        <Modal title={`IELTS ${chosen.skill} practice`} onClose={() => setChosen(null)}>
          <div className="stack start-dialog">
            <p className="muted">
              {chosen.number}. {chosen.title}
            </p>
            <ul className="start-facts">
              <li>
                {chosen.skill === "Writing"
                  ? `${chosen.section === "Task 2" ? 40 : 20} minutes, then AI marking with highlighted corrections`
                  : "No time limit — practise at your own pace"}
              </li>
              <li>
                Module: {chosen.skill}
                {chosen.section ? ` · ${chosen.section}` : ""}
              </li>
              <li>
                {chosen.questions.length} {chosen.questions.length === 1 ? "question" : "questions"}
                {mode === "type" && chosen.skill !== "Writing" ? ` · ${chosen.type}` : ""}
              </li>
              {chosen.skill === "Listening" && (
                <li>Audio controls: pause, replay and speed 1x / 1.5x / 2x are allowed in practice</li>
              )}
              {chosen.skill === "Speaking" && (
                <li>
                  You record each answer (Part 2: 1 minute to prepare, up to 2 minutes to speak). The AI marks Fluency,
                  Vocabulary, Grammar and Pronunciation and shows a transcript.
                </li>
              )}
              <li>
                Answers and explanations appear after you submit. Practise again as often as you like within your daily
                practice limit.
              </li>
            </ul>
            {chosen.skill === "Speaking" && statusOf(chosen, history).tone !== "progress" && (
              <DeviceCheck onReady={setDevicesReady} />
            )}
            <Button
              onClick={() => void start(chosen)}
              disabled={
                busy || (chosen.skill === "Speaking" && statusOf(chosen, history).tone !== "progress" && !devicesReady)
              }
            >
              {busy
                ? "Starting…"
                : statusOf(chosen, history).tone === "progress"
                  ? "Resume practice"
                  : "Start practice now"}
            </Button>
          </div>
        </Modal>
      )}
    </ContentContainer>
  );
}
