import { useState } from "react";
import type { Question } from "../types/domain";

// AI marking of a practice Speaking attempt: criteria with remarks, each answer's recording and transcript
// with errors highlighted, and guidance for the student.
export type SpeakingOutput = {
  questions: {
    questionId: string;
    transcript: string;
    corrections: { original: string; suggestion: string; reason: string; type?: string }[];
  }[];
  criteria: Record<"fluency" | "lexical" | "grammar" | "pronunciation", { band: number; remarks: string }>;
  feedback: string;
  strengths: string[];
  improvements: string[];
  summary: string;
  priorities: string[];
};
const NAMES: [keyof SpeakingOutput["criteria"], string][] = [
  ["fluency", "Fluency & Coherence"],
  ["lexical", "Lexical Resource"],
  ["grammar", "Grammatical Range & Accuracy"],
  ["pronunciation", "Pronunciation"],
];

function Transcript({
  text,
  corrections,
}: {
  text: string;
  corrections: SpeakingOutput["questions"][number]["corrections"];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const spans: { at: number; end: number; n: number }[] = [];
  corrections.forEach((c, n) => {
    const at = text.indexOf(c.original);
    if (at >= 0 && !spans.some(s => at < s.end && at + c.original.length > s.at))
      spans.push({ at, end: at + c.original.length, n });
  });
  spans.sort((a, b) => a.at - b.at);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const s of spans) {
    parts.push(text.slice(pos, s.at));
    parts.push(
      <mark
        key={s.n}
        role="button"
        tabIndex={0}
        className="ai-mark ai-grammar"
        onClick={() => setOpen(open === s.n ? null : s.n)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(open === s.n ? null : s.n);
          }
        }}
      >
        {text.slice(s.at, s.end)}
        <sup>{s.n + 1}</sup>
      </mark>,
    );
    pos = s.end;
  }
  parts.push(text.slice(pos));
  return (
    <>
      <p className="ai-essay">{parts}</p>
      {open !== null && corrections[open] && (
        <p className="ai-tip" role="status">
          <b>
            {open + 1}. {corrections[open]!.suggestion}
          </b>{" "}
          — {corrections[open]!.reason}
        </p>
      )}
    </>
  );
}

export function SpeakingFeedback({
  output,
  questions,
  answers,
}: {
  output: SpeakingOutput;
  questions: Question[];
  answers: Record<string, string>;
}) {
  const band = Math.round((NAMES.reduce((n, [k]) => n + (output.criteria[k]?.band ?? 0), 0) / 4) * 2) / 2;
  return (
    <div className="stack">
      <section className="response-record">
        <div className="ai-task-head">
          <h3>AI Speaking feedback</h3>
          <span className="ai-band">{band.toFixed(1)}</span>
        </div>
        <p className="muted text-xs">An estimated training band, not an official IELTS score.</p>
        <table className="ai-criteria">
          <tbody>
            {NAMES.map(([k, name]) => (
              <tr key={k}>
                <th scope="row">{name}</th>
                <td className="ai-criteria-band">{output.criteria[k]?.band}</td>
                <td>{output.criteria[k]?.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {output.summary && <p className="text-sm mt-4">{output.summary}</p>}
        {output.priorities?.length > 0 && (
          <>
            <h4 className="mt-4">Top priorities</h4>
            <ol className="list-decimal pl-5 text-sm">
              {output.priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </>
        )}
      </section>
      {output.questions.map((a, i) => {
        const q = questions.find(x => x.id === a.questionId);
        const rec = answers[`Speaking:${a.questionId}`];
        return (
          <section key={a.questionId} className="response-record">
            <h3>
              {q?.section ?? "Answer"} · {i + 1}
            </h3>
            {q && <p className="muted text-sm whitespace-pre-wrap">{q.prompt}</p>}
            {rec && (
              <audio
                controls
                src={`/api/assets/${rec}/stream`}
                aria-label={`Your recording for answer ${i + 1}`}
                className="mt-2"
              />
            )}
            <h4 className="mt-4">
              What you said{" "}
              <span className="muted text-xs">
                {a.corrections.length ? `${a.corrections.length} corrections highlighted` : "AI transcript"}
              </span>
            </h4>
            <Transcript text={a.transcript} corrections={a.corrections} />
          </section>
        );
      })}
      {(
        [
          ["Strengths", output.strengths],
          ["How to improve", output.improvements],
        ] as [string, string[]][]
      ).map(
        ([label, items]) =>
          items?.length > 0 && (
            <section key={label} className="response-record">
              <h4>{label}</h4>
              <ul className="list-disc pl-5 text-sm">
                {items.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
