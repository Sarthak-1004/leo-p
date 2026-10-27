import type { Course } from "../types/domain";
export const courseName = (course: Course) =>
  course === "GENERAL" ? "IELTS General" : "IELTS Academic";
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date.includes("T") ? date : `${date}T12:00:00Z`));
export const wordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/u).length : 0;
