import type { MockTest, Result, Student, TestAttempt } from "../types/domain";
export function activeStudent(student: Student, date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())): boolean {
  return student.enabled && student.startDate <= date && student.expiryDate >= date;
}
export function attemptCount(studentId: string, test: MockTest, attempts: TestAttempt[], results: Result[]): number {
  const matches = (item: {studentId: string; course: string; testId: string}) => item.studentId === studentId && item.course === test.course && item.testId === test.id;
  return Math.max(0, ...attempts.filter(matches).map(a => a.number), ...results.filter(matches).map(r => r.attemptNumber));
}

export function accessStatus(student:Student){const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return !student.enabled?"Disabled":student.expiryDate<today?"Expired":student.startDate>today?"Upcoming":"Active";}
