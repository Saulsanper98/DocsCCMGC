import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Avatar } from '@/shared/components/ui/Avatar';
import { StatusBadge } from '@/shared/components/ui/Badge';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { DocumentCardSkeleton } from '@/shared/components/ui/Skeleton';
import { CategoryTree } from '@/features/categories/CategoryTree';
import { DocumentHealthBadge } from '@/features/documents/DocumentHealthBadge';
import { formatRelativeTime, formatAbsoluteDateTime } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import { useAppStore } from '@/app/store';
import type { Document, DocumentStatus } from '@/shared/types';

const TABLE_VIRTUAL_MIN = 25;

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
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        title="Cambiar estado"
      >
        <StatusBadge status={doc.status} />
        <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
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
  onPublish,
  onArchive,
  onClear,
}: {
  count: number;
  onPublish: () => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mx-[var(--page-gutter)] mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-white shadow-lg animate-[slideDown_200ms_var(--ease-smooth)]">
      <span className="text-sm font-medium tabular-nums">
        {count} seleccionado{count !== 1 ? 's' : ''}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="ghost" className="text-white hover:bg-white/20" onClick={onPublish}>
          Publicar
        </Button>
        <Button size="xs" variant="ghost" className="text-white hover:bg-white/20" onClick={onArchive}>
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
  const [params] = useSearchParams();
  const urlFilter = params.get('filter') as DocumentsPageProps['filter'];
  const activeFilter = filter ?? urlFilter ?? undefined;
  const categoryParam = params.get('category');

  const { documentsViewMode, setDocumentsViewMode, sidebarMode, sidebarHoverExpanded, uiDensity, setUiDensity } =
    useAppStore();
  const navCollapsed = sidebarMode === 'collapsed' || (sidebarMode === 'hover' && !sidebarHoverExpanded);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [staggerKey, setStaggerKey] = useState(0);

  useEffect(() => {
    if (categoryParam && isCategoryUuid(categoryParam)) setSelectedCategory(categoryParam);
  }, [categoryParam]);

  const { documents, loading, error, refetch, deleteDocument, updateStatus, toggleFavorite } =
    useDocuments({ filter: activeFilter, categoryId: selectedCategory, search: search || undefined, status: statusFilter });

  // Re-trigger stagger animation when filters change
  useEffect(() => { setStaggerKey(k => k + 1); }, [search, statusFilter, selectedCategory, documentsViewMode]);

  const pageTitle = {
    favorites: 'Favoritos', recent: 'Recientes', drafts: 'Borradores',
    archived: 'Archivados', mine: 'Mis documentos', undefined: 'Documentos',
  }[String(activeFilter)];

  const hasActiveFilters = Boolean(search.trim() || (selectedCategory && isCategoryUuid(selectedCategory)) || statusFilter);

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

  return (
    <>
    {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    <div className="flex h-full overflow-hidden">
      {/* Category tree sidebar */}
      <div
        className={cn(
          'hidden md:flex md:w-60 md:flex-col border-r border-[var(--border)] overflow-y-auto shrink-0',
          'bg-gradient-to-b from-[var(--muted)]/35 via-[var(--background)] to-[var(--background)]',
          navCollapsed && 'md:pl-2',
        )}
      >
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Biblioteca
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)] leading-snug">
            Filtra por carpeta o vista rápida.
          </p>
        </div>
        <div className="flex-1 min-h-0 pb-4">
          <CategoryTree selectedId={selectedCategory} onSelect={setSelectedCategory} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur-md shadow-[0_6px_28px_-10px_rgba(15,23,42,0.12)] dark:shadow-[0_6px_32px_-8px_rgba(0,0,0,0.5)] supports-[backdrop-filter]:bg-[var(--background)]/78">
          <div className="flex flex-col gap-3 app-page-x py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Input
                placeholder="Buscar por título, autor o contenido…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<FileText className="w-4 h-4" />}
                className="w-full min-w-0 sm:max-w-xl"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
              {(['list', 'grid', 'table'] as const).map((mode) => {
                const icons = { list: List, grid: Grid, table: Table2 };
                const Icon = icons[mode];
                return (
                  <Button
                    key={mode}
                    variant={documentsViewMode === mode ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setDocumentsViewMode(mode)}
                    aria-label={`Vista ${mode}`}
                    title={`Vista ${mode}`}
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
                title="Filtros"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
              <Button
                variant={selectMode ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => { setSelectMode(!selectMode); clearSelection(); }}
                aria-label="Selección múltiple"
                title="Selección múltiple"
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <Button
                variant={groupByCategory ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setGroupByCategory(!groupByCategory)}
                aria-label="Agrupar por categoría"
                title="Agrupar por categoría"
              >
                <Tag className="w-4 h-4" />
              </Button>
              <Button
                variant={uiDensity === 'compact' ? 'secondary' : 'ghost'}
                size="sm"
                className="hidden h-9 px-2.5 text-xs sm:inline-flex"
                onClick={() => setUiDensity(uiDensity === 'compact' ? 'comfortable' : 'compact')}
                title={uiDensity === 'compact' ? 'Más aire entre filas' : 'Filas más bajas en lista y tabla'}
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
            <BulkActionsBar count={selectedIds.size} onPublish={bulkPublish} onArchive={bulkArchive} onClear={clearSelection} />
          </div>
        )}

        {/* Context strip */}
        <div className="app-page-x pt-4 pb-1">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--card)]/50 px-4 py-3 shadow-[var(--shadow-sm)] sm:px-5 sm:py-3.5">
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
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

        {/* Title */}
        <div className="app-page-x pt-3 pb-2">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl sm:tracking-tight">
            {pageTitle ?? 'Documentos'}
            {!loading && (
              <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                ({documents.length})
              </span>
            )}
          </h1>
        </div>

        {/* Documents list */}
        <div className="app-page-x pb-8">
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
              <EmptyState
                icon={FileText}
                title="Ningún documento coincide"
                description="Prueba a quitar la búsqueda, el estado o la categoría."
                action={{ label: 'Limpiar filtros', onClick: () => { setSearch(''); setSelectedCategory(undefined); setStatusFilter(undefined); } }}
                secondaryAction={{ label: 'Ver todos los documentos', onClick: () => navigate('/documentos') }}
              />
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
            <div className="space-y-4 mt-2">
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
            <div key={staggerKey} className="grid grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
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
            <DocumentTable docs={documents} onDelete={deleteDocument} />
          ) : (
            <div key={staggerKey} className="space-y-1 mt-2">
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
          )}
        </div>
        </div>
      </div>
    </div>
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
  const [collapsed, setCollapsed] = useState(false);
  const categoryColor = group.docs[0]?.category?.color;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-[var(--muted)]/60 hover:bg-[var(--muted)] transition-colors text-left border-b border-[var(--border)]"
      >
        {categoryColor && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryColor }} />
        )}
        <span className="text-sm font-semibold text-[var(--foreground)] flex-1">{group.label}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{group.docs.length}</span>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
      </button>
      {!collapsed && (
        viewMode === 'grid' ? (
          <div key={staggerKey} className="grid grid-cols-2 xl:grid-cols-3 gap-3 p-3">
            {group.docs.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={onDelete} onStatusChange={onStatusChange} onFavorite={onFavorite} selectMode={selectMode} selected={selectedIds.has(doc.id)} onToggleSelect={onToggleSelect} staggerIndex={i} />
            ))}
          </div>
        ) : (
          <div key={staggerKey} className="divide-y divide-[var(--border)]">
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
  const categoryColor = doc.category?.color;
  const uiDensity = useAppStore((s) => s.uiDensity);
  const rowMin = uiDensity === 'compact' ? 'min-h-[44px]' : 'min-h-[48px]';

  return (
    <div
      className={cn(
        'group flex items-stretch gap-0 rounded-lg border bg-[var(--card)] shadow-sm transition-all duration-150 stagger-item',
        rowMin,
        'hover:border-[var(--accent)]/45 hover:shadow-[var(--shadow-sm)] hover:-translate-y-px',
        selected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : 'border-[var(--border)]',
      )}
      style={{ animationDelay: `${Math.min(staggerIndex * 30, 300)}ms` }}
    >
      {/* Category color accent bar */}
      {categoryColor && (
        <div className="w-1 shrink-0 rounded-l-lg" style={{ background: categoryColor }} />
      )}

      {/* Select checkbox */}
      {selectMode && (
        <button
          className="flex items-center px-3 text-[var(--muted-foreground)] hover:text-[var(--accent)]"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.(doc.id); }}
          aria-label={selected ? 'Deseleccionar' : 'Seleccionar'}
        >
          {selected
            ? <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
            : <Square className="h-4 w-4" />
          }
        </button>
      )}

      <Link
        to={`/documentos/${doc.id}`}
        prefetch="intent"
        onClick={() => pushRecentDocument(doc.id, doc.title)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset rounded-l-lg"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
          style={{ background: categoryColor ? `${categoryColor}20` : 'var(--muted)' }}
        >
          <FileText className="w-4 h-4" style={{ color: categoryColor ?? 'var(--muted-foreground)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]" title={doc.title}>
            {doc.title}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] truncate">
            {doc.category?.name ?? 'Sin categoría'} · {doc.author?.full_name}
          </p>
        </div>
      </Link>

      <div
        className="flex shrink-0 items-center gap-2 py-3 pr-3 pl-3 sm:pl-4"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DocumentHealthBadge doc={doc} className="max-sm:opacity-100" />
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
          {/* Inline status change */}
          <StatusDropdown doc={doc} onStatusChange={onStatusChange} />
          {/* Favorite star */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavorite(doc.id, doc.is_favorite ?? false); }}
            className={cn(
              'p-1 rounded transition-all hover:scale-110',
              doc.is_favorite ? 'text-amber-400' : 'text-[var(--muted-foreground)] hover:text-amber-400',
            )}
            aria-label={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
            title={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
          >
            <Star className="w-3.5 h-3.5" fill={doc.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <span
            className="whitespace-nowrap text-xs tabular-nums text-[var(--muted-foreground)]"
            title={formatAbsoluteDateTime(doc.updated_at)}
          >
            {formatRelativeTime(doc.updated_at)}
          </span>
        </div>
        <div className="relative">
          <Button
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
            <DocumentMenu doc={doc} onClose={() => setShowMenu(false)} onDelete={onDelete} onStatusChange={onStatusChange} onFavorite={onFavorite} />
          )}
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
  const categoryColor = doc.category?.color;

  return (
    <div
      className={cn(
        'group relative p-4 rounded-xl border bg-[var(--card)] shadow-sm cursor-pointer stagger-item',
        'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
        selected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : 'border-[var(--border)] hover:border-[var(--accent)]/45',
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
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: categoryColor }} />
      )}

      {/* Gradient bg subtle */}
      {categoryColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-30"
          style={{ background: `radial-gradient(ellipse at top left, ${categoryColor}20, transparent 60%)` }}
        />
      )}

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: categoryColor ? `${categoryColor}20` : 'var(--muted)' }}
          >
            <FileText className="w-5 h-5" style={{ color: categoryColor ?? 'var(--muted-foreground)' }} />
          </div>
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
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
                    'p-1 rounded transition-all opacity-0 group-hover:opacity-100 hover:scale-110',
                    doc.is_favorite ? 'opacity-100 text-amber-400' : 'text-[var(--muted-foreground)] hover:text-amber-400',
                  )}
                  aria-label={doc.is_favorite ? 'Quitar favorito' : 'Marcar favorito'}
                >
                  <Star className="w-4 h-4" fill={doc.is_favorite ? 'currentColor' : 'none'} />
                </button>
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity max-sm:opacity-100">
                  <Button
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
                    <DocumentMenu doc={doc} onClose={() => setShowMenu(false)} onDelete={onDelete} onStatusChange={onStatusChange} onFavorite={onFavorite} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <h3 className="mb-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-[var(--foreground)] line-clamp-2" title={doc.title}>
          {doc.title}
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-3 truncate">{doc.category?.name ?? 'Sin categoría'}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {doc.author && <Avatar name={doc.author.full_name} src={doc.author.avatar_url} size="sm" />}
            <span className="max-w-[80px] truncate text-xs text-[var(--muted-foreground)]">{doc.author?.full_name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <DocumentHealthBadge doc={doc} />
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

function DocumentTableVirtual({ sorted, onDelete, sortKey, sortDir, toggleColumn }: { sorted: Document[]; onDelete: (id: string) => void; sortKey: TableSortKey; sortDir: 'asc' | 'desc'; toggleColumn: (key: TableSortKey) => void; }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const uiDensity = useAppStore((s) => s.uiDensity);
  const rowH = uiDensity === 'compact' ? 44 : 52;
  const virtualizer = useVirtualizer({ count: sorted.length, getScrollElement: () => parentRef.current, estimateSize: () => rowH, overscan: 12 });

  const sortableColumns: { key: TableSortKey; label: string }[] = [
    { key: 'title', label: 'Título' }, { key: 'category', label: 'Categoría' },
    { key: 'author', label: 'Autor' }, { key: 'status', label: 'Estado' },
    { key: 'updated', label: 'Actualizado' },
  ];
  const tableGridVirtual = 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_100px_minmax(4.5rem,0.5fr)_7.5rem_3rem]';
  const totalSize = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm flex flex-col min-h-0">
      <p className="sr-only">Tabla virtualizada: {sorted.length} filas.</p>
      <div ref={parentRef} className="max-h-[min(70vh,640px)] min-h-[200px] overflow-auto">
        <div className="min-w-[720px]">
          <div className={`sticky top-0 z-10 grid ${tableGridVirtual} gap-1 border-b border-[var(--border)] bg-[var(--muted)]/95 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm`}>
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
            <div className="w-12" aria-hidden />
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
                      <div className="flex items-center gap-1.5">
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
                    <DocumentTableDeleteButton docId={doc.id} docTitle={doc.title} onDelete={onDelete} buttonClassName="opacity-100" />
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

function DocumentTable({ docs, onDelete }: { docs: Document[]; onDelete: (id: string) => void; }) {
  const [sortKey, setSortKey] = useState<TableSortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
    return <DocumentTableVirtual sorted={sorted} onDelete={onDelete} sortKey={sortKey} sortDir={sortDir} toggleColumn={toggleColumn} />;
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
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
            <th className="w-12" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {sorted.map((doc) => <DocumentTableRow key={doc.id} doc={doc} onDelete={onDelete} />)}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTableRow({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void; }) {
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
          <div className="flex items-center gap-1.5">
            <Avatar name={doc.author.full_name} size="sm" />
            <span className="text-[var(--muted-foreground)] truncate max-w-[100px]">{doc.author.full_name}</span>
          </div>
        )}
      </td>
      <td className="py-2.5 px-3"><StatusBadge status={doc.status} /></td>
      <td className="py-2.5 px-3"><DocumentHealthBadge doc={doc} className="opacity-100 md:opacity-70 md:group-hover:opacity-100" /></td>
      <td className="py-2.5 px-3 text-[var(--muted-foreground)] whitespace-nowrap">{formatRelativeTime(doc.updated_at)}</td>
      <td className="py-2.5 px-3 text-right">
        <DocumentTableDeleteButton docId={doc.id} docTitle={doc.title} onDelete={onDelete} buttonClassName="opacity-70 md:opacity-0 md:group-hover:opacity-100 max-sm:opacity-100" />
      </td>
    </tr>
  );
}

