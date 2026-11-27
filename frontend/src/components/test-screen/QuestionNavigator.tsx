import type { Answers, Question } from "../../types/domain";
import { wordCount } from "../../utils/format";
import { Icon } from "../Icon";
import { partOf, type Item } from "../../utils/questionLayout";

// Previous/next arrows, the part and question navigator, and the section finish button.
export function QuestionNavigator(props: {
  speaking: boolean;
  writing: boolean;
  parts: string[];
  part: string;
  items: Item[];
  questions: Question[];
  answers: Answers;
  current: number;
  total: number;
  go: (index: number) => void;
  finish: string;
  finishDisabled: boolean;
  onFinish: () => void;
}) {
  const { speaking, writing, parts, part, items, questions, answers, current, total, go, finish } = props;
  return (
    <>
      {!speaking && (
        <div className="cbt-arrows">
          <button type="button" aria-label="Previous question" disabled={current <= 0} onClick={() => go(current - 1)}>
            <Icon name="arrow" />
          </button>
          <button
            type="button"
            aria-label="Next question"
            disabled={current >= total - 1}
            onClick={() => go(current + 1)}
          >
            <Icon name="arrow" />
          </button>
        </div>
      )}
      <nav className="cbt-nav" aria-label="Question navigator">
        <div className="cbt-parts">
          {speaking ? (
            <div className="cbt-part active">
              <strong>Speaking</strong>
              <span>
                {questions.filter(q => answers[q.id]).length} of {questions.length} recorded
              </span>
            </div>
          ) : (
            parts.map(p => {
              const these = writing ? [] : items.filter(it => partOf(it) === p);
              const done = writing
                ? wordCount(answers[p] ?? "")
                  ? 1
                  : 0
                : these.filter(it => answers[it.q.id]).length;
              const first = writing ? parts.indexOf(p) : (these[0]?.index ?? 0);
              if (p !== part || writing)
                return (
                  <button
                    type="button"
                    key={p}
                    aria-label={p}
                    aria-current={p === part ? "true" : undefined}
                    className={`cbt-part ${p === part ? "active" : ""}`}
                    onClick={() => go(first)}
                  >
                    <strong>{p}</strong>
                    <span>
                      {done} of {writing ? 1 : these.length}
                    </span>
                  </button>
                );
              return (
                <div key={p} className="cbt-part active">
                  <strong>{p}</strong>
                  <span className="cbt-numbers">
                    {these.map(it => (
                      <button
                        type="button"
                        key={it.q.id}
                        aria-label={`Question ${it.number}${answers[it.q.id] ? ", answered" : ""}`}
                        aria-current={it.index === current ? "true" : undefined}
                        className={`${answers[it.q.id] ? "answered" : ""} ${it.index === current ? "current" : ""}`}
                        onClick={() => go(it.index)}
                      >
                        {it.number}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <button
          type="button"
          className="cbt-finish"
          aria-label={finish}
          title={finish}
          disabled={props.finishDisabled}
          onClick={props.onFinish}
        >
          <Icon name="check" />
        </button>
      </nav>
    </>
  );
}
