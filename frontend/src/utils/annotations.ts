import { useEffect, useState } from "react";

// Highlights and notes on fixed texts (Reading passages, Writing tasks). Study aids, not answers:
// they stay in this browser for this attempt only.
export type Annotation = { id: string; key: string; start: number; end: number; text: string; note?: string };
export type Highlights = { set(name: string, value: unknown): void; delete(name: string): void };
export const registry = (): Highlights | undefined => (globalThis as any).CSS?.highlights;
export const HighlightCtor = (globalThis as any).Highlight as (new (...ranges: Range[]) => unknown) | undefined;
export const annotationsSupported = () => !!registry() && !!HighlightCtor;

// Stable key for a text block, so a reload finds the same passage.
export function textKey(prefix: string, text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

export function useAnnotations(attemptId: string) {
  const storageKey = `leo-annotations:${attemptId}`;
  const [items, setItems] = useState<Annotation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* private mode: keep for this page only */
    }
  }, [items, storageKey]);
  return { items, setItems };
}
