import type { Question } from "../types/domain";

// How a section's questions are laid out: numbered items parsed from prompts, grouped into
// "Questions a-b" blocks that share instructions, with shared option lists shown as drag chips.
export type Section = "Listening" | "Reading" | "Writing" | "Speaking";
export type Item = { q: Question; index: number; number: number; stem: string; instructions: string };
export type Group = { part: string; instructions: string; items: Item[]; chips?: string[] };
const choiceSets = [
  ["True", "False", "Not Given"],
  ["Yes", "No", "Not Given"],
];
export const GAP = /_{3,}/;

export function parse(questions: Question[]): Item[] {
  return questions.map((q, index) => {
    const m = /^([\s\S]*?)\n\n(\d+)\.\s([\s\S]*)$/.exec(q.prompt);
    return m
      ? { q, index, number: Number(m[2]), stem: m[3]!, instructions: m[1]! }
      : { q, index, number: index + 1, stem: q.prompt, instructions: "" };
  });
}
// Consecutive questions in the same part with the same instructions form one "Questions a–b" group.
export function group(items: Item[]): Group[] {
  const groups: Group[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && last.part === partOf(it) && last.instructions === it.instructions) last.items.push(it);
    else groups.push({ part: partOf(it), instructions: it.instructions, items: [it] });
  }
  for (const g of groups) {
    const first = JSON.stringify(g.items[0]!.q.options);
    const shared = g.items.length > 1 && g.items.every(it => JSON.stringify(it.q.options) === first);
    const opts = g.items[0]!.q.options;
    // Shared option lists become drag-and-drop answers; True/False/Not Given and short lists stay as choices.
    if (shared && opts.length >= 3 && !choiceSets.some(s => JSON.stringify(s) === first)) g.chips = opts;
  }
  return groups;
}
export const partOf = (it: Item) => it.q.section ?? "";
export const range = (items: Item[]) =>
  items.length > 1 ? `${items[0]!.number}–${items.at(-1)!.number}` : `${items[0]!.number}`;
