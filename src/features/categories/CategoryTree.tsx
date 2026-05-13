import { useMemo, useState, type ReactNode } from 'react';
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
}

export function CategoryTree({ selectedId, onSelect }: CategoryTreeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tree, loading, createCategory, deleteCategory, reorderRootCategories } = useCategories();
  const [filterText, setFilterText] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:ring-1 focus:ring-[var(--ring)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="mb-1 px-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
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

        <div className="px-2">
          <div className="flex items-center justify-between px-2 py-1">
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
            <div className="mb-1 flex items-center gap-1 px-1">
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
            <div className="space-y-1 px-2">
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
}: {
  category: Category;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string, parentId?: string) => void;
  filter: string;
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
}: {
  category: Category;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string, parentId?: string) => void;
  level: number;
  filter: string;
  dragHandle?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const hasChildren = (category.children?.length ?? 0) > 0;
  const Icon = iconMap[category.icon] ?? Folder;
  const OpenIcon = hasChildren && open ? FolderOpen : Icon;
  const isSelected = selectedId === category.id;

  return (
    <div>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors',
          isSelected ? 'bg-[var(--accent)] text-white' : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
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

        <span className="flex-1 truncate">{category.name}</span>

        {category.document_count !== undefined && category.document_count > 0 && (
          <span className={cn('text-[10px]', isSelected ? 'text-white/70' : 'text-[var(--muted-foreground)]')}>
            {category.document_count}
          </span>
        )}

        <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
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
                  { icon: Pencil, label: 'Renombrar', action: () => setShowMenu(false) },
                  {
                    icon: Trash2,
                    label: 'Eliminar',
                    action: () => {
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
              />
            ))}
        </div>
      )}
    </div>
  );
}
