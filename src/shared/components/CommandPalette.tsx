import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Upload, Star, ArrowRight, X, FileText, BarChart2, Bell, Clock,
  Folder, Terminal, Settings,
} from 'lucide-react';
import { useAppStore } from '@/app/store';
import { supabase } from '@/lib/supabase';
import { cn } from '@/shared/utils/cn';
import { formatSearchShortcut } from '@/shared/utils/platform';
import { getRecentDocuments, pushRecentDocument } from '@/shared/utils/recentDocuments';
import { useAnimatedListItem } from '@/shared/hooks/useAnimatedList';
import type { Category, Document } from '@/shared/types';

const CMD_HISTORY_KEY = 'docbrain_cmd_palette_history_v1';

function readCmdHistory(): string[] {
  try {
    const raw = localStorage.getItem(CMD_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushCmdHistory(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  const prev = readCmdHistory().filter((x) => x !== t);
  const next = [t, ...prev].slice(0, 5);
  localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(next));
}

function flattenCategories(cats: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const c of nodes) {
      out.push(c);
      if (c.children?.length) walk(c.children);
    }
  };
  walk(cats);
  return out;
}

interface CommandItem {
  id: string;
  type: 'document' | 'category' | 'action' | 'history';
  label: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  /** Resalta coincidencia del término de búsqueda en el título */
  highlightQuery?: string;
  /** Si es documento, id para vista previa en panel derecho */
  documentId?: string;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  const before = text.slice(0, idx);
  const mid = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="rounded bg-amber-200/90 px-0.5 text-[var(--foreground)] dark:bg-amber-500/30">
        {mid}
      </mark>
      {after}
    </>
  );
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, categories } = useAppStore();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [docResults, setDocResults] = useState<Document[]>([]);
  const [recentEntries, setRecentEntries] = useState(() => getRecentDocuments());
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery('');
    setActiveIndex(0);
    setPreviewDoc(null);
    setPreviewLoading(false);
  }, [setCommandPaletteOpen]);

  const prefixMode = query.startsWith('>') ? 'actions' : query.startsWith('#') ? 'categories' : null;
  const bare = prefixMode ? query.slice(1).trim() : query.trim();
  const showHomeSections = !prefixMode && !query.trim();

  const quickActions: CommandItem[] = useMemo(
    () => [
      { id: 'new-doc', type: 'action', label: 'Crear nuevo documento', icon: Plus, action: () => { navigate('/documentos/nuevo'); close(); } },
      { id: 'import', type: 'action', label: 'Importar archivo (Word, PDF, MD)', icon: Upload, action: () => { navigate('/documentos'); close(); } },
      { id: 'my-docs', type: 'action', label: 'Mis documentos', icon: Star, action: () => { navigate('/documentos?filter=mine'); close(); } },
      { id: 'search', type: 'action', label: 'Búsqueda avanzada', icon: Search, action: () => { navigate('/buscar'); close(); } },
      { id: 'notifications', type: 'action', label: 'Notificaciones', icon: Bell, action: () => { navigate('/notificaciones'); close(); } },
      { id: 'admin', type: 'action', label: 'Administración', icon: Settings, action: () => { navigate('/admin'); close(); } },
      { id: 'analytics', type: 'action', label: 'Estadísticas', icon: BarChart2, action: () => { navigate('/estadisticas'); close(); } },
      { id: 'mapa', type: 'action', label: 'Mapa de conocimiento', icon: Folder, action: () => { navigate('/mapa'); close(); } },
    ],
    [navigate, close],
  );

  const searchDocs = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || prefixMode === 'actions' || prefixMode === 'categories') {
        setDocResults([]);
        return;
      }
      const { data } = await supabase
        .from('documents')
        .select('id,title,summary,content_text,status,updated_at,category:categories!category_id(name)')
        .ilike('title', `%${q}%`)
        .neq('status', 'archived')
        .limit(8);
      setDocResults((data ?? []) as unknown as Document[]);
    },
    [prefixMode],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void searchDocs(bare);
    }, 150);
    return () => clearTimeout(t);
  }, [bare, searchDocs]);

  const filteredActions = useMemo(() => {
    const q = (prefixMode === 'actions' ? bare : query.trim()).toLowerCase();
    if (!q) return quickActions;
    return quickActions.filter((a) => a.label.toLowerCase().includes(q));
  }, [quickActions, query, bare, prefixMode]);

  const flatCats = useMemo(() => flattenCategories(categories), [categories]);

  const categoryItems: CommandItem[] = useMemo(() => {
    if (prefixMode !== 'categories') return [];
    const q = bare.toLowerCase();
    const list = !q
      ? flatCats.slice(0, 10)
      : flatCats.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
    return list.map((c) => ({
      id: `cat-${c.id}`,
      type: 'category' as const,
      label: c.name,
      subtitle: 'Ir a documentos filtrados',
      icon: Folder,
      action: () => {
        pushCmdHistory(`#${bare || c.name}`);
        navigate(`/documentos?category=${c.id}`);
        close();
      },
    }));
  }, [prefixMode, bare, flatCats, navigate, close]);

  const docItems: CommandItem[] = useMemo(
    () =>
      docResults.map((d) => ({
        id: d.id,
        type: 'document' as const,
        label: d.title,
        subtitle: d.category?.name,
        icon: FileText,
        documentId: d.id,
        highlightQuery: bare,
        action: () => {
          pushCmdHistory(query.trim());
          pushRecentDocument(d.id, d.title);
          navigate(`/documentos/${d.id}`);
          close();
        },
      })),
    [docResults, navigate, close, query, bare],
  );

  const recentItems: CommandItem[] = useMemo(
    () =>
      recentEntries.slice(0, 6).map((r) => ({
        id: `recent-${r.id}`,
        type: 'document' as const,
        label: r.title,
        subtitle: 'Reciente',
        icon: Clock,
        documentId: r.id,
        action: () => {
          pushRecentDocument(r.id, r.title);
          navigate(`/documentos/${r.id}`);
          close();
        },
      })),
    [recentEntries, navigate, close],
  );

  const historyItems: CommandItem[] = useMemo(
    () =>
      cmdHistory.map((h, i) => ({
        id: `hist-${i}-${h}`,
        type: 'history' as const,
        label: h,
        subtitle: 'Búsqueda reciente',
        icon: Terminal,
        action: () => {
          setQuery(h);
        },
      })),
    [cmdHistory],
  );

  const allItems = useMemo(() => {
    if (prefixMode === 'actions') return [...filteredActions];
    if (prefixMode === 'categories') return [...categoryItems];
    if (bare) return [...docItems, ...filteredActions];
    return [...historyItems, ...recentItems, ...filteredActions];
  }, [prefixMode, bare, docItems, filteredActions, categoryItems, historyItems, recentItems]);

  const previewTargetId = allItems[activeIndex]?.documentId;

  useEffect(() => {
    setActiveIndex((i) => {
      if (allItems.length === 0) return 0;
      return Math.min(i, allItems.length - 1);
    });
  }, [allItems.length]);

  useEffect(() => {
    if (!commandPaletteOpen || !previewTargetId) {
      setPreviewDoc(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void supabase
      .from('documents')
      .select('id,title,summary,content_text,status,updated_at,category:categories!category_id(name)')
      .eq('id', previewTargetId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setPreviewLoading(false);
        if (error || !data) {
          setPreviewDoc(null);
          return;
        }
        setPreviewDoc(data as unknown as Document);
      });
    return () => {
      cancelled = true;
    };
  }, [previewTargetId, commandPaletteOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        close();
      }
      if (e.key === 'ArrowDown' && commandPaletteOpen) {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, allItems.length - 1)));
      }
      if (e.key === 'ArrowUp' && commandPaletteOpen) {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && commandPaletteOpen && allItems[activeIndex]) {
        e.preventDefault();
        allItems[activeIndex].action();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, activeIndex, allItems, setCommandPaletteOpen, close]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setRecentEntries(getRecentDocuments());
      setCmdHistory(readCmdHistory());
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIndex(0);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-app-command flex items-start justify-center pt-[12vh] px-4"
      data-docbrain-overlay
      onClick={close}
      aria-modal="true"
      role="dialog"
      aria-label="Paleta de comandos"
    >
      <div className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-md motion-reduce:backdrop-blur-none" />

      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl ring-1 ring-black/[0.06] dark:ring-white/12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            placeholder="Buscar…  ·  > acciones  ·  # categorías  ·  Ctrl+K"
            aria-label="Buscar en la paleta"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden h-5 rounded border border-[var(--border)] px-1.5 font-mono text-[10px] text-[var(--muted-foreground)] sm:flex">
            ESC
          </kbd>
        </div>

        <div className="grid max-h-[min(68vh,520px)] min-h-[280px] grid-cols-1 lg:grid-cols-[1fr_min(32%,300px)]">
        <div className="max-h-[min(68vh,520px)] overflow-y-auto border-[var(--border)] py-2 lg:border-r">
          {allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              {bare ? (
                <div className="space-y-2">
                  <p>
                    Sin resultados para «{query}»
                  </p>
                  <p className="text-xs">
                    Prueba con <kbd className="rounded border border-[var(--border)] px-1 font-mono">&gt;</kbd> solo acciones,{' '}
                    <kbd className="rounded border border-[var(--border)] px-1 font-mono">#</kbd> categorías o más de dos letras.
                  </p>
                </div>
              ) : (
                'Sin elementos'
              )}
            </div>
          ) : (
            <>
              {showHomeSections && historyItems.length > 0 && (
                <div className="px-3 py-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Historial
                  </p>
                </div>
              )}
              {showHomeSections &&
                historyItems.map((item, index) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    index={index}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                  />
                ))}
              {showHomeSections && recentItems.length > 0 && (
                <div className={cn('px-3 py-1', historyItems.length > 0 && 'mt-1')}>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Recientes
                  </p>
                </div>
              )}
              {showHomeSections &&
                recentItems.map((item, index) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    index={historyItems.length + index}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                  />
                ))}
              {prefixMode === 'categories' && categoryItems.length > 0 && (
                <div className="px-3 py-1 mt-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Categorías
                  </p>
                </div>
              )}
              {prefixMode === 'categories' &&
                categoryItems.map((item, index) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    index={index}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                  />
                ))}
              {bare && !prefixMode && docItems.length > 0 && (
                <div className="px-3 py-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Documentos
                  </p>
                </div>
              )}
              {bare &&
                !prefixMode &&
                docItems.map((item, index) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    index={index}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                  />
                ))}
              {(() => {
                const docOffset = bare && !prefixMode ? docItems.length : 0;
                const recentOffset = showHomeSections ? historyItems.length + recentItems.length : 0;
                const actionOffset =
                  prefixMode === 'actions' ? 0 : prefixMode === 'categories' ? categoryItems.length : docOffset + recentOffset;
                const showActionsSection =
                  filteredActions.length > 0 &&
                  prefixMode !== 'categories' &&
                  (prefixMode === 'actions' ||
                    (bare && !prefixMode) ||
                    showHomeSections);
                const showActionHeading =
                  showActionsSection &&
                  (prefixMode === 'actions' ||
                    (bare && !prefixMode && docItems.length > 0) ||
                    (showHomeSections && (recentItems.length > 0 || historyItems.length > 0)));
                return (
                  <>
                    {showActionHeading && (
                      <div
                        className={cn(
                          'px-3 py-1 mt-1 border-t border-[var(--border)]',
                          showHomeSections && 'border-t-0 mt-0',
                        )}
                      >
                        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                          {prefixMode === 'actions' ? 'Acciones' : 'Acciones rápidas'}
                        </p>
                      </div>
                    )}
                    {showActionsSection &&
                      filteredActions.map((item, index) => (
                        <CommandRow
                          key={item.id}
                          item={item}
                          index={actionOffset + index}
                          activeIndex={activeIndex}
                          setActiveIndex={setActiveIndex}
                        />
                      ))}
                  </>
                );
              })()}
            </>
          )}
        </div>

        <aside
          className="hidden max-h-[min(68vh,520px)] flex-col border-t border-[var(--border)] bg-[var(--muted)]/25 p-4 lg:flex lg:border-t-0 lg:border-l"
          aria-label="Vista previa del documento"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Vista previa
          </p>
          {!previewTargetId && (
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              Selecciona un documento en la lista (resultados o recientes) para ver resumen y extracto del contenido.
            </p>
          )}
          {previewTargetId && previewLoading && (
            <div className="space-y-2">
              <div className="h-4 w-[72%] max-w-[14rem] animate-pulse rounded bg-[var(--muted)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--muted)]" />
              <div className="h-3 w-[83%] max-w-[12rem] animate-pulse rounded bg-[var(--muted)]" />
            </div>
          )}
          {previewTargetId && !previewLoading && previewDoc && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-sm">
              <p className="font-semibold leading-snug text-[var(--foreground)]">{previewDoc.title}</p>
              {previewDoc.category && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {(previewDoc.category as { name?: string }).name ?? ''}
                </p>
              )}
              <p className="text-[10px] uppercase text-[var(--muted-foreground)]">
                Estado: {(previewDoc.status as string) ?? '—'}
              </p>
              {previewDoc.summary ? (
                <p className="text-xs leading-relaxed text-[var(--foreground)]">{previewDoc.summary}</p>
              ) : (
                <p className="text-xs italic text-[var(--muted-foreground)]">Sin resumen</p>
              )}
              <p className="mt-1 line-clamp-12 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted-foreground)]">
                {(previewDoc.content_text ?? '').slice(0, 1200)}
                {(previewDoc.content_text?.length ?? 0) > 1200 ? '…' : ''}
              </p>
            </div>
          )}
          {previewTargetId && !previewLoading && !previewDoc && (
            <p className="text-xs text-[var(--destructive)]">No se pudo cargar la vista previa.</p>
          )}
        </aside>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted-foreground)]">
          <span className="hidden sm:inline">
            <kbd className="rounded border border-[var(--border)] px-1 py-0.5 font-mono text-[10px]">
              {formatSearchShortcut()}
            </kbd>{' '}
            Abrir · cerrar
          </span>
          <span>
            <kbd className="font-mono">↑↓</kbd> Navegar
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> Seleccionar
          </span>
          <span className="text-[var(--muted-foreground)]/80">&gt; solo acciones · # categorías</span>
        </div>
      </div>
    </div>
  );
}

function CommandRow({
  item,
  index,
  activeIndex,
  setActiveIndex,
}: {
  item: CommandItem;
  index: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}) {
  const { style } = useAnimatedListItem(index, 20);
  const active = activeIndex === index;
  const labelNode = item.highlightQuery ? (
    <HighlightMatch text={item.label} query={item.highlightQuery} />
  ) : (
    item.label
  );
  return (
    <button
      type="button"
      onClick={item.action}
      style={style}
      className={cn(
        'command-palette-row-stagger w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left rounded-lg mx-1 border-l-2',
        active
          ? 'bg-[var(--surface-highlight)] text-[var(--foreground)] border-l-[var(--accent)] shadow-sm'
          : 'text-[var(--foreground)] border-l-transparent hover:bg-[var(--muted)]',
      )}
      onMouseEnter={() => setActiveIndex(index)}
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center shrink-0">
        <item.icon className="w-4 h-4 text-[var(--muted-foreground)]" strokeWidth={2} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" title={item.label}>
          {labelNode}
        </p>
        {item.subtitle && <p className="text-xs text-[var(--muted-foreground)] truncate">{item.subtitle}</p>}
      </div>
      <ArrowRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}
