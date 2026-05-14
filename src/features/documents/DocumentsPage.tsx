import { useState, useMemo, useRef, useEffect, useLayoutEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Plus, Grid, List, Table2, SlidersHorizontal,
  FileText, Star, StarOff, MoreVertical, Pencil, Archive, Trash2, Upload,
  ArrowDown, ArrowUp, CheckSquare, Square, Tag, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ImportModal } from './ImportModal';
import { useDocuments, isCategoryUuid } from './useDocuments';
import { pushRecentDocument } from '@/shared/utils/recentDocuments';
import { formatRelativeTime, formatAbsoluteDateTime } from '@/shared/utils/format';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Avatar } from '@/shared/components/ui/Avatar';
import { StatusBadge } from '@/shared/components/ui/Badge';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { DocumentCardSkeleton } from '@/shared/components/ui/Skeleton';
import { CategoryTree } from '@/features/categories/CategoryTree';
import { DocumentHealthBadge } from '@/features/documents/DocumentHealthBadge';
import { formatPrivacyEmail } from '@/shared/utils/formatPrivacy';
import { cn } from '@/shared/utils/cn';
import { useAppStore } from '@/app/store';
import type { Document, DocumentStatus } from '@/shared/types';

const TABLE_VIRTUAL_MIN = 25;

