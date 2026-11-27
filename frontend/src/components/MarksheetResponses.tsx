import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Question, Result } from "../types/domain";
import { Button, Card, SectionTitle } from "./ui";
import { Icon } from "./Icon";
import { ReportIssueModal } from "./ReportIssue";
import { usePreview } from "../app/PreviewContext";
import { WritingFeedback } from "./WritingFeedback";
import { SpeakingFeedback, type SpeakingOutput } from "./SpeakingFeedback";
export function MarksheetResponses({ id, version }: { id: string; version?: number }) {
  const { currentUser } = usePreview();
  const isStudent = currentUser?.role === "student";
  const [reporting, setReporting] = useState(false),
    [reportMsg, setReportMsg] = useState("");
  const [record, setRecord] = useState<
      Result & { responses: Record<string, string>; questions: Question[]; keysWithheld?: boolean }
    >(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Result & { responses: Record<string, string>; questions: Question[]; keysWithheld?: boolean }>(`/results/${id}`)
      .then(r => {
        if (active) {
          setRecord(r);
          setError("");
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, version]);
  if (error)
    return (
      <Card>
        <p role="alert" className="error-text">
          {error}
        </p>
      </Card>
    );
  if (!record)
    return (
      <Card>
        <p role="status">Loading submitted responses...</p>
      </Card>
    );
  // A Practice Mock can have both a Writing and a Speaking AI evaluation: show the latest of each.
  const isSpeaking = (f: { output: unknown }) =>
    !!f.output && typeof f.output === "object" && "questions" in (f.output as object);
  const latestSpeaking = record.aiFeedback?.filter(isSpeaking).at(-1),
    latestWriting = record.aiFeedback?.filter(f => !isSpeaking(f)).at(-1);
  // Each Writing task's answer, keyed by task name, so the feedback can highlight the student's own words.
  const writingAnswers = Object.fromEntries(
    record.questions
      .filter(q => q.skill === "Writing")
      .map(q => [
        q.section ?? "",
        record.responses[`Writing:${q.section}`] ?? record.responses[`Writing:${q.id}`] ?? "",
      ]),
  );
  return (
    <Card>
      <SectionTitle
        title="Submitted responses"
        detail={
          isStudent ? (
            <Button variant="secondary" onClick={() => setReporting(true)}>
              <Icon name="flag" size={15} />
              Report an issue
            </Button>
          ) : undefined
        }
      />
      {reportMsg && (
        <p className="muted text-sm mb-4" role="status">
          {reportMsg}
        </p>
      )}
      {reporting && (
        <ReportIssueModal
          resultId={record.id}
          testName={record.name}
          questions={record.questions}
          onClose={() => setReporting(false)}
          onSaved={() => {
            setReporting(false);
            setReportMsg("Thank you. Your report was sent to the office. Track it under Issue Reports.");
          }}
        />
      )}
      {record.keysWithheld && (
        <p className="notice mb-4" role="note">
          Reference answers appear after you use both attempts on this Practice Mock Test, so your second attempt stays
          a fair practice.
        </p>
      )}
      <div className="stack">
        {record.questions.map(q => (
          <section className="response-record" key={q.id}>
            <h3>
              {q.skill}: {q.title}
            </h3>
            <p className="muted text-sm whitespace-pre-wrap">{q.prompt}</p>
            {q.skill === "Speaking" ? (
              record.responses[`Speaking:${q.id}`] ? (
                <audio
                  controls
                  className="mt-3"
                  src={`/api/assets/${record.responses[`Speaking:${q.id}`]}/stream`}
                  aria-label="Recorded answer"
                />
              ) : (
                <p className="text-sm mt-3">No recording</p>
              )
            ) : (
              <p className="text-sm whitespace-pre-wrap mt-3">
                {record.responses[`${q.skill}:${q.id}`] ?? record.responses[`Writing:${q.section}`] ?? "No response"}
              </p>
            )}
            {q.skill !== "Writing" && q.skill !== "Speaking" && q.answer !== undefined && (
              <p className="muted text-xs mt-2">
                Reference answer: {Array.isArray(q.answer) ? q.answer.join(" / ") : q.answer}
                {q.explanation && <span className="block mt-2">{q.explanation}</span>}
              </p>
            )}
          </section>
        ))}
        {latestWriting && <WritingFeedback evaluation={latestWriting} answers={writingAnswers} />}
        {latestSpeaking && (
          <SpeakingFeedback
            output={latestSpeaking.output as unknown as SpeakingOutput}
            questions={record.questions}
            answers={record.responses}
          />
        )}
      </div>
    </Card>
  );
}