function DocumentMenu({ doc, onClose, onDelete, onStatusChange, onFavorite }: { doc: Document; onClose: () => void; onDelete: (id: string) => void; onStatusChange: (id: string, status: DocumentStatus) => void; onFavorite: (id: string, isFav: boolean) => void; }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handle(fn: () => void) { fn(); onClose(); }

  return (
    <>
      <div className="fixed inset-0 z-[100]" aria-hidden onClick={onClose} />
      <div className="absolute right-0 top-8 z-[110] w-52 bg-[var(--glass-light)] dark:bg-[var(--glass-dark)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-xl ring-1 ring-black/[0.06] dark:ring-white/10 overflow-hidden animate-[scaleIn_150ms_var(--ease-spring)]">
        {confirmDelete ? (
          <div className="p-3">
            <p className="text-xs text-[var(--foreground)] mb-2 font-medium">¿Eliminar «{doc.title}»?</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-3">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button size="sm" className="flex-1 h-7 text-xs bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white" onClick={(e) => { e.stopPropagation(); handle(() => onDelete(doc.id)); }}>Eliminar</Button>
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
              <button key={item.label} onClick={(e) => { e.stopPropagation(); handle(item.action); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left text-[var(--foreground)]">
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-[var(--border)]">
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left text-[var(--destructive)]">
                <Trash2 className="w-4 h-4 shrink-0" />
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