const STATUS_FILTER_LABEL: Record<DocumentStatus, string> = {
  draft: 'Borrador',
  review: 'Revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

const GROUP_COLLAPSE_STORAGE = 'docbrain_doc_catgroups_v1';

function readGroupCollapseMap(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(GROUP_COLLAPSE_STORAGE);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

interface DocumentsPageProps {
  filter?: 'favorites' | 'recent' | 'drafts' | 'archived' | 'mine';
}

/* Inline status change dropdown */
function StatusDropdown({
  doc,
  onStatusChange,
}: {
  doc: Document;
  onStatusChange: (id: string, status: DocumentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const statuses: { value: DocumentStatus; label: string }[] = [
    { value: 'draft', label: 'Borrador' },
    { value: 'review', label: 'Revisión' },
    { value: 'published', label: 'Publicado' },
    { value: 'archived', label: 'Archivado' },
  ];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      className="relative min-w-0 max-w-full"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="flex min-w-0 max-w-full items-center gap-0.5 overflow-hidden rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        title="Cambiar estado"
      >
        <StatusBadge
          status={doc.status}
          className="min-w-0 max-w-[6.75rem] shrink overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-[7.25rem]"
        />
        <ChevronDown className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-[120] w-36 rounded-xl border border-[var(--border)] bg-[var(--popover)] shadow-xl py-1 overflow-hidden">
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={(e) => { e.stopPropagation(); onStatusChange(doc.id, s.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[var(--muted)] transition-colors',
                  doc.status === s.value && 'font-semibold text-[var(--accent)]',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Bulk actions bar */
function BulkActionsBar({
  count,
  totalVisible,
  onPublishRequest,
  onArchiveRequest,
  onClear,
  onSelectAllVisible,
}: {
  count: number;
  totalVisible: number;
  onPublishRequest: () => void;
  onArchiveRequest: () => void;
  onClear: () => void;
  onSelectAllVisible: () => void;
}) {
  return (
    <div
      className={cn(
        'mx-[var(--page-gutter)] mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-white shadow-lg animate-[slideDown_200ms_var(--ease-smooth)]',
        'max-lg:sticky max-lg:bottom-0 max-lg:z-30 max-lg:rounded-b-none max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      )}
    >
      <span className="text-sm font-medium tabular-nums">
        {count} seleccionado{count !== 1 ? 's' : ''}
        {totalVisible > 0 && (
          <span className="ml-2 text-xs font-normal text-white/80">de {totalVisible} visibles</span>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {totalVisible > 0 && count < totalVisible ? (
          <Button size="xs" variant="ghost" className="text-white hover:bg-white/20" type="button" onClick={onSelectAllVisible}>
            Seleccionar todos
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" className="text-white hover:bg-white/20" onClick={onPublishRequest}>
          Publicar
        </Button>
        <Button size="xs" variant="ghost" className="text-white hover:bg-white/20" onClick={onArchiveRequest}>
          Archivar
        </Button>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg px-2 py-1 text-sm font-medium text-white/90 transition-colors hover:bg-white/15"
        aria-label="Cancelar selección"
      >
        Cancelar
      </button>
    </div>
  );
}

export function DocumentsPage({ filter }: DocumentsPageProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const urlFilter = params.get('filter') as DocumentsPageProps['filter'];
  const activeFilter = filter ?? urlFilter ?? undefined;
  const categoryParam = params.get('category');

  const { documentsViewMode, setDocumentsViewMode, sidebarMode, sidebarHoverExpanded, uiDensity, setUiDensity } =
    useAppStore();
  const navCollapsed = sidebarMode === 'collapsed' || (sidebarMode === 'hover' && !sidebarHoverExpanded);
  const [searchInput, setSearchInput] = useState(() => params.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => (params.get('q') ?? '').trim());
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>();
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('docbrain_docs_filters_open') === '1';
    } catch {
      return false;
    }
  });
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<'publish' | 'archive' | null>(null);
  const [staggerKey, setStaggerKey] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 320);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('q', debouncedSearch);
      else next.delete('q');
      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
  }, [debouncedSearch, setParams]);

  const searchDebouncing = searchInput.trim() !== debouncedSearch;

  useEffect(() => {
    try {
      sessionStorage.setItem('docbrain_docs_filters_open', showFilters ? '1' : '0');
    } catch {
      /* private mode */
    }
  }, [showFilters]);

  useEffect(() => {
    if (categoryParam && isCategoryUuid(categoryParam)) setSelectedCategory(categoryParam);
  }, [categoryParam]);

  const { documents, loading, error, refetch, deleteDocument, updateStatus, toggleFavorite } =
    useDocuments({
      filter: activeFilter,
      categoryId: selectedCategory,
      search: debouncedSearch || undefined,
      status: statusFilter,
    });

  // Re-trigger stagger animation when filters change
  useEffect(() => {
    setStaggerKey((k: number) => k + 1);
  }, [debouncedSearch, statusFilter, selectedCategory, documentsViewMode]);

  const pageTitle = {
    favorites: 'Favoritos', recent: 'Recientes', drafts: 'Borradores',
    archived: 'Archivados', mine: 'Mis documentos', undefined: 'Documentos',
  }[String(activeFilter)];

  const categories = useAppStore((s) => s.categories);
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory || !isCategoryUuid(selectedCategory)) return null;
    return categories.find((c) => c.id === selectedCategory)?.name ?? null;
  }, [categories, selectedCategory]);

  const [showDocContextTip, setShowDocContextTip] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('docbrain_docs_context_tip_hidden') !== '1';
    } catch {
      return true;
    }
  });

  function dismissDocContextTip() {
    try {
      localStorage.setItem('docbrain_docs_context_tip_hidden', '1');
    } catch {
      /* private mode */
    }
    setShowDocContextTip(false);
  }

  function clearAllFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedCategory(undefined);
    setStatusFilter(undefined);
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('q');
      n.delete('category');
      return n;
    }, { replace: true });
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); setSelectMode(false); }

  async function bulkPublish() {
    for (const id of selectedIds) await updateStatus(id, 'published');
    clearSelection();
  }
  async function bulkArchive() {
    for (const id of selectedIds) await updateStatus(id, 'archived');
    clearSelection();
  }

  /* Grouped docs by category */
  const groupedDocs = useMemo(() => {
    if (!groupByCategory) return null;
    const groups = new Map<string, { label: string; docs: Document[] }>();
    for (const doc of documents) {
      const key = doc.category?.id ?? '__none__';
      const label = doc.category?.name ?? 'Sin categoría';
      if (!groups.has(key)) groups.set(key, { label, docs: [] });
      groups.get(key)!.docs.push(doc);
    }
    return Array.from(groups.values());
  }, [documents, groupByCategory]);

  const hasActiveFilters = Boolean(
    debouncedSearch || (selectedCategory && isCategoryUuid(selectedCategory)) || statusFilter,
  );

  return (
    <>
    {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    <div className="docbrain-documents-bi-pane flex h-full min-w-0 overflow-hidden">
      {/* Category tree sidebar */}
      <div
        className={cn(
          'hidden md:flex md:w-64 md:flex-col border-r border-[var(--border)] overflow-y-auto shrink-0',
          'bg-gradient-to-b from-[var(--muted)]/35 via-[var(--background)] to-[var(--background)]',
        )}
      >
        <div className={cn('pt-4 pb-2', navCollapsed ? 'px-2.5' : 'px-3')}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Biblioteca
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)] leading-snug">
            Filtra por carpeta o vista rápida.
          </p>
        </div>
        <div className="flex-1 min-h-0 pb-4">
          <CategoryTree selectedId={selectedCategory} onSelect={setSelectedCategory} compact />
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setShowImport(true);
        }}
      >
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur-md shadow-[0_6px_28px_-10px_rgba(15,23,42,0.12)] dark:shadow-[0_6px_32px_-8px_rgba(0,0,0,0.5)] supports-[backdrop-filter]:bg-[var(--background)]/78">
          <div className="flex flex-col gap-3 app-page-x py-3 sm:flex-row sm:items-center sm:gap-4">
            <div
              className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
              role="search"
              aria-label="Buscar en la biblioteca actual"
            >
              <Input
                placeholder="Buscar por título o resumen…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                leftIcon={<FileText className="w-4 h-4" />}
                className="w-full min-w-0 sm:max-w-xl"
                aria-busy={searchDebouncing}
              />
              {searchDebouncing ? (
                <span className="text-xs text-[var(--muted-foreground)] sm:whitespace-nowrap">Buscando…</span>
              ) : null}
            </div>

            <div
              className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0"
              role="toolbar"
              aria-label="Vista y herramientas de documentos"
            >
              {(['list', 'grid', 'table'] as const).map((mode) => {
                const icons = { list: List, grid: Grid, table: Table2 };
                const Icon = icons[mode];
                const modeHint =
                  mode === 'list'
                    ? 'Filas con vista previa de metadatos'
                    : mode === 'grid'
                      ? 'Tarjetas para escanear muchos títulos'
                      : 'Columnas ordenables; ideal para muchos registros';
                return (
                  <Button
                    key={mode}
                    variant={documentsViewMode === mode ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setDocumentsViewMode(mode)}
                    aria-label={`Vista ${mode}`}
                    title={`Vista ${mode}: ${modeHint}`}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                );
              })}
              <Button
                variant={showFilters ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Filtros"
                title="Filtros: estado del documento (borrador, publicado…)"
                aria-expanded={showFilters}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
              <Button
                variant={selectMode ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => { setSelectMode(!selectMode); clearSelection(); }}
                aria-label="Selección múltiple"
                title="Selección múltiple: publicar o archivar varios a la vez"
                aria-pressed={selectMode}
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <Button
                variant={groupByCategory ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setGroupByCategory(!groupByCategory)}
                aria-label="Agrupar por categoría"
                title="Agrupar por categoría: secciones plegables por carpeta (lista y cuadrícula)"
                aria-pressed={groupByCategory}
              >
                <Tag className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant={uiDensity === 'compact' ? 'secondary' : 'ghost'}
                size="sm"
                className="hidden h-9 px-2.5 text-xs sm:inline-flex"
                onClick={() => setUiDensity(uiDensity === 'compact' ? 'comfortable' : 'compact')}
                title={uiDensity === 'compact' ? 'Más aire entre filas y tarjetas' : 'Vista más densa (lista, cuadrícula y tabla)'}
                aria-pressed={uiDensity === 'compact'}
              >
                {uiDensity === 'compact' ? 'Compacto' : 'Cómodo'}
              </Button>
            </div>

            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowImport(true)} title="Importar Word, PDF o Markdown">
              <Upload className="w-4 h-4" />
              Importar
            </Button>
            <Button variant="brand" size="sm" className="shrink-0 shadow-[var(--shadow-brand)]" onClick={() => navigate('/documentos/nuevo')}>
              <Plus className="w-4 h-4" />
              Nuevo
            </Button>
          </div>

          {/* Filters row */}
          {showFilters && (
            <div className="flex items-center gap-3 app-page-x py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/90">
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Estado:</span>
              {([undefined, 'draft', 'review', 'published', 'archived'] as Array<DocumentStatus | undefined>).map((s) => (
                <button
                  key={s ?? 'all'}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full transition-all duration-150',
                    statusFilter === s
                      ? 'bg-[var(--accent)] text-white shadow-sm scale-105'
                      : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--border)]'
                  )}
                >
                  {s ? { draft: 'Borrador', review: 'Revisión', published: 'Publicado', archived: 'Archivado' }[s] : 'Todos'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        {selectMode && selectedIds.size > 0 && (
          <div className="pt-2">
            <BulkActionsBar
              count={selectedIds.size}
              totalVisible={documents.length}
              onSelectAllVisible={() => setSelectedIds(new Set(documents.map((d) => d.id)))}
              onPublishRequest={() => setBulkConfirm('publish')}
              onArchiveRequest={() => setBulkConfirm('archive')}
              onClear={clearSelection}
            />
          </div>
        )}

        {/* Context strip */}
        {showDocContextTip ? (
          <div className="app-page-x pb-1 pt-4">
            <div className="relative rounded-2xl border border-[var(--border)]/70 bg-gradient-to-br from-[var(--card)]/80 to-[var(--muted)]/[0.08] px-4 py-3.5 shadow-[var(--shadow-sm)] sm:px-5 sm:py-4 dark:from-[var(--card)]/50 dark:to-[var(--muted)]/10">
              <button
                type="button"
                onClick={dismissDocContextTip}
                className="absolute right-3 top-3 rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                aria-label="Ocultar esta ayuda"
              >
                <span className="text-xs font-medium">Ocultar</span>
              </button>
              <p className="pr-16 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {activeFilter === undefined ? (
                  <>
                    <span className="font-medium text-[var(--foreground)]">Documentación operativa del CCMGC.</span>{' '}
                    Crea borradores, importa PDF o Word con maquetado legible y publica cuando esté validado.
                  </>
                ) : activeFilter === 'drafts' ? (
                  <>Borradores aún no visibles para todo el equipo. Revisa y publica cuando estén listos.</>
                ) : activeFilter === 'archived' ? (
                  <>Documentos archivados: consulta histórico sin mezclarlos con la biblioteca activa.</>
                ) : activeFilter === 'favorites' ? (
                  <>Acceso rápido a los documentos que marcaste como favoritos.</>
                ) : activeFilter === 'recent' ? (
                  <>Lo último que abriste o editaste en esta sesión y anteriores.</>
                ) : activeFilter === 'mine' ? (
                  <>Solo documentos de los que eres autor.</>
                ) : (
                  <>Vista filtrada de la biblioteca.</>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {/* Title */}
        <div className="app-page-x pb-3 pt-5 sm:pt-6">
          <h1 className="app-page-title text-balance tracking-tight">
            {pageTitle ?? 'Documentos'}
            {!loading && (
              <span className="ml-2 text-sm font-normal tabular-nums text-[var(--muted-foreground)]">
                ({documents.length})
              </span>
            )}
          </h1>
          <p id="documents-list-status" className="sr-only" aria-live="polite" aria-atomic="true">
            {loading ? 'Cargando documentos…' : `${documents.length} documentos en esta vista.`}
          </p>
          {hasActiveFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
              {debouncedSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                    setParams((p) => {
                      const n = new URLSearchParams(p);
                      n.delete('q');
                      return n;
                    }, { replace: true });
                  }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <span className="truncate">Búsqueda: «{debouncedSearch}»</span>
                  <span className="text-[var(--muted-foreground)]">×</span>
                </button>
              ) : null}
              {selectedCategory && isCategoryUuid(selectedCategory) ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(undefined);
                    setParams((p) => {
                      const n = new URLSearchParams(p);
                      n.delete('category');
                      return n;
                    }, { replace: true });
                  }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <span className="truncate">Categoría: {selectedCategoryName ?? '…'}</span>
                  <span className="text-[var(--muted-foreground)]">×</span>
                </button>
              ) : null}
              {statusFilter ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter(undefined)}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  Estado: {STATUS_FILTER_LABEL[statusFilter]}
                  <span className="text-[var(--muted-foreground)]">×</span>
                </button>
              ) : null}
              <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-[var(--accent)] hover:underline">
                Quitar todos
              </button>
            </div>
          ) : null}
        </div>

        {/* Documents list */}
        <div className="app-page-x pb-10 pt-1">
          {error ? (
            <div className="mt-8 text-center text-sm text-[var(--destructive)] space-y-3">
              <p className="font-medium">Error al cargar documentos</p>
              <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>Reintentar</Button>
            </div>
          ) : loading ? (
            <div className="space-y-2 mt-2">
              {Array.from({ length: 5 }).map((_, i) => <DocumentCardSkeleton key={i} />)}
            </div>
          ) : documents.length === 0 ? (
            hasActiveFilters ? (
              <div className="mt-6 space-y-4">
                <EmptyState
                  icon={FileText}
                  title="Ningún documento coincide"
                  description="Prueba a quitar la búsqueda, el estado o la categoría. También puedes ampliar la búsqueda a toda la biblioteca."
                  action={{ label: 'Limpiar filtros', onClick: clearAllFilters }}
                  secondaryAction={{ label: 'Ver todos los documentos', onClick: () => navigate('/documentos') }}
                />
                <p className="text-center text-sm text-[var(--muted-foreground)]">
                  <Link to="/buscar" className="font-medium text-[var(--accent)] hover:underline">
                    Búsqueda global en toda la biblioteca
                  </Link>
                </p>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No hay documentos"
                description="Crea tu primer documento o importa un archivo."
                action={{ label: 'Crear documento', onClick: () => navigate('/documentos/nuevo') }}
                secondaryAction={{ label: 'Importar', onClick: () => setShowImport(true) }}
              />
            )
          ) : groupedDocs && documentsViewMode !== 'table' ? (
            <div className="mt-2 space-y-5">
              {groupedDocs.map((group) => (
                <CategoryGroup
                  key={group.label}
                  group={group}
                  viewMode={documentsViewMode}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onDelete={deleteDocument}
                  onStatusChange={updateStatus}
                  onFavorite={toggleFavorite}
                  staggerKey={staggerKey}
                />
              ))}
            </div>
          ) : documentsViewMode === 'grid' ? (
            <div
              key={staggerKey}
              className={cn('mt-2 grid grid-cols-2 xl:grid-cols-3', uiDensity === 'compact' ? 'gap-3' : 'gap-4')}
            >
              {documents.map((doc, i) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onDelete={deleteDocument}
                  onStatusChange={updateStatus}
                  onFavorite={toggleFavorite}
                  selectMode={selectMode}
                  selected={selectedIds.has(doc.id)}
                  onToggleSelect={toggleSelect}
                  staggerIndex={i}
                />
              ))}
            </div>
          ) : documentsViewMode === 'table' ? (
            <DocumentTable docs={documents} onDelete={deleteDocument} onStatusChange={updateStatus} onFavorite={toggleFavorite} />
          ) : (
            <div
              key={staggerKey}
              className={cn(
                'mt-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-[var(--muted)]/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                uiDensity === 'compact' ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
              )}
            >
              <div className={cn('flex flex-col', uiDensity === 'compact' ? 'gap-2' : 'gap-2.5')}>
                {documents.map((doc, i) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onDelete={deleteDocument}
                    onStatusChange={updateStatus}
                    onFavorite={toggleFavorite}
                    selectMode={selectMode}
                    selected={selectedIds.has(doc.id)}
                    onToggleSelect={toggleSelect}
                    staggerIndex={i}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
    <AlertDialog.Root open={bulkConfirm !== null} onOpenChange={(v) => !v && setBulkConfirm(null)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[200] bg-[var(--overlay-scrim)]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[210] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
          <AlertDialog.Title className="text-base font-semibold text-[var(--foreground)]">
            {bulkConfirm === 'publish' ? 'Publicar selección' : 'Archivar selección'}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-[var(--muted-foreground)]">
            {bulkConfirm === 'publish' ? (
              <>Se publicará {selectedIds.size} documento(s). Pasarán a visibles según los permisos del equipo; podrás corregir cada ficha después.</>
            ) : (
              <>Se archivarán {selectedIds.size} documento(s). Dejarán de aparecer en la biblioteca activa; los lectores con enlace directo verán el estado archivado.</>
            )}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" size="sm" type="button">
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                void (bulkConfirm === 'publish' ? bulkPublish() : bulkArchive());
                setBulkConfirm(null);
              }}
            >
              Confirmar
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
    </>
  );
}

