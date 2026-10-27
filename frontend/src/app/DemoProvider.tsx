import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AuditEvent, Course, Notification, TestAttempt, Skill } from "../types/domain";
import { mockTestService, practiceService, questionService, resultService, studentService } from "../services/mockAdapter";
import { trainers as sampleTrainers } from "../mocks/trainers";
import { canRelease, overallBand } from "../utils/scoring";
import { activeStudent, attemptCount } from "../utils/policy";
import { PortalContext as Context, type PreviewState, type PreviewValue } from "./context";
const initial: PreviewState = {
  practiceRecords: [],
  students: [], tests: [], questions: [], results: [], progress: [], trainers: [], attempts: [], notifications: [], auditEvents: [],
  settings: { institutionName: "Kanan IELTS Practice Portal", interruptionLimit: 3, leaderboard: true },
};
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const audit = (action: string, target: string, detail: string): AuditEvent => ({ id: id(), action, target, detail, at: now() });
const notification = (role: Notification["role"], title: string, href: string, recipientId?: string): Notification => ({ id: id(), role, title, href, recipientId, read: false, createdAt: now() });
export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PreviewState>(initial);
  const state = useRef(data);
  const [course, setCourse] = useState<Course>("GENERAL");
  const [trainerId, setTrainerId] = useState("TR-001");
  const [status, setStatus] = useState<PreviewValue["status"]>("loading");
  const [revision, setRevision] = useState(0);
  function mutate(change: (previous: PreviewState) => PreviewState) {
    state.current = change(state.current);
    setData(state.current);
  }
  useEffect(() => {
    let active = true;
    Promise.all([studentService.list(), mockTestService.list(), questionService.list(), resultService.list(), practiceService.progress()])
      .then(([students, tests, questions, results, progress]) => {
        if (!active) return;
        const next: PreviewState = { ...initial, students, tests, questions, results, progress, trainers: structuredClone(sampleTrainers), notifications: [
          notification("student", "Your Full Length Test 02 result is available.", "/student/results/general-02", "KAN-88429"),
          notification("trainer", "Writing and offline Speaking marks are pending.", "/trainer/evaluations", "TR-001"),
          notification("admin", "Review the evaluation queue before releasing results.", "/admin/results"),
        ] };
        state.current = next; setData(next); setStatus("ready");
      }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [revision]);
  const value: PreviewValue = {
    ...data, mode: "demo", authStatus: "authenticated", pending: false, error: "", clearError: () => {}, login: async () => {}, logout: async () => {}, refresh: async () => {}, course, setCourse, trainerId, setTrainerId, status,
    addPracticeRecord: record => mutate(p => ({ ...p, practiceRecords: p.practiceRecords.some(r => r.id === record.id) ? p.practiceRecords : [...p.practiceRecords, record] })),
    retry: () => { setStatus("loading"); setRevision(v => v + 1); },
    addAudit: (action, target, detail) => mutate(p => ({ ...p, auditEvents: [audit(action, target, detail), ...p.auditEvents] })),
    updateStudent: student => mutate(p => {
      const old = p.students.find(s => s.id === student.id);
      return { ...p, students: old ? p.students.map(s => s.id === student.id ? student : s) : [...p.students, student],
        auditEvents: [audit(old ? "Student updated" : "Student created", student.id, "Account and assignment updated in preview"), ...p.auditEvents],
        notifications: student.trainerId && old?.trainerId !== student.trainerId ? [notification("trainer", `${student.name} has been assigned to you.`, `/trainer/students/${student.id}`, student.trainerId), ...p.notifications] : p.notifications };
    }),
    updateTrainer: trainer => mutate(p => ({ ...p, trainers: p.trainers.some(t => t.id === trainer.id) ? p.trainers.map(t => t.id === trainer.id ? trainer : t) : [...p.trainers, trainer], auditEvents: [audit("Trainer updated", trainer.id, trainer.enabled ? "Enabled" : "Disabled"), ...p.auditEvents] })),
    updateQuestion: question => mutate(p => ({ ...p, questions: p.questions.some(q => q.id === question.id) ? p.questions.map(q => q.id === question.id ? question : q) : [...p.questions, question] })),
    updateTest: test => mutate(p => {
      const old = p.tests.find(t => t.id === test.id && t.course === test.course);
      const unlocked = test.kind === "FLT" && test.published && test.available && (!old?.available || !old?.published);
      return { ...p, tests: p.tests.map(t => t.id === test.id && t.course === test.course ? test : t),
        auditEvents: [audit("Test updated", `${test.course}/${test.id}`, `Publication ${test.published}; course availability ${test.kind === "FLT" ? test.available : "automatic"}`), ...p.auditEvents],
        notifications: unlocked ? [...p.students.filter(s => s.course === test.course && activeStudent(s)).map(s => notification("student", `Full Length Test ${test.number} is available.`, "/student/mock-tests", s.id)), ...p.notifications] : p.notifications };
    }),
    updateResult: result => mutate(p => ({ ...p, results: p.results.some(r => r.id === result.id) ? p.results.map(r => r.id === result.id ? result : r) : [...p.results, result] })),
    reviseResult: (result, actor, remarks) => {
      const old = state.current.results.find(r => r.id === result.id);
      if (!old) return false;
      const sections: Skill[] = ["Listening", "Reading", "Writing", "Speaking"];
      const changed = sections.filter(s => old[s.toLowerCase() as "listening" | "reading" | "writing" | "speaking"] !== result[s.toLowerCase() as "listening" | "reading" | "writing" | "speaking"]);
      const speakingDetailsChanged = JSON.stringify(old.speakingCriteria) !== JSON.stringify(result.speakingCriteria) || old.speakingDate !== result.speakingDate;
      if (speakingDetailsChanged && !changed.includes("Speaking")) changed.push("Speaking");
      if (changed.length && !remarks.trim()) return false;
      const revisions = changed.map(section => { const key = section.toLowerCase() as "listening" | "reading" | "writing" | "speaking"; return { id: id(), section, previous: old[key], value: result[key], actor, remarks: remarks.trim(), at: now() }; });
      const updated = { ...result, released: old.released, overall: overallBand(result), remarks: remarks.trim() || old.remarks, evaluatedBy: result.evaluatedBy ?? old.evaluatedBy, revisions: [...(old.revisions ?? []), ...revisions] };
      mutate(p => ({ ...p, results: p.results.map(r => r.id === result.id ? updated : r),
        auditEvents: [audit(changed.length ? "Score changed" : "Evaluation updated", result.id, `${actor}: ${remarks.trim() || result.reviewStatus}`), ...p.auditEvents],
        notifications: old.released && old.speaking === null && result.speaking !== null ? [notification("student", `Your Speaking score has been added to ${result.name}.`, `/student/results/${result.id}`, result.studentId), ...p.notifications] : p.notifications }));
      return true;
    },
    releaseResults: ids => {
      const ready = state.current.results.filter(r => ids.includes(r.id) && canRelease(r));
      const eligible = new Set(ready.map(r => r.id));
      mutate(p => ({ ...p, results: p.results.map(r => eligible.has(r.id) ? { ...r, released: true } : r),
        notifications: [...ready.map(r => notification("student", `Your ${r.name} result is now available.`, `/student/results/${r.id}`, r.studentId)), ...p.notifications],
        auditEvents: [...ready.map(r => audit("Result released", r.id, "Released by Kanan Admin")), ...p.auditEvents] }));
      return ready.length;
    },
    markNotificationRead: target => mutate(p => ({ ...p, notifications: p.notifications.map(n => n.id === target ? { ...n, read: true } : n) })),
    updateSettings: settings => mutate(p => ({ ...p, settings: { ...settings, interruptionLimit: Math.max(0, Math.floor(settings.interruptionLimit)) }, auditEvents: [audit("Settings updated", "Platform", "Operational preview preferences updated"), ...p.auditEvents] })),
    startAttempt: requested => {
      const p = state.current;
      const student = p.students.find(s => s.course === course);
      const test = p.tests.find(t => t.id === requested.id && t.course === requested.course);
      if (!student || !activeStudent(student) || !test || test.course !== student.course || !test.published || (test.kind === "FLT" && !test.available)) return null;
      const existing = p.attempts.find(a => a.studentId === student.id && a.course === course && a.testId === test.id && a.state === "In progress");
      if (existing) return existing;
      const used = attemptCount(student.id, test, p.attempts, p.results);
      if (used >= (test.kind === "FLT" ? 1 : 2)) return null;
      const attempt: TestAttempt = { id: id(), testId: test.id, studentId: student.id, course, kind: test.kind, number: used + 1, state: "In progress", remainingSeconds: test.duration * 60, section: 0, question: 0, answers: {}, theme: "standard", fontSize: "standard", interruptions: 0 };
      mutate(previous => ({ ...previous, attempts: [...previous.attempts, attempt] }));
      return attempt;
    },
    updateAttempt: attempt => mutate(p => {
      const old = p.attempts.find(a => a.id === attempt.id);
      if (!old || old.state === "Submitted") return p;
      const interrupted = attempt.interruptions > old.interruptions;
      const flagged = interrupted && attempt.interruptions > p.settings.interruptionLimit;
      return { ...p, attempts: p.attempts.map(a => a.id === attempt.id ? attempt : a),
        auditEvents: interrupted ? [audit(flagged ? "Attempt flagged for review" : "Test interrupted", attempt.id, `${attempt.interruptions} interruptions; ${attempt.remainingSeconds} seconds remaining`), ...p.auditEvents] : p.auditEvents,
        notifications: flagged ? [notification("admin", "An attempt exceeded the interruption limit.", "/admin/audit"), ...p.notifications] : p.notifications };
    }),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
