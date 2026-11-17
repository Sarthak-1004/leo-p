import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { annotationsSupported, HighlightCtor, registry, type Annotation } from "../utils/annotations";

// Highlight / note menu and notes panel, as in the computer-delivered test. Text is marked with the
// CSS Custom Highlight API, so React-rendered passages are never rewritten.
const offsetIn = (root: Element, node: Node, offset: number) => { const r = document.createRange(); r.setStart(root, 0); r.setEnd(node, offset); return r.toString().length; };
function rangeFor(root: Element, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const range = document.createRange();
  let seen = 0, startSet = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    if (!startSet && start <= seen + len) { range.setStart(node, start - seen); startSet = true; }
    if (startSet && end <= seen + len) { range.setEnd(node, end - seen); return range; }
    seen += len;
  }
  return null;
}

export function AnnotationLayer({ scope, items, setItems, refreshKey, onOpenNote }: {
  scope: React.RefObject<HTMLElement | null>; items: Annotation[]; setItems: (fn: (old: Annotation[]) => Annotation[]) => void;
  refreshKey: string; onOpenNote: (id: string) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; key: string; start: number; end: number; text: string; overlaps: string[] } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Paint every saved highlight that is on screen.
  useLayoutEffect(() => {
    const reg = registry(); if (!reg || !HighlightCtor) return;
    const plain: Range[] = [], noted: Range[] = [];
    for (const a of items) {
      const root = scope.current?.querySelector(`[data-annotate="${a.key}"]`); const r = root && rangeFor(root, a.start, a.end);
      if (r) (a.note !== undefined ? noted : plain).push(r);
    }
    reg.set("cbt-highlight", new HighlightCtor(...plain)); reg.set("cbt-note", new HighlightCtor(...noted));
    return () => { reg.delete("cbt-highlight"); reg.delete("cbt-note"); };
  }, [items, refreshKey, scope]);

  // A selection inside a marked text offers Highlight / Note / Clear (mouse, touch or keyboard selection).
  useEffect(() => {
    const read = (at?: { x: number; y: number }) => {
      const sel = document.getSelection(); if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0), root = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer as Element : range.commonAncestorContainer.parentElement)?.closest("[data-annotate]");
      if (!root || !scope.current?.contains(root)) return null;
      const key = root.getAttribute("data-annotate")!, start = offsetIn(root, range.startContainer, range.startOffset), end = offsetIn(root, range.endContainer, range.endOffset);
      const overlaps = items.filter(a => a.key === key && a.start < Math.max(end, start + 1) && a.end > start).map(a => a.id);
      if (end <= start && !overlaps.length) return null;
      const box = range.getBoundingClientRect(), x = at?.x ?? box.left + box.width / 2, y = at?.y ?? box.bottom;
      return { x, y, key, start, end, text: range.toString(), overlaps };
    };
    let timer: ReturnType<typeof setTimeout>;
    const change = () => { clearTimeout(timer); timer = setTimeout(() => { if (menuRef.current?.contains(document.activeElement)) return; const m = read(); setMenu(m && m.end > m.start ? m : null); }, 180); };
    const context = (e: MouseEvent) => { const m = read({ x: e.clientX, y: e.clientY }); if (m) { e.preventDefault(); setMenu(m); } };
    const click = (e: MouseEvent) => {   // clicking a noted highlight opens its note
      const root = (e.target as Element)?.closest?.("[data-annotate]"); if (!root || document.getSelection()?.toString()) return;
      const caret = (document as any).caretPositionFromPoint?.(e.clientX, e.clientY) ?? (document as any).caretRangeFromPoint?.(e.clientX, e.clientY);
      const node = caret?.offsetNode ?? caret?.startContainer, off = caret?.offset ?? caret?.startOffset; if (!node) return;
      const at = offsetIn(root, node, off), key = root.getAttribute("data-annotate");
      const hit = items.find(a => a.key === key && a.note !== undefined && a.start <= at && a.end >= at); if (hit) onOpenNote(hit.id);
    };
    document.addEventListener("selectionchange", change); const el = scope.current; el?.addEventListener("contextmenu", context); el?.addEventListener("click", click);
    return () => { clearTimeout(timer); document.removeEventListener("selectionchange", change); el?.removeEventListener("contextmenu", context); el?.removeEventListener("click", click); };
  }, [scope, items, onOpenNote]);
  useEffect(() => { if (!menu) return; const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); }; document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc); }, [menu]);

  if (!menu || !annotationsSupported()) return null;
  const add = (note: boolean) => {
    const id = crypto.randomUUID();
    setItems(old => [...old.filter(a => !menu.overlaps.includes(a.id)), { id, key: menu.key, start: menu.start, end: menu.end, text: menu.text.slice(0, 300), ...(note ? { note: "" } : {}) }]);
    document.getSelection()?.removeAllRanges(); setMenu(null); if (note) onOpenNote(id);
  };
  const clear = () => { setItems(old => old.filter(a => !menu.overlaps.includes(a.id))); document.getSelection()?.removeAllRanges(); setMenu(null); };
  const left = Math.min(Math.max(8, menu.x - 110), window.innerWidth - 228), top = Math.min(menu.y + 8, window.innerHeight - 150);
  return <div ref={menuRef} className="cbt-annotate-menu" role="menu" aria-label="Highlight and notes" style={{ left, top }}>
    {menu.end > menu.start && <button type="button" role="menuitem" onClick={() => add(false)}>Highlight</button>}
    {menu.end > menu.start && <button type="button" role="menuitem" onClick={() => add(true)}>Add note</button>}
    {menu.overlaps.length > 0 && <button type="button" role="menuitem" onClick={clear}>Clear</button>}
  </div>;
}

export function NotesPanel({ items, setItems, focusId, onClose }: { items: Annotation[]; setItems: (fn: (old: Annotation[]) => Annotation[]) => void; focusId?: string; onClose: () => void }) {
  const notes = items.filter(a => a.note !== undefined);
  useEffect(() => { if (focusId) document.getElementById(`note-${focusId}`)?.focus(); }, [focusId]);
  return <aside className="cbt-notes" aria-label="Notes">
    <div className="cbt-notes-head"><strong>Notes</strong><button type="button" aria-label="Close notes" onClick={onClose}>×</button></div>
    {!notes.length && <p className="cbt-notes-empty">Select text in a passage or task, then choose Add note.</p>}
    {notes.map(a => <div key={a.id} className="cbt-note">
      <q>{a.text.length > 120 ? `${a.text.slice(0, 120)}…` : a.text}</q>
      <label><span className="sr-only">Note</span><textarea id={`note-${a.id}`} rows={3} value={a.note} onChange={e => { const note = e.target.value; setItems(old => old.map(x => x.id === a.id ? { ...x, note } : x)); }} /></label>
      <button type="button" onClick={() => setItems(old => old.filter(x => x.id !== a.id))}>Delete note</button>
    </div>)}
    <p className="cbt-notes-empty">Notes and highlights stay on this computer and are not marked.</p>
  </aside>;
}
