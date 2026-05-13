import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/shared/utils/cn';

const STATIC: Record<string, string> = {
  documentos: 'Documentos',
  nuevo: 'Nuevo',
  editar: 'Editar',
  buscar: 'Búsqueda',
  copilot: 'Copilot IA',
  estadisticas: 'Estadísticas',
  notificaciones: 'Notificaciones',
  favoritos: 'Favoritos',
  recientes: 'Recientes',
  borradores: 'Borradores',
  archivados: 'Archivados',
  usuarios: 'Usuarios',
  admin: 'Administración',
  ayuda: 'Ayuda',
  mapa: 'Mapa de conocimiento',
  turno: 'Turno',
  perfil: 'Perfil',
};

function isUuid(seg: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seg);
}

function useNarrowNav(maxWidth = 640) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [maxWidth]);
  return narrow;
}

function useDocumentTitles(ids: string[]) {
  const key = ids.join('|');
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    void supabase
      .from('documents')
      .select('id,title')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTitles((prev) => {
          const next = { ...prev };
          for (const row of data) {
            next[row.id as string] = row.title as string;
          }
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, ids]);

  return titles;
}

export function PageBreadcrumb({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const narrow = useNarrowNav(640);

  const raw = useMemo(() => pathname.split('/').filter(Boolean), [pathname]);
  const uuidSegments = useMemo(() => raw.filter(isUuid), [raw]);
  const titleMap = useDocumentTitles(uuidSegments);

  const items = useMemo(() => {
    const out: { href: string; label: string; current: boolean }[] = [];
    let acc = '';
    for (let i = 0; i < raw.length; i++) {
      const seg = raw[i];
      acc += `/${seg}`;
      const isLast = i === raw.length - 1;

      let label: string;
      if (isUuid(seg)) {
        const t = titleMap[seg];
        const next = raw[i + 1];
        if (t) {
          label = t;
        } else if (next === 'editar') {
          label = 'Documento';
        } else {
          label = pathname.endsWith(seg) && !pathname.includes('/editar') ? 'Vista' : 'Documento';
        }
      } else if (STATIC[seg]) {
        label = STATIC[seg];
      } else {
        label = seg;
      }

      out.push({ href: acc, label, current: isLast });
    }
    return out;
  }, [raw, pathname, titleMap]);

  const displayItems = useMemo(() => {
    if (narrow && items.length > 3) {
      return [items[0], { href: '#', label: '…', current: false }, ...items.slice(-2)] as const;
    }
    return items;
  }, [narrow, items]);

  if (pathname === '/' || pathname === '/login') return null;
  if (items.length === 0) return null;

  return (
    <nav aria-label="Migas de pan" className={cn('app-page-x pt-3 pb-1 text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[var(--muted-foreground)]">
        <li className="flex min-w-0 items-center gap-1">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--muted)]/80 hover:text-[var(--foreground)]"
          >
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Inicio</span>
          </Link>
        </li>
        {displayItems.map((c, idx) => (
          <li key={`${c.href}-${idx}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
            {c.label === '…' ? (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[var(--muted-foreground)]" aria-hidden>
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Segmentos omitidos</span>
              </span>
            ) : c.current ? (
              <span
                className="truncate font-medium text-[var(--foreground)]"
                aria-current="page"
                title={c.label}
              >
                {c.label}
              </span>
            ) : (
              <Link
                to={c.href}
                className="truncate rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--muted)]/80 hover:text-[var(--foreground)]"
                title={c.label}
              >
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
