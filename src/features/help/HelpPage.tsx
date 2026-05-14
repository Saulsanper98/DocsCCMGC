import { Link } from 'react-router-dom';
import { Keyboard, ArrowLeft, Palette, Eye, Timer } from 'lucide-react';
import { Card } from '@/shared/components/ui/Card';
import { cn } from '@/shared/utils/cn';
import { formatModLabel } from '@/shared/utils/platform';
import { isCopilotUiEnabled } from '@/lib/featureFlags';

export function HelpPage() {
  const m = formatModLabel();

  const globalRows = [
    { keys: `${m} + K`, desc: 'Búsqueda global / paleta de comandos' },
    { keys: `${m} + N`, desc: 'Nuevo documento' },
    { keys: `${m} + Shift + N`, desc: 'Nota rápida (modal)' },
    { keys: `${m} + /`, desc: 'Atajos (modal)' },
  ];

  const editorRows = [
    { keys: `${m} + S`, desc: 'Guardar (en editor)' },
    { keys: `${m} + E`, desc: 'Vista previa en editor' },
  ];

  const copilotRows = isCopilotUiEnabled()
    ? [{ keys: `${m} + Shift + C`, desc: 'Abrir panel Copilot' }]
    : [];

  return (
    <div className="app-page-x w-full max-w-none space-y-8 py-8">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium',
            'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Keyboard className="h-8 w-8 text-[var(--accent)]" aria-hidden />
        <h1 className="app-page-title text-2xl font-bold text-[var(--foreground)]">Ayuda y atajos</h1>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
        Referencia rápida. En macOS, <strong className="font-medium text-[var(--foreground)]">{m}</strong> sustituye a Ctrl en la mayoría de atajos.
      </p>

      <section aria-labelledby="help-shortcuts-global">
        <h2 id="help-shortcuts-global" className="text-sm font-semibold text-[var(--foreground)] mb-2">
          Aplicación
        </h2>
        <Card elevation="raised" className="overflow-hidden divide-y divide-[var(--border)]">
          {globalRows.map((row) => (
            <div key={row.keys} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <kbd className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-xs whitespace-nowrap">
                {row.keys}
              </kbd>
              <span className="text-[var(--foreground)]">{row.desc}</span>
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="help-shortcuts-editor">
        <h2 id="help-shortcuts-editor" className="text-sm font-semibold text-[var(--foreground)] mb-2">
          Editor
        </h2>
        <Card elevation="raised" className="overflow-hidden divide-y divide-[var(--border)]">
          {editorRows.map((row) => (
            <div key={row.keys} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <kbd className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-xs whitespace-nowrap">
                {row.keys}
              </kbd>
              <span className="text-[var(--foreground)]">{row.desc}</span>
            </div>
          ))}
        </Card>
      </section>

      {copilotRows.length > 0 && (
        <section aria-labelledby="help-shortcuts-copilot">
          <h2 id="help-shortcuts-copilot" className="text-sm font-semibold text-[var(--foreground)] mb-2">
            Copilot
          </h2>
          <Card elevation="raised" className="overflow-hidden divide-y divide-[var(--border)]">
            {copilotRows.map((row) => (
              <div key={row.keys} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <kbd className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-xs whitespace-nowrap">
                  {row.keys}
                </kbd>
                <span className="text-[var(--foreground)]">{row.desc}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section aria-labelledby="help-palette" className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-2">
        <h2 id="help-palette" className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
          <Palette className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          Paleta de comandos
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Escribe <code className="rounded bg-[var(--muted)] px-1">&gt;</code> para filtrar solo acciones,{' '}
          <code className="rounded bg-[var(--muted)] px-1">#</code> para buscar categorías. Usa flechas y Enter para elegir; Esc cierra.
        </p>
      </section>

      <section aria-labelledby="help-comfort" className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-2">
        <h2 id="help-comfort" className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          Comodidad visual
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          En la cabecera, el menú de comodidad permite alto contraste, modo lectura con menos brillo, densidad de la tabla de documentos, pie compacto y recordatorios de pausa.
        </p>
      </section>

      <section aria-labelledby="help-motion" className="flex gap-2 text-xs text-[var(--muted-foreground)]">
        <Timer className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <p id="help-motion">
          Si activas <span className="text-[var(--foreground)]">«reducir movimiento»</span> en el sistema, las animaciones de la app se atenúan automáticamente donde el CSS lo respeta.
        </p>
      </section>
    </div>
  );
}
