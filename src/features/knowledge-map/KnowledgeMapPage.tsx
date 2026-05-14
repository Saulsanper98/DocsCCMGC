import { Link } from 'react-router-dom';
import { Network, ArrowLeft } from 'lucide-react';
import { Card } from '@/shared/components/ui/Card';
import { cn } from '@/shared/utils/cn';
import { KnowledgeGraph } from './KnowledgeGraph';

export function KnowledgeMapPage() {
  return (
    <div className="app-page-x w-full max-w-none space-y-6 py-8">
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Network className="h-8 w-8 text-[var(--accent)]" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Mapa de conocimiento</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Grafo interactivo: documentos enlazados a categorías y jerarquía de carpetas.
            </p>
          </div>
        </div>
      </div>

      <KnowledgeGraph />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card elevation="floating" className="space-y-2 p-4 text-xs text-[var(--muted-foreground)]">
          <p className="font-semibold text-[var(--foreground)]">Leyenda</p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
              Documento publicado
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500/80" aria-hidden />
              Categoría
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--border)] bg-[var(--muted)]" aria-hidden />
              Relación / agrupación
            </li>
          </ul>
        </Card>
        <Card elevation="floating" className="space-y-2 p-4 text-xs text-[var(--muted-foreground)]">
          <p>
            Arrastra nodos, usa la rueda para zoom. Los datos provienen de Supabase (categorías y documentos no archivados).
          </p>
        </Card>
      </div>
    </div>
  );
}