function CategoryGroup({
  group, viewMode, selectMode, selectedIds, onToggleSelect, onDelete, onStatusChange, onFavorite, staggerKey,
}: {
  group: { label: string; docs: Document[] };
  viewMode: 'list' | 'grid' | 'table';
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: DocumentStatus) => void;
  onFavorite: (id: string, f: boolean) => void;
  staggerKey: number;
}) {
  const groupKey = group.label;
  const [collapsed, setCollapsed] = useState(() => readGroupCollapseMap()[groupKey] ?? false);
  const categoryColor = group.docs[0]?.category?.color;
  const compact = useAppStore((s) => s.uiDensity === 'compact');

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        const map = readGroupCollapseMap();
        map[groupKey] = next;
        sessionStorage.setItem(GROUP_COLLAPSE_STORAGE, JSON.stringify(map));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]/75 bg-[var(--card)]/30 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.02] dark:bg-[var(--card)]/20 dark:ring-white/[0.04]">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-3 rounded-t-2xl border-b border-[var(--border)]/80 bg-gradient-to-r from-[var(--muted)]/70 to-[var(--muted)]/35 px-4 py-3 text-left transition-colors hover:from-[var(--muted)]/90 hover:to-[var(--muted)]/50"
      >
        {categoryColor && (
          <span className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-2 ring-[var(--background)]" style={{ background: categoryColor }} />
        )}
        <span className="flex-1 text-sm font-semibold tracking-tight text-[var(--foreground)]">{group.label}</span>
        <span className="rounded-full bg-[var(--background)]/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/60">
          {group.docs.length}
        </span>
        {collapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />}
      </button>
      {!collapsed && (
        viewMode === 'grid' ? (
          <div
            key={staggerKey}
            className={cn('grid grid-cols-2 xl:grid-cols-3', compact ? 'gap-3 p-2.5 sm:p-3' : 'gap-4 p-3 sm:p-4')}
          >
            {group.docs.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={onDelete} onStatusChange={onStatusChange} onFavorite={onFavorite} selectMode={selectMode} selected={selectedIds.has(doc.id)} onToggleSelect={onToggleSelect} staggerIndex={i} />
            ))}
          </div>
        ) : (
          <div
            key={staggerKey}
            className={cn(
              'flex flex-col rounded-b-2xl bg-[var(--muted)]/[0.08] dark:bg-[var(--muted)]/10',
              compact ? 'gap-2 p-2.5 sm:p-3' : 'gap-2.5 p-3 sm:p-4',
            )}
          >
            {group.docs.map((doc, i) => (
              <DocumentRow key={doc.id} doc={doc} onDelete={onDelete} onStatusChange={onStatusChange} onFavorite={onFavorite} selectMode={selectMode} selected={selectedIds.has(doc.id)} onToggleSelect={onToggleSelect} staggerIndex={i} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function DocumentRow({
  doc, onDelete, onStatusChange, onFavorite, selectMode, selected, onToggleSelect, staggerIndex = 0,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  staggerIndex?: number;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryColor = doc.category?.color;
  const uiDensity = useAppStore((s) => s.uiDensity);
  const compact = uiDensity === 'compact';
  const rowMin = compact ? 'min-h-[40px]' : 'min-h-[52px]';

  return (
    <div
      className={cn(
        'group relative flex items-stretch gap-0 overflow-hidden rounded-xl border',
        'bg-gradient-to-br from-[var(--card)] to-[var(--card)]/85',
        'shadow-sm ring-1 ring-transparent',
        'transition-[box-shadow,border-color,ring-width] duration-200',
        rowMin,
        'hover:border-[var(--accent)]/35 hover:shadow-md hover:ring-[var(--accent)]/12',
        selected
          ? 'border-[var(--accent)]/55 shadow-md ring-2 ring-[var(--accent)]/20'
          : 'border-[var(--border)]/75 dark:border-[var(--border)]/45',
      )}
      style={{ animationDelay: `${Math.min(staggerIndex * 30, 300)}ms` }}
    >
      {/* Category color accent bar */}
      {categoryColor && (
        <div
          className="w-1.5 shrink-0 self-stretch rounded-l-[10px] shadow-[inset_-1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.12)]"
          style={{ background: categoryColor }}
        />
      )}

      {/* Select checkbox */}
      {selectMode && (
        <button
          className="flex items-center px-3 text-[var(--muted-foreground)] transition-colors hover:text-[var(--accent)]"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.(doc.id); }}
          aria-label={selected ? 'Deseleccionar' : 'Seleccionar'}
        >
          {selected
            ? <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
            : <Square className="h-4 w-4" />
          }
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-stretch">
        <Link
          to={`/documentos/${doc.id}`}
          prefetch="intent"
          onClick={() => pushRecentDocument(doc.id, doc.title)}
          className={cn(
            'flex min-w-0 flex-1 items-center outline-none transition-colors hover:bg-[var(--muted)]/25 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset',
            compact ? 'gap-2.5 px-3 py-2 sm:px-4' : 'gap-3.5 px-4 py-3.5 sm:px-5',
          )}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.05] transition-transform duration-200 group-hover:scale-[1.03] dark:ring-white/[0.08]',
              compact ? 'h-9 w-9' : 'h-10 w-10',
            )}
            style={{ background: categoryColor ? `${categoryColor}22` : 'var(--muted)' }}
          >
            <FileText className="h-4 w-4" style={{ color: categoryColor ?? 'var(--muted-foreground)' }} />
          </div>

          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-semibold leading-snug tracking-tight text-[var(--foreground)]', compact ? 'text-sm' : 'text-[0.9375rem]')} title={doc.title}>
              {doc.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-snug text-[var(--muted-foreground)]">
              <span className="text-[var(--foreground)]/80">{doc.category?.name ?? 'Sin categoría'}</span>
              <span className="mx-1.5 text-[var(--border)]">·</span>
              <span>{doc.author?.full_name}</span>
            </p>
          </div>
        </Link>

        <div
          className={cn(
            'grid w-[12.5rem] shrink-0 grid-cols-[2rem_minmax(0,1fr)_1.75rem] items-center gap-x-1 border-l border-[var(--border)]/55 bg-gradient-to-l from-[var(--muted)]/45 to-transparent pl-2 pr-2 sm:w-48 sm:pr-3 dark:from-[var(--muted)]/30',
            compact ? 'py-1.5' : 'py-2.5',
          )}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative z-20 flex items-center justify-center">
            <DocumentHealthBadge doc={doc} className="max-sm:opacity-100" />
          </div>
          <div className="relative z-0 flex min-w-0 items-center justify-end gap-1 overflow-hidden opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
            <StatusDropdown doc={doc} onStatusChange={onStatusChange} />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavorite(doc.id, doc.is_favorite ?? false); }}
              className={cn(
                'shrink-0 p-1 rounded transition-all hover:scale-110',
                doc.is_favorite ? 'text-amber-400' : 'text-[var(--muted-foreground)] hover:text-amber-400',
              )}
              aria-label={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
              title={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
            >
              <Star className="w-3.5 h-3.5" fill={doc.is_favorite ? 'currentColor' : 'none'} />
            </button>
            <span
              className="max-w-[4.25rem] shrink-0 truncate text-right text-xs tabular-nums text-[var(--muted-foreground)]"
              title={formatAbsoluteDateTime(doc.updated_at)}
            >
              {formatRelativeTime(doc.updated_at)}
            </span>
          </div>
          <div className="relative shrink-0">
            <Button
              ref={menuTriggerRef}
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
              aria-label="Opciones"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
            {showMenu && (
              <DocumentMenu
                triggerRef={menuTriggerRef}
                doc={doc}
                onClose={() => setShowMenu(false)}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onFavorite={onFavorite}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  doc, onDelete, onStatusChange, onFavorite, selectMode, selected, onToggleSelect, staggerIndex = 0,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  staggerIndex?: number;
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryColor = doc.category?.color;
  const compact = useAppStore((s) => s.uiDensity) === 'compact';

  return (
    <div
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border stagger-item',
        'bg-gradient-to-b from-[var(--card)] to-[var(--card)]/88',
        'shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 dark:ring-white/[0.06]',
        compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5',
        'hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-lg motion-reduce:transform-none motion-reduce:hover:transform-none',
        selected
          ? 'border-[var(--accent)]/60 shadow-md ring-2 ring-[var(--accent)]/18'
          : 'border-[var(--border)]/70 dark:border-[var(--border)]/50',
      )}
      style={{ animationDelay: `${Math.min(staggerIndex * 30, 300)}ms` }}
      onClick={() => {
        if (selectMode) { onToggleSelect?.(doc.id); return; }
        pushRecentDocument(doc.id, doc.title);
        navigate(`/documentos/${doc.id}`);
      }}
    >
      {/* Category color top bar */}
      {categoryColor && (
        <div className="absolute left-0 right-0 top-0 h-[3px] rounded-t-2xl opacity-95" style={{ background: categoryColor }} />
      )}

      {/* Gradient bg subtle */}
      {categoryColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.22]"
          style={{ background: `radial-gradient(ellipse 120% 80% at 0% 0%, ${categoryColor}35, transparent 55%)` }}
        />
      )}

      <div className="relative">
        <div className={cn('flex items-start justify-between gap-2', compact ? 'mb-2' : 'mb-3')}>
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.05] transition-transform duration-200 group-hover:scale-105 dark:ring-white/[0.08]',
              compact ? 'h-9 w-9' : 'h-10 w-10',
            )}
            style={{ background: categoryColor ? `${categoryColor}24` : 'var(--muted)' }}
          >
            <FileText className={compact ? 'h-4 w-4' : 'h-5 w-5'} style={{ color: categoryColor ?? 'var(--muted-foreground)' }} />
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex h-9 w-8 shrink-0 items-center justify-center">
              <DocumentHealthBadge doc={doc} />
            </div>
            {selectMode ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(doc.id); }}
                className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--accent)]"
              >
                {selected ? <CheckSquare className="h-4 w-4 text-[var(--accent)]" /> : <Square className="h-4 w-4" />}
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavorite(doc.id, doc.is_favorite ?? false); }}
                  className={cn(
                    'p-1 rounded transition-all opacity-100 hover:scale-110 lg:opacity-0 lg:group-hover:opacity-100',
                    doc.is_favorite ? 'text-amber-400 lg:opacity-100' : 'text-[var(--muted-foreground)] hover:text-amber-400',
                  )}
                  aria-label={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
                >
                  <Star className="w-4 h-4" fill={doc.is_favorite ? 'currentColor' : 'none'} />
                </button>
                <div className="relative opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                  <Button
                    ref={menuTriggerRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                    aria-expanded={showMenu}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                  {showMenu && (
                    <DocumentMenu
                      triggerRef={menuTriggerRef}
                      doc={doc}
                      onClose={() => setShowMenu(false)}
                      onDelete={onDelete}
                      onStatusChange={onStatusChange}
                      onFavorite={onFavorite}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <h3
          className={cn(
            'mb-1.5 min-h-[2.5rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] line-clamp-2',
            compact ? 'text-[0.8125rem] min-h-[2.35rem]' : 'text-[0.9375rem]',
          )}
          title={doc.title}
        >
          {doc.title}
        </h3>
        {doc.summary?.trim() ? (
          <p
            className={cn(
              'mb-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]',
              compact && 'mb-1.5',
            )}
            title={doc.summary}
          >
            {doc.summary.trim()}
          </p>
        ) : null}
        <p className={cn('mb-3 truncate text-xs font-medium text-[var(--muted-foreground)]', compact && 'mb-2')}>
          {doc.category?.name ?? 'Sin categoría'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {doc.author && <Avatar name={doc.author.full_name} src={doc.author.avatar_url} size="sm" />}
            <span className="min-w-0 max-w-[min(11rem,45%)] truncate text-xs text-[var(--muted-foreground)]" title={doc.author?.full_name}>
              {doc.author?.full_name}
            </span>
          </div>
          <div className="shrink-0">
            <StatusDropdown doc={doc} onStatusChange={onStatusChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

type TableSortKey = 'title' | 'category' | 'author' | 'status' | 'updated';

function DocumentTableDeleteButton({ docId, docTitle, onDelete, buttonClassName }: { docId: string; docTitle: string; onDelete: (id: string) => void; buttonClassName?: string; }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className={cn('h-9 w-9', buttonClassName)} onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label="Eliminar documento">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-app-modal bg-[var(--overlay-scrim)] backdrop-blur-sm motion-reduce:backdrop-blur-none" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--glass-light)] p-5 shadow-xl outline-none backdrop-blur-xl dark:bg-[var(--glass-dark)] elev-3">
            <AlertDialog.Title className="text-base font-semibold text-[var(--foreground)]">¿Eliminar documento?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-[var(--muted-foreground)]">
              «{docTitle}» se eliminará permanentemente. Esta acción no se puede deshacer.
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild><Button variant="ghost" size="sm" type="button">Cancelar</Button></AlertDialog.Cancel>
              <Button size="sm" type="button" className="bg-[var(--destructive)] text-white hover:opacity-95" onClick={() => { onDelete(docId); setOpen(false); }}>Eliminar</Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

function DocumentTableActionsCell({
  doc,
  onDelete,
  onStatusChange,
  onFavorite,
  deleteButtonClassName,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
  deleteButtonClassName?: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button
        ref={menuTriggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        aria-label="Opciones del documento"
        aria-expanded={showMenu}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </Button>
      {showMenu ? (
        <DocumentMenu
          triggerRef={menuTriggerRef}
          doc={doc}
          onClose={() => setShowMenu(false)}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onFavorite={onFavorite}
        />
      ) : null}
      <DocumentTableDeleteButton docId={doc.id} docTitle={doc.title} onDelete={onDelete} buttonClassName={deleteButtonClassName} />
    </div>
  );
}

function DocumentTableVirtual({
  sorted,
  onDelete,
  onStatusChange,
  onFavorite,
  sortKey,
  sortDir,
  toggleColumn,
}: {
  sorted: Document[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
  sortKey: TableSortKey;
  sortDir: 'asc' | 'desc';
  toggleColumn: (key: TableSortKey) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const uiDensity = useAppStore((s) => s.uiDensity);
  const documentsTableDensity = useAppStore((s) => s.documentsTableDensity);
  const tableDense =
    documentsTableDensity === 'inherit'
      ? uiDensity
      : documentsTableDensity === 'compact'
        ? 'compact'
        : 'comfortable';
  const rowH = tableDense === 'compact' ? 40 : 54;
  const virtualizer = useVirtualizer({ count: sorted.length, getScrollElement: () => parentRef.current, estimateSize: () => rowH, overscan: 12 });

  const sortableColumns: { key: TableSortKey; label: string }[] = [
    { key: 'title', label: 'Título' }, { key: 'category', label: 'Categoría' },
    { key: 'author', label: 'Autor' }, { key: 'status', label: 'Estado' },
    { key: 'updated', label: 'Actualizado' },
  ];
  const tableGridVirtual = 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_100px_minmax(4.5rem,0.5fr)_7.5rem_4.5rem]';
  const totalSize = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm flex flex-col min-h-0">
      <p className="sr-only">Tabla virtualizada: {sorted.length} filas.</p>
      <div ref={parentRef} className="max-h-[min(70vh,640px)] min-h-[200px] overflow-auto">
        <div className="min-w-[720px]">
          <div
            className={cn(
              `sticky top-0 z-10 grid ${tableGridVirtual} app-table-numeric gap-1 border-b border-[var(--border)] bg-[var(--muted)]/95 text-left shadow-sm backdrop-blur-sm`,
              tableDense === 'compact' ? 'px-2.5 py-2' : 'px-3 py-2.5',
            )}
          >
            {sortableColumns.slice(0, 4).map((col) => (
              <div key={col.key} className="flex items-center">
                <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors min-h-11 md:min-h-0" onClick={() => toggleColumn(col.key)}>
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 shrink-0" />) : null}
                </button>
              </div>
            ))}
            <div className="flex items-center px-0.5"><span className="text-xs font-semibold text-[var(--foreground)]">Salud</span></div>
            <div className="flex items-center">
              <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors min-h-11 md:min-h-0" onClick={() => toggleColumn('updated')}>
                Actualizado
                {sortKey === 'updated' ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 shrink-0" />) : null}
              </button>
            </div>
            <div className="flex items-center justify-end pe-0.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">Acc.</span>
            </div>
          </div>
          <div className="relative" style={{ height: totalSize }}>
            {items.map((vi) => {
              const doc = sorted[vi.index];
              const catColor = doc.category?.color;
              return (
                <div
                  key={doc.id}
                  data-index={vi.index}
                  className={cn(
                    `absolute left-0 right-0 grid ${tableGridVirtual} gap-1 items-center border-b border-[var(--border)] px-3 transition-colors hover:bg-[var(--muted)]/50`,
                    vi.index % 2 === 1 ? 'bg-[var(--muted)]/20' : 'bg-[var(--card)]',
                  )}
                  style={{ transform: `translateY(${vi.start}px)`, height: vi.size }}
                >
                  {catColor && <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: catColor }} />}
                  <div className="min-w-0 py-1 font-medium text-[var(--foreground)]">
                    <Link
                      to={`/documentos/${doc.id}`}
                      prefetch="intent"
                      onClick={() => pushRecentDocument(doc.id, doc.title)}
                      className="block truncate text-sm text-[var(--accent)] hover:underline"
                      title={doc.title}
                    >
                      {doc.title}
                    </Link>
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)] truncate py-1">{doc.category?.name ?? '—'}</div>
                  <div className="py-1 min-w-0">
                    {doc.author && (
                      <div
                        className="flex items-center gap-1.5"
                        title={doc.author.email ? `Correo: ${formatPrivacyEmail(doc.author.email)}` : doc.author.full_name}
                      >
                        <Avatar name={doc.author.full_name} size="sm" />
                        <span className="text-sm text-[var(--muted-foreground)] truncate max-w-[100px]">{doc.author.full_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="py-1"><StatusBadge status={doc.status} /></div>
                  <div className="py-1 flex justify-start"><DocumentHealthBadge doc={doc} className="opacity-100" /></div>
                  <div className="whitespace-nowrap py-1 text-sm tabular-nums text-[var(--muted-foreground)]" title={formatAbsoluteDateTime(doc.updated_at)}>
                    {formatRelativeTime(doc.updated_at)}
                  </div>
                  <div className="flex justify-end py-1">
                    <DocumentTableActionsCell
                      doc={doc}
                      onDelete={onDelete}
                      onStatusChange={onStatusChange}
                      onFavorite={onFavorite}
                      deleteButtonClassName="opacity-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentTable({
  docs,
  onDelete,
  onStatusChange,
  onFavorite,
}: {
  docs: Document[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<TableSortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const uiDensity = useAppStore((s) => s.uiDensity);
  const documentsTableDensity = useAppStore((s) => s.documentsTableDensity);
  const tableDense =
    documentsTableDensity === 'inherit'
      ? uiDensity
      : documentsTableDensity === 'compact'
        ? 'compact'
        : 'comfortable';

  const sorted = useMemo(() => {
    const copy = [...docs];
    const mult = sortDir === 'asc' ? 1 : -1;
    const statusRank: Record<DocumentStatus, number> = { draft: 0, review: 1, published: 2, archived: 3 };
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title': cmp = (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' }); break;
        case 'category': cmp = (a.category?.name ?? '').localeCompare(b.category?.name ?? '', 'es'); break;
        case 'author': cmp = (a.author?.full_name ?? '').localeCompare(b.author?.full_name ?? '', 'es'); break;
        case 'status': cmp = statusRank[a.status] - statusRank[b.status]; break;
        case 'updated': cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
      }
      return cmp * mult;
    });
    return copy;
  }, [docs, sortKey, sortDir]);

  function toggleColumn(key: TableSortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'title' || key === 'category' || key === 'author' ? 'asc' : 'desc'); }
  }

  const columns: { key: TableSortKey; label: string }[] = [
    { key: 'title', label: 'Título' }, { key: 'category', label: 'Categoría' },
    { key: 'author', label: 'Autor' }, { key: 'status', label: 'Estado' }, { key: 'updated', label: 'Actualizado' },
  ];

  if (sorted.length >= TABLE_VIRTUAL_MIN) {
    return (
      <DocumentTableVirtual
        key={tableDense}
        sorted={sorted}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onFavorite={onFavorite}
        sortKey={sortKey}
        sortDir={sortDir}
        toggleColumn={toggleColumn}
      />
    );
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <table className="app-table-numeric w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
            {columns.slice(0, 4).map((col) => (
              <th key={col.key} className="text-left py-2.5 px-3">
                <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors min-h-[44px] md:min-h-0" onClick={() => toggleColumn(col.key)}>
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : null}
                </button>
              </th>
            ))}
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-[var(--foreground)]">Salud</th>
            <th className="text-left py-2.5 px-3">
              <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors min-h-[44px] md:min-h-0" onClick={() => toggleColumn('updated')}>
                Actualizado
                {sortKey === 'updated' ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : null}
              </button>
            </th>
            <th className="text-right py-2.5 px-2 text-xs font-semibold text-[var(--foreground)]">Acc.</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((doc) => (
            <DocumentTableRow
              key={doc.id}
              doc={doc}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onFavorite={onFavorite}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTableRow({
  doc,
  onDelete,
  onStatusChange,
  onFavorite,
}: {
  doc: Document;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
}) {
  const catColor = doc.category?.color;
  return (
    <tr className="border-b border-[var(--border)] last:border-0 group hover:bg-[var(--muted)]/50 transition-colors relative">
      {catColor && <td className="w-1 p-0"><div className="h-full w-1" style={{ background: catColor }} /></td>}
      <td className="py-2.5 px-3 font-medium text-[var(--foreground)] max-w-xs">
        <Link to={`/documentos/${doc.id}`} prefetch="intent" onClick={() => pushRecentDocument(doc.id, doc.title)} className="truncate block text-[var(--accent)] hover:underline">{doc.title}</Link>
      </td>
      <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{doc.category?.name ?? '—'}</td>
      <td className="py-2.5 px-3">
        {doc.author && (
          <div
            className="flex items-center gap-1.5"
            title={doc.author.email ? `Correo: ${formatPrivacyEmail(doc.author.email)}` : doc.author.full_name}
          >
            <Avatar name={doc.author.full_name} size="sm" />
            <span className="text-[var(--muted-foreground)] truncate max-w-[100px]">{doc.author.full_name}</span>
          </div>
        )}
      </td>
      <td className="py-2.5 px-3"><StatusBadge status={doc.status} /></td>
      <td className="py-2.5 px-3"><DocumentHealthBadge doc={doc} className="opacity-100 md:opacity-70 md:group-hover:opacity-100" /></td>
      <td className="py-2.5 px-3 text-[var(--muted-foreground)] whitespace-nowrap">{formatRelativeTime(doc.updated_at)}</td>
      <td className="py-2.5 px-2 text-right">
        <DocumentTableActionsCell
          doc={doc}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onFavorite={onFavorite}
          deleteButtonClassName="opacity-70 md:opacity-0 md:group-hover:opacity-100 max-sm:opacity-100"
        />
      </td>
    </tr>
  );
}

const DOCUMENT_MENU_WIDTH = 208;
const DOCUMENT_MENU_GAP = 8;
/** Altura aproximada del menú (acciones + borrar); evita salirse por abajo del viewport. */
const DOCUMENT_MENU_EST_HEIGHT = 240;

function DocumentMenu({
  doc,
  triggerRef,
  onClose,
  onDelete,
  onStatusChange,
  onFavorite,
}: {
  doc: Document;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus) => void;
  onFavorite: (id: string, isFav: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionar al pathname
  }, [location.pathname]);

  useLayoutEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    const position = () => {
      const r = el.getBoundingClientRect();
      let left = r.right - DOCUMENT_MENU_WIDTH;
      left = Math.max(
        DOCUMENT_MENU_GAP,
        Math.min(left, window.innerWidth - DOCUMENT_MENU_WIDTH - DOCUMENT_MENU_GAP),
      );

      let top = r.bottom + DOCUMENT_MENU_GAP;
      if (top + DOCUMENT_MENU_EST_HEIGHT > window.innerHeight - DOCUMENT_MENU_GAP) {
        top = r.top - DOCUMENT_MENU_EST_HEIGHT - DOCUMENT_MENU_GAP;
      }
      if (top < DOCUMENT_MENU_GAP) {
        top = DOCUMENT_MENU_GAP;
      }
      setCoords({ top, left });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [triggerRef, confirmDelete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handle(fn: () => void) {
    fn();
    onClose();
  }

  if (typeof document === 'undefined' || coords === null) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[140]" aria-hidden onClick={onClose} />
      <div
        role="menu"
        style={{ top: coords.top, left: coords.left, width: DOCUMENT_MENU_WIDTH }}
        className="fixed z-[150] bg-[var(--glass-light)] dark:bg-[var(--glass-dark)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-xl ring-1 ring-black/[0.06] dark:ring-white/10 overflow-hidden animate-[scaleIn_150ms_var(--ease-spring)]"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmDelete ? (
          <div className="p-3">
            <p className="text-xs text-[var(--foreground)] mb-2 font-medium">¿Eliminar «{doc.title}»?</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handle(() => onDelete(doc.id));
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {[
              { icon: Pencil, label: 'Editar', action: () => navigate(`/documentos/${doc.id}/editar`) },
              {
                icon: doc.status === 'published' ? Archive : Star,
                label: doc.status === 'published' ? 'Archivar' : 'Publicar',
                action: () => onStatusChange(doc.id, doc.status === 'published' ? 'archived' : 'published'),
              },
              {
                icon: doc.is_favorite ? StarOff : Star,
                label: doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito',
                action: () => onFavorite(doc.id, doc.is_favorite ?? false),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  handle(item.action);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left text-[var(--foreground)]"
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-[var(--border)]">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left text-[var(--destructive)]"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
