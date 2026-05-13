import DOMPurify from 'dompurify';
import { marked } from 'marked';

let markedReady = false;

function ensureMarked(): void {
  if (markedReady) return;
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  markedReady = true;
}

/**
 * Markdown del asistente → HTML seguro para `dangerouslySetInnerHTML` o TipTap `setContent`.
 */
export function markdownToSafeHtml(markdown: string): string {
  ensureMarked();
  const raw = marked(markdown.trim() || '_Sin contenido_', { async: false });
  if (typeof raw !== 'string') {
    throw new Error('Salida Markdown inesperada');
  }
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}
