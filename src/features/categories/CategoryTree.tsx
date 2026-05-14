import { useMemo, useState, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Clock,
  FileX2,
  Archive,
  ClipboardList,
  AlertTriangle,
  Landmark,
  Monitor,
  BarChart2,
  Users,
  Scale,
  Wrench,
  FormInput,
  Siren,
  GripVertical,
} from 'lucide-react';
import { useCategories } from './useCategories';
import { cn } from '@/shared/utils/cn';
import type { Category } from '@/shared/types';

const iconMap: Record<string, React.ElementType> = {
  folder: Folder,
  star: Star,
  clock: Clock,
  'file-x': FileX2,
  archive: Archive,
  'clipboard-list': ClipboardList,
  'alert-triangle': AlertTriangle,
  landmark: Landmark,
  monitor: Monitor,
  'bar-chart': BarChart2,
  users: Users,
  scale: Scale,
  wrench: Wrench,
  'form-input': FormInput,
  siren: Siren,
};

const systemItems = [
  { id: 'favorites', label: 'Favoritos', icon: Star, to: '/favoritos' },
  { id: 'recent', label: 'Recientes', icon: Clock, to: '/recientes' },
  { id: 'drafts', label: 'Borradores', icon: FileX2, to: '/borradores' },
  { id: 'archived', label: 'Archivados', icon: Archive, to: '/archivados' },
];

interface CategoryTreeProps {
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  /** Menos padding horizontal cuando el rail principal está colapsado (más útil en documentos). */
  compact?: boolean;
}

