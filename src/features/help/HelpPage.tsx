import { Link } from 'react-router-dom';
import { Keyboard, ArrowLeft } from 'lucide-react';
import { Card } from '@/shared/components/ui/Card';
import { cn } from '@/shared/utils/cn';

const ROWS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + K', desc: 'Búsqueda global / paleta de comandos' },
  { keys: 'Ctrl + N', desc: 'Nuevo documento' },
  { keys: 'Ctrl + Shift + N', desc: 'Nota rápida (modal)' },
  { keys: 'Ctrl + S', desc: 'Guardar (en editor)' },
  { keys: 'Ctrl + /', desc: 'Atajos (modal)' },
];

export function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Ayuda y atajos</h1>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        Referencia rápida (Prompt V2). El mapa de conocimiento, panel de turno y flujos de revisión se irán
        completando en próximas iteraciones.
      </p>
      <Card elevation="raised" className="overflow-hidden divide-y divide-[var(--border)]">
        {ROWS.map((row) => (
          <div key={row.keys} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
            <kbd className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-xs whitespace-nowrap">
              {row.keys}
            </kbd>
            <span className="text-[var(--foreground)]">{row.desc}</span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-[var(--muted-foreground)]">
        En la paleta: escribe <code className="rounded bg-[var(--muted)] px-1">&gt;</code> para filtrar solo acciones,{' '}
        <code className="rounded bg-[var(--muted)] px-1">#</code> para buscar categorías.
      </p>
    </div>
  );
}
