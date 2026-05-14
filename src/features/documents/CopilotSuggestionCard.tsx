import { useMemo } from 'react';
import { Bot, Check, Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';
import { markdownToSafeHtml } from '@/lib/markdownToSafeHtml';

const previewClass =
  'copilot-suggestion-preview text-[13px] leading-relaxed text-violet-950 dark:text-violet-50 ' +
  '[&_p]:mb-2 [&_p:last-child]:mb-0 ' +
  '[&_ul]:my-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1 ' +
  '[&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 ' +
  '[&_li]:pl-0.5 ' +
  '[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-violet-950 dark:[&_h1]:text-violet-100 ' +
  '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-violet-900 dark:[&_h2]:text-violet-100 ' +
  '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-violet-900 dark:[&_h3]:text-violet-100 ' +
  '[&_strong]:font-semibold [&_em]:italic ' +
  '[&_code]:rounded [&_code]:bg-violet-950/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] dark:[&_code]:bg-violet-300/10 ' +
  '[&_pre]:my-2 [&_pre]:max-h-48 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-violet-200/60 [&_pre]:bg-violet-950/[0.04] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] dark:[&_pre]:border-violet-700/50 dark:[&_pre]:bg-black/25 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-violet-400/70 [&_blockquote]:pl-3 [&_blockquote]:text-violet-900/90 dark:[&_blockquote]:text-violet-100/90 ' +
  '[&_a]:text-violet-700 [&_a]:underline dark:[&_a]:text-violet-300 ' +
  '[&_hr]:my-4 [&_hr]:border-violet-200/60 dark:[&_hr]:border-violet-700/50 ' +
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[12px] ' +
  '[&_th]:border [&_th]:border-violet-200/70 [&_th]:bg-violet-100/50 [&_th]:px-2 [&_th]:py-1 dark:[&_th]:border-violet-700/50 dark:[&_th]:bg-violet-950/40 ' +
  '[&_td]:border [&_td]:border-violet-200/50 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-violet-700/40';

export function CopilotSuggestionCard({
  markdown,
  onAccept,
  onReject,
}: {
  markdown: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const html = useMemo(() => markdownToSafeHtml(markdown), [markdown]);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Markdown copiado');
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  }

  return (
    <div
      className={cn(
        'mx-4 mt-3 overflow-hidden rounded-lg border border-violet-300/55 bg-violet-50/40 dark:border-violet-800/55 dark:bg-violet-950/25',
      )}
      role="region"
      aria-label="Vista previa de la sugerencia del asistente"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/60 px-3 py-2.5 dark:border-violet-800/50">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900 dark:text-violet-100">
          <Bot className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
          Sugerencia del asistente
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-[var(--muted-foreground)]"
            onClick={() => void copyMarkdown()}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copiar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-[var(--muted-foreground)]"
            onClick={onReject}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Rechazar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 border border-emerald-600/30 bg-emerald-600/10 px-2 text-xs text-emerald-800 hover:bg-emerald-600/20 dark:text-emerald-200"
            onClick={onAccept}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Aceptar en el editor
          </Button>
        </div>
      </div>
      <div className="max-h-[min(50vh,26rem)] overflow-y-auto px-3 py-3">
        <div className={previewClass} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <p className="border-t border-violet-200/45 px-3 py-2 text-[10px] text-violet-800/70 dark:border-violet-800/40 dark:text-violet-200/65">
        Vista previa Markdown. Al aceptar se inserta en el editor respetando títulos y listas cuando TipTap lo permite.
      </p>
    </div>
  );
}