export function CategoryTree({ selectedId, onSelect, compact }: CategoryTreeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tree, loading, createCategory, deleteCategory, reorderRootCategories, updateCategory } = useCategories();
  const [filterText, setFilterText] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const saveRename = useCallback(async () => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (!name) return;
    await updateCategory(renamingId, { name });
    setRenamingId(null);
    setRenameDraft('');
  }, [renamingId, renameDraft, updateCategory]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameDraft('');
  }, []);

  const beginRename = useCallback((id: string, name: string) => {
    setRenamingId(id);
    setRenameDraft(name);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredRoots = useMemo(
    () =>
      tree.filter((cat) => !filterText || cat.name.toLowerCase().includes(filterText.toLowerCase())),
    [tree, filterText],
  );

  const dndRoots = !filterText.trim();

  async function handleCreate() {
    if (!newCatName.trim()) return;
    await createCategory(newCatName.trim());
    setNewCatName('');
    setShowNewInput(false);
  }

  function handleRootDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tree.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void reorderRootCategories(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-2">
        <input
          type="text"
          placeholder="Filtrar categorías…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className={cn(
            'w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:ring-1 focus:ring-[var(--ring)]',
            filterText.trim() && 'ring-2 ring-[var(--accent)]/25',
          )}
        />
        {!dndRoots && filterText.trim() ? (
          <p className="mt-2 rounded-md bg-[var(--muted)]/50 px-2 py-1.5 text-[10px] leading-snug text-[var(--muted-foreground)]">
            Quita el texto del filtro para poder reordenar las carpetas raíz con el asa ⋮⋮.
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className={cn('mb-1', compact ? 'px-2.5' : 'px-2')}>
          <p
            className={cn(
              'py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]',
              compact ? 'px-0' : 'px-2',
            )}
          >
            Sistema
          </p>
          {systemItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.to);
                  onSelect(undefined);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md py-1.5 text-xs transition-colors',
                  compact ? 'px-2.5' : 'px-2',
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className={compact ? 'px-2.5' : 'px-2'}>
          <div className={cn('flex items-center justify-between py-1', compact ? 'px-0' : 'px-2')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Categorías
            </p>
            <button
              type="button"
              onClick={() => setShowNewInput(true)}
              className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              aria-label="Nueva categoría"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showNewInput && (
            <div className="mb-1 flex items-center gap-1 px-0">
              <input
                autoFocus
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                  if (e.key === 'Escape') setShowNewInput(false);
                }}
                placeholder="Nombre de categoría"
                className="flex-1 rounded border border-[var(--accent)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
              />
            </div>
          )}

          {loading ? (
            <div className={cn('space-y-1', compact ? 'px-0' : 'px-2')}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-[var(--muted)]" />
              ))}
            </div>
          ) : dndRoots ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
              <SortableContext items={tree.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {tree.map((cat) => (
                  <SortableRootCategory
                    key={cat.id}
                    category={cat}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDelete={deleteCategory}
                    onAdd={createCategory}
                    filter={filterText}
                    compact={compact}
                    ancestors={[]}
                    renamingId={renamingId}
                    renameDraft={renameDraft}
                    onRenameDraftChange={setRenameDraft}
                    onBeginRename={beginRename}
                    onSaveRename={saveRename}
                    onCancelRename={cancelRename}
                  />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="space-y-0.5">
              {filteredRoots.map((cat) => (
                <CategoryNode
                  key={cat.id}
                  category={cat}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onDelete={deleteCategory}
                  onAdd={createCategory}
                  level={0}
                  filter={filterText}
                  compact={compact}
                  ancestors={[]}
                  renamingId={renamingId}
                  renameDraft={renameDraft}
                  onRenameDraftChange={setRenameDraft}
                  onBeginRename={beginRename}
                  onSaveRename={saveRename}
                  onCancelRename={cancelRename}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableRootCategory({
  category,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
  filter,
  compact,
  ancestors,
  renamingId,
  renameDraft,
  onRenameDraftChange,
  onBeginRename,
  onSaveRename,
  onCancelRename,
}: {
  category: Category;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string, parentId?: string) => void;
  filter: string;
  compact?: boolean;
  ancestors: string[];
  renamingId: string | null;
  renameDraft: string;
  onRenameDraftChange: (s: string) => void;
  onBeginRename: (id: string, name: string) => void;
  onSaveRename: () => void | Promise<void>;
  onCancelRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('rounded-md', isDragging && 'z-10 bg-[var(--muted)]/40 opacity-90 ring-1 ring-[var(--border)]')}
    >
      <CategoryNode
        category={category}
        selectedId={selectedId}
        onSelect={onSelect}
        onDelete={onDelete}
        onAdd={onAdd}
        level={0}
        filter={filter}
        compact={compact}
        ancestors={ancestors}
        renamingId={renamingId}
        renameDraft={renameDraft}
        onRenameDraftChange={onRenameDraftChange}
        onBeginRename={onBeginRename}
        onSaveRename={onSaveRename}
        onCancelRename={onCancelRename}
        dragHandle={
          <button
            type="button"
            className={cn(
              'hidden shrink-0 cursor-grab touch-none rounded p-0.5 text-[var(--muted-foreground)] md:flex',
              'hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            )}
            aria-label={`Reordenar categoría ${category.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
      />
    </div>
  );
}

function CategoryNode({
  category,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
  level,
  filter,
  dragHandle,
  compact,
  ancestors,
  renamingId,
  renameDraft,
  onRenameDraftChange,
  onBeginRename,
  onSaveRename,
  onCancelRename,
}: {
  category: Category;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string, parentId?: string) => void;
  level: number;
  filter: string;
  dragHandle?: ReactNode;
  compact?: boolean;
  ancestors: string[];
  renamingId: string | null;
  renameDraft: string;
  onRenameDraftChange: (s: string) => void;
  onBeginRename: (id: string, name: string) => void;
  onSaveRename: () => void | Promise<void>;
  onCancelRename: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const hasChildren = (category.children?.length ?? 0) > 0;
  const Icon = iconMap[category.icon] ?? Folder;
  const OpenIcon = hasChildren && open ? FolderOpen : Icon;
  const isSelected = selectedId === category.id;
  const breadcrumbTitle =
    ancestors.length > 0 ? `${ancestors.join(' › ')} › ${category.name}` : category.name;

  const padStep = compact ? 10 : 12;
  /** Nivel 0: solo padding de clase (evita style paddingLeft:0 que anula pl-*). Anidados: sangría en px. */
  const paddingLeftStyle = level > 0 ? { paddingLeft: level * padStep } : undefined;
  const rowPadX = compact ? 'pl-3.5 pr-2' : level === 0 ? 'pl-1 pr-2' : 'px-2';

  return (
    <div>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1 rounded-md py-1.5 text-xs transition-colors',
          rowPadX,
          isSelected ? 'bg-[var(--accent)] text-white' : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
        )}
        style={paddingLeftStyle}
        onClick={() => onSelect(category.id)}
      >
        {level === 0 && dragHandle ? <span className="flex shrink-0 items-center">{dragHandle}</span> : null}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="shrink-0"
            aria-expanded={open}
            aria-label={open ? 'Contraer' : 'Expandir'}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        {!hasChildren && <span className="h-3 w-3 shrink-0" />}

        <span className="h-3.5 w-3.5 shrink-0" style={{ color: isSelected ? 'white' : category.color }}>
          <OpenIcon className="h-full w-full" />
        </span>

        {renamingId === category.id ? (
          <div
            className="flex min-w-0 flex-1 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => onRenameDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  void onSaveRename();
                }
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onCancelRename();
                }
              }}
              className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-white"
              onClick={() => void onSaveRename()}
            >
              OK
            </button>
            <button type="button" className="shrink-0 text-[10px] text-[var(--muted-foreground)]" onClick={onCancelRename}>
              ✕
            </button>
          </div>
        ) : (
          <span className="flex-1 truncate" title={breadcrumbTitle}>
            {category.name}
          </span>
        )}

        {category.document_count !== undefined && category.document_count > 0 && (
          <span className={cn('text-[10px]', isSelected ? 'text-white/70' : 'text-[var(--muted-foreground)]')}>
            {category.document_count}
          </span>
        )}

        <div className="relative max-lg:opacity-100 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded p-0.5 hover:bg-black/10"
            aria-label="Más acciones"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-5 z-20 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg">
                {[
                  {
                    icon: Plus,
                    label: 'Añadir sub',
                    action: () => {
                      void onAdd('Nueva subcategoría', category.id);
                      setShowMenu(false);
                    },
                  },
                  { icon: Pencil, label: 'Renombrar', action: () => { onBeginRename(category.id, category.name); setShowMenu(false); } },
                  {
                    icon: Trash2,
                    label: 'Eliminar',
                    action: () => {
                      if (
                        !window.confirm(
                          `¿Eliminar la categoría «${category.name}»? Los documentos pueden quedar sin carpeta si no se reasignan.`,
                        )
                      ) {
                        setShowMenu(false);
                        return;
                      }
                      void onDelete(category.id);
                      setShowMenu(false);
                    },
                    danger: true,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.action();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--muted)]',
                      item.danger ? 'text-[var(--destructive)]' : 'text-[var(--foreground)]',
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {hasChildren && open && (
        <div>
          {category
            .children!.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
            .map((child) => (
              <CategoryNode
                key={child.id}
                category={child}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onAdd={onAdd}
                level={level + 1}
                filter={filter}
                compact={compact}
                ancestors={[...ancestors, category.name]}
                renamingId={renamingId}
                renameDraft={renameDraft}
                onRenameDraftChange={onRenameDraftChange}
                onBeginRename={onBeginRename}
                onSaveRename={onSaveRename}
                onCancelRename={onCancelRename}
              />
            ))}
        </div>
      )}
    </div>
  );
}
