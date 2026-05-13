import { useEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { ListTree, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

/**
 * El import PDF parte títulos en dos nodos: la 2.ª línea no debe aparecer como entrada en el mapa.
 */
function isOrphanTitleFragment(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(y|e|o)\s+/i.test(t)) return true;
  if (/^operaci[oó]n\s+diaria\b/i.test(t)) return true;
  if (/^buenas\s+pr[aá]cticas\b/i.test(t)) return true;
  if (/^c[aá]lculo\s+térmico\b/i.test(t)) return true;
  return false;
}

/** Párrafo corto con caracteres significativos en negrita (import Word/HTML sin nodos heading). */
function isShortBoldOnlyParagraph(editor: Editor, docPos: number): boolean {
  const node = editor.state.doc.nodeAt(docPos);
  if (!node || node.type.name !== 'paragraph') return false;
  const bold = editor.schema.marks.bold;
  if (!bold) return false;

  const trimmed = node.textContent.trim();
  if (trimmed.length < 6 || trimmed.length > 220) return false;

  const from = docPos + 1;
  const toExclusive = docPos + node.nodeSize - 1;
  for (let p = from; p < toExclusive; p++) {
    const slice = editor.state.doc.textBetween(p, p + 1);
    if (!slice.trim() || /\s/.test(slice)) continue;
    if (!editor.state.doc.rangeHasMark(p, p + 1, bold)) return false;
  }
  return true;
}

function collectOutline(editor: Editor): OutlineItem[] {
  const headings: OutlineItem[] = [];
  editor.state.doc.descendants((node, docPos) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent.trim().slice(0, 220),
        pos: docPos,
      });
    }
  });

  const hFiltered = headings.filter((it) => !isOrphanTitleFragment(it.text));

  if (hFiltered.length >= 2) return hFiltered;

  const extras: OutlineItem[] = [];
  const usedPos = new Set<number>();

  if (hFiltered.length < 2) {
    editor.state.doc.descendants((node, docPos) => {
      if (node.type.name !== 'paragraph') return;
      if (!isShortBoldOnlyParagraph(editor, docPos)) return;
      const text = node.textContent.trim().slice(0, 220);
      if (!text || isOrphanTitleFragment(text)) return;
      usedPos.add(docPos);
      extras.push({ level: 2, text, pos: docPos });
    });
  }

  editor.state.doc.descendants((node, docPos) => {
    if (node.type.name !== 'paragraph') return;
    if (usedPos.has(docPos)) return;
    const t = node.textContent.trim();
    if (t.length > 220) return;
    if (
      /^Módulo\s+\d+\s*[—–-]/i.test(t) ||
      /^\d+\s+Módulo\s+\d+/i.test(t) ||
      /^Plantillas?\s+y\s+diagramas/i.test(t) ||
      /^Glosario\b/i.test(t) ||
      /^SOPs\s+[—–-]/i.test(t)
    ) {
      extras.push({ level: 2, text: t.slice(0, 160), pos: docPos });
    }
  });

  const xFiltered = extras.filter((it) => !isOrphanTitleFragment(it.text));
  return hFiltered.length ? [...hFiltered, ...xFiltered] : xFiltered;
}

export function useEditorOutlineItems(editor: Editor | null): OutlineItem[] {
  const [items, setItems] = useState<OutlineItem[]>([]);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setItems(collectOutline(editor));
    refresh();
    editor.on('update', refresh);
    return () => {
      editor.off('update', refresh);
    };
  }, [editor]);

  return items;
}

function outlineNavEls(editor: Editor, items: OutlineItem[]) {
  return items
    .map((it) => {
      const dom = editor.view.nodeDOM(it.pos);
      return dom instanceof HTMLElement ? { el: dom, pos: it.pos } : null;
    })
    .filter((x): x is { el: HTMLElement; pos: number } => x !== null);
}

export function EditorDocumentOutline({
  editor,
  items,
  scrollRootRef,
  outlineSheetOpen,
  onOutlineSheetClose,
}: {
  editor: Editor | null;
  items: OutlineItem[];
  scrollRootRef?: RefObject<HTMLElement | null>;
  outlineSheetOpen?: boolean;
  onOutlineSheetClose?: () => void;
}) {
  const [activePos, setActivePos] = useState<number | null>(null);

  useEffect(() => {
    if (!editor || !scrollRootRef?.current || items.length === 0) {
      setActivePos(items[0]?.pos ?? null);
      return;
    }
    const root = scrollRootRef.current;
    const els = outlineNavEls(editor, items);
    if (els.length === 0) return;

    function updateActive() {
      const offset = 72;
      const topLimit = root.getBoundingClientRect().top + offset;
      let current = items[0].pos;
      for (const { el, pos } of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= topLimit) current = pos;
        else break;
      }
      setActivePos(current);
    }

    root.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
    return () => root.removeEventListener('scroll', updateActive);
  }, [editor, items, scrollRootRef]);

  function scrollTo(pos: number) {
    if (!editor) return;
    requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editor.chain().focus().setTextSelection(pos + 1).run();
      }
      onOutlineSheetClose?.();
    });
  }

  if (!editor) return null;

  const list = (onPick: (pos: number) => void) =>
    items.length === 0 ? (
      <p className="px-2.5 py-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        Aún no hay secciones. Usa <span className="font-medium text-[var(--foreground)]">H1, H2 o H3</span> en la barra para generar este índice.
      </p>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.pos}-${i}`}>
            <button
              type="button"
              onClick={() => onPick(item.pos)}
              className={cn(
                'w-full text-left text-xs leading-[1.45] rounded-lg px-2.5 py-2 min-h-[2.75rem] transition-colors border',
                activePos === item.pos
                  ? 'bg-[var(--accent)]/12 border-[var(--accent)]/40 text-[var(--foreground)] font-medium'
                  : 'hover:bg-[var(--muted)] text-[var(--foreground)] border-transparent hover:border-[var(--border)]',
                'line-clamp-4',
              )}
              style={{
                paddingLeft: `${8 + Math.min(4, Math.max(0, item.level - 1)) * 10}px`,
              }}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <nav
        className="hidden md:flex flex-col w-[15.5rem] shrink-0 border-r border-[var(--border)] bg-[var(--card)]/60 overflow-y-auto py-4 px-2 min-h-0 shadow-[inset_-1px_0_0_rgba(148,163,184,0.08)]"
        aria-label="Navegación en el documento"
      >
        <div className="sticky top-0 z-10 -mx-1 mb-3 px-2 pb-2 border-b border-[var(--border)]/80 bg-[var(--card)]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            <ListTree className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-hidden />
            En el documento
          </div>
        </div>
        {list(scrollTo)}
      </nav>

      {outlineSheetOpen && (
        <div className="md:hidden fixed inset-0 z-[45] flex flex-col bg-black/45 p-3 pt-10" role="dialog" aria-modal="true" aria-label="Índice del documento">
          <button
            type="button"
            className="absolute top-3 right-3 z-10 rounded-lg p-2 text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] shadow-md"
            onClick={() => onOutlineSheetClose?.()}
            aria-label="Cerrar índice"
          >
            <X className="w-5 h-5" />
          </button>
          <nav
            className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-xl"
            aria-label="Navegación en el documento"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
              <ListTree className="w-4 h-4 text-[var(--accent)]" aria-hidden />
              En el documento
            </div>
            {list(scrollTo)}
          </nav>
        </div>
      )}
    </>
  );
}
