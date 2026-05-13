import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
import * as Popover from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Search,
  LogOut,
  Bell,
  GripVertical,
  LayoutPanelLeft,
  PanelLeftClose,
  MousePointerClick,
  Check,
} from 'lucide-react';
import { CcmgcBrandLogo } from '@/shared/components/CcmgcBrandLogo';
import { AppTooltip } from '@/shared/components/AppTooltip';
import { useAppStore, type SidebarMode } from '@/app/store';
import { useAuth } from '@/features/auth/useAuth';
import { Avatar } from './ui/Avatar';
import { cn } from '@/shared/utils/cn';
import {
  mergeNavOrder,
  orderDefsByIds,
  getVisibleAdminNav,
  getVisibleMainNav,
  type SidebarNavItemDef,
} from '@/shared/navigation/sidebarNavConfig';
import type { UserRole } from '@/shared/types';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
  operator: 'Operador',
};

function useHoverFlyout() {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), 200);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }, [clearTimers]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { open, setOpen, scheduleOpen, scheduleClose, cancelClose };
}

/** Flyout lateral al pasar el cursor (solo rail colapsado, md+). */
function SidebarFlyout({
  collapsed,
  title,
  description,
  children,
}: {
  collapsed: boolean;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { open, setOpen, scheduleOpen, scheduleClose, cancelClose } = useHoverFlyout();

  if (!collapsed) return <>{children}</>;

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Anchor asChild>
        <div
          className={cn('relative w-full', collapsed && 'flex justify-center')}
          onPointerEnter={() => {
            cancelClose();
            scheduleOpen();
          }}
          onPointerLeave={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && e.currentTarget.contains(next)) return;
            scheduleClose();
          }}
        >
          {children}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          className={cn(
            'z-[60] w-[min(240px,calc(100vw-5rem))] rounded-xl border border-[var(--border)]',
            'bg-[var(--popover)] p-3 shadow-xl outline-none',
          )}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SortableNavRow({
  item,
  collapsed,
  end,
  onNavigate,
}: {
  item: SidebarNavItemDef;
  collapsed: boolean;
  end?: boolean;
  onNavigate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: collapsed,
  });
  const style =
    collapsed
      ? undefined
      : {
          transform: CSS.Transform.toString(transform),
          transition,
        };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex min-h-[44px] rounded-lg md:min-h-0',
        collapsed ? 'w-full items-center justify-center' : 'items-stretch gap-0.5',
        isDragging && 'z-10 scale-[1.02] opacity-95 shadow-lg ring-2 ring-[var(--accent)]/50 transition-transform duration-200 motion-reduce:scale-100 motion-reduce:transition-none',
      )}
    >
      {!collapsed && (
        <button
          type="button"
          className={cn(
            'hidden shrink-0 cursor-grab touch-none items-center justify-center rounded-md px-0.5 text-white/35',
            'hover:bg-white/10 hover:text-white/70 md:flex',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          )}
          aria-label={`Reordenar: ${item.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      )}
      {collapsed ? (
        <div className="flex w-full min-w-0 justify-center">
          <AppTooltip
            label={item.description ? `${item.label} — ${item.description}` : item.label}
            side="right"
          >
            <NavLink
              to={item.to}
              end={end}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                cn(
                  'box-border flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors duration-200 md:size-10',
                  isActive
                    ? 'bg-[var(--sidebar-active)] text-white'
                    : 'text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-white',
                )
              }
            >
              <item.icon className="pointer-events-none h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">{item.label}</span>
            </NavLink>
          </AppTooltip>
        </div>
      ) : (
        <NavLink
          to={item.to}
          end={end}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] flex-1 items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors duration-200 md:min-h-0',
              isActive &&
                'relative overflow-hidden pl-3 before:absolute before:left-1 before:top-1/2 before:h-7 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-white/90',
              isActive
                ? 'bg-[var(--sidebar-active)] text-white'
                : 'text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] hover:text-white',
              isActive ? 'pr-2' : 'px-2',
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{item.label}</span>
        </NavLink>
      )}
    </div>
  );
}

function SidebarSortableBlock({
  sectionId,
  title,
  defs,
  orderedIds,
  setOrderedIds,
  collapsed,
  onNavigate,
  first,
}: {
  sectionId: string;
  title: string;
  defs: SidebarNavItemDef[];
  orderedIds: string[];
  setOrderedIds: (ids: string[]) => void;
  collapsed: boolean;
  onNavigate?: () => void;
  first?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mergedIds = useMemo(() => mergeNavOrder(orderedIds, defs), [orderedIds, defs]);
  const items = useMemo(() => orderDefsByIds(defs, mergedIds), [defs, mergedIds]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = mergedIds.indexOf(String(active.id));
    const newIndex = mergedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrderedIds(arrayMove(mergedIds, oldIndex, newIndex));
  };

  if (defs.length === 0) return null;

  return (
    <section
      className={cn(
        'min-w-0 w-full',
        collapsed && 'flex flex-col items-center p-0',
        !collapsed && !first && 'mt-5 border-t border-white/[0.07] pt-4',
      )}
      aria-labelledby={`${sectionId}-heading`}
    >
      {!collapsed && (
        <h2
          id={`${sectionId}-heading`}
          className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40"
        >
          {title}
        </h2>
      )}
      <DndContext id={sectionId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={mergedIds} strategy={verticalListSortingStrategy}>
          <div className={cn(collapsed ? 'flex w-full min-w-0 flex-col items-center gap-1' : 'space-y-0.5')}>
            {items.map((item) => (
              <SortableNavRow
                key={item.id}
                item={item}
                collapsed={collapsed}
                end={item.to === '/'}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  description,
  collapsed,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  collapsed: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const inner = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--sidebar-fg)] transition-colors md:min-h-0',
        'cursor-pointer hover:bg-[var(--sidebar-hover)] hover:text-white',
        collapsed
          ? 'box-border size-11 shrink-0 justify-center px-0 md:size-10'
          : 'w-full',
      )}
      aria-label={label}
      title={collapsed ? undefined : label}
    >
      <div className="relative shrink-0">
        <Icon className="h-4 w-4" aria-hidden />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-[10px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {!collapsed && <span>{label}</span>}
    </button>
  );

  if (!collapsed) return inner;

  return (
    <SidebarFlyout collapsed title={label} description={description}>
      {inner}
    </SidebarFlyout>
  );
}

export function Sidebar() {
  const {
    sidebarMode,
    setSidebarMode,
    sidebarHoverExpanded,
    setSidebarHoverExpanded,
    unreadCount,
    user,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    setCommandPaletteOpen,
    sidebarNavOrderMain,
    sidebarNavOrderAdmin,
    setSidebarNavOrderMain,
    setSidebarNavOrderAdmin,
  } = useAppStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const cancelHoverLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleHoverLeave = useCallback(() => {
    cancelHoverLeave();
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setSidebarHoverExpanded(false);
    }, 260);
  }, [cancelHoverLeave, setSidebarHoverExpanded]);

  useEffect(() => () => cancelHoverLeave(), [cancelHoverLeave]);

  const navCollapsed =
    sidebarMode === 'collapsed' || (sidebarMode === 'hover' && !sidebarHoverExpanded);

  const railLabelsCollapsed = isMobileViewport ? !mobileDrawerOpen : navCollapsed;

  const isAdmin = user?.role === 'admin';

  const mainDefs = useMemo(() => getVisibleMainNav(user), [user]);
  const adminDefs = useMemo(() => getVisibleAdminNav(user), [user]);

  const mainIds = useMemo(() => mergeNavOrder(sidebarNavOrderMain, mainDefs), [sidebarNavOrderMain, mainDefs]);
  const adminIds = useMemo(
    () => mergeNavOrder(sidebarNavOrderAdmin, adminDefs),
    [sidebarNavOrderAdmin, adminDefs],
  );

  const persistMain = (ids: string[]) => setSidebarNavOrderMain(mergeNavOrder(ids, mainDefs));
  const persistAdmin = (ids: string[]) => setSidebarNavOrderAdmin(mergeNavOrder(ids, adminDefs));

  const isDesktopHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

  const onAsidePointerEnter = () => {
    if (!isDesktopHover()) return;
    if (sidebarMode !== 'hover') return;
    cancelHoverLeave();
    setSidebarHoverExpanded(true);
  };

  const onAsidePointerLeave = () => {
    if (!isDesktopHover()) return;
    if (sidebarMode !== 'hover') return;
    if (modeMenuOpen) return;
    scheduleHoverLeave();
  };

  const modeOptionClass =
    'relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-8 pr-2 text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

  return (
    <aside
      aria-label="Navegación principal"
      onPointerEnter={onAsidePointerEnter}
      onPointerLeave={onAsidePointerLeave}
      className={cn(
        'relative z-app-sidebar flex h-full min-h-0 flex-col',
        'transition-[width,transform,box-shadow] duration-300 motion-reduce:transition-none',
        'bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)]',
        'md:border-r md:border-white/[0.05]',
        'w-60 md:w-60',
        navCollapsed && 'md:w-16',
        'fixed inset-y-0 left-0 md:relative',
        mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none md:translate-x-0',
        sidebarMode === 'hover' && sidebarHoverExpanded && 'md:z-[45] md:shadow-xl',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-white/[0.06]',
          railLabelsCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
        )}
      >
        <div className={cn('flex min-w-0 shrink-0 items-center justify-center', railLabelsCollapsed ? '' : '-ml-0.5')}>
          <CcmgcBrandLogo
            variant={railLabelsCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}
            blendWithBackground
          />
        </div>
        {!railLabelsCollapsed && (
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-xs font-bold leading-tight text-white">DocBrain</p>
            <p className="truncate text-[10px] tracking-wide text-white/55">CCMGC</p>
          </div>
        )}
      </div>

      <div
        className={cn(
          'hidden shrink-0 border-b border-white/[0.06] pb-2.5 pt-2 md:block',
          railLabelsCollapsed ? 'px-0' : 'px-2',
        )}
      >
        <SidebarFlyout
          collapsed={railLabelsCollapsed}
          title="Buscar en DocBrain"
          description="Atajo de teclado Ctrl+K. Documentos, rutas y acciones rápidas."
        >
          <button
            type="button"
            onClick={() => {
              setCommandPaletteOpen(true);
              setMobileDrawerOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-left text-xs text-white/70',
              'transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white/90',
              railLabelsCollapsed ? 'size-10 shrink-0 justify-center px-0' : 'w-full px-2.5',
            )}
            title={railLabelsCollapsed ? undefined : 'Buscar (Ctrl+K)'}
            aria-label="Abrir búsqueda global"
          >
            <Search className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            {!railLabelsCollapsed && (
              <>
                <span className="flex-1 truncate">Buscar…</span>
                <kbd className="hidden shrink-0 rounded border border-white/15 px-1 py-0.5 font-mono text-[10px] text-white/50 lg:inline">
                  Ctrl K
                </kbd>
              </>
            )}
          </button>
        </SidebarFlyout>
      </div>

      <nav
        data-tour="sidebar-nav"
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain py-3',
          railLabelsCollapsed
            ? 'items-center px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0'
            : 'px-2 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]',
        )}
      >
        <SidebarSortableBlock
          sectionId="sidebar-main"
          title="Principal"
          first
          defs={mainDefs}
          orderedIds={mainIds}
          setOrderedIds={persistMain}
          collapsed={railLabelsCollapsed}
          onNavigate={() => setMobileDrawerOpen(false)}
        />

        {isAdmin && (
          <SidebarSortableBlock
            sectionId="sidebar-admin"
            title="Administración"
            defs={adminDefs}
            orderedIds={adminIds}
            setOrderedIds={persistAdmin}
            collapsed={railLabelsCollapsed}
            onNavigate={() => setMobileDrawerOpen(false)}
          />
        )}
      </nav>

      <div
        className={cn(
          'shrink-0 space-y-0.5 border-t border-white/[0.07]',
          railLabelsCollapsed ? 'flex flex-col items-center px-0 py-2' : 'p-2',
        )}
      >
        <SidebarButton
          icon={Bell}
          label="Notificaciones"
          description="Alertas y avisos del sistema"
          collapsed={railLabelsCollapsed}
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => {
            navigate('/notificaciones');
            setMobileDrawerOpen(false);
          }}
        />
        <SidebarButton
          icon={LogOut}
          label="Cerrar sesión"
          description="Salir de la cuenta actual"
          collapsed={railLabelsCollapsed}
          onClick={signOut}
        />
        {user && (
          <SidebarFlyout
            collapsed={railLabelsCollapsed}
            title={user.full_name}
            description={`${user.email} · ${ROLE_LABEL[user.role]}`}
          >
            <div
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--sidebar-hover)] transition-colors',
                railLabelsCollapsed ? 'box-border size-11 shrink-0 justify-center px-0 md:size-10' : '',
              )}
              onClick={() => {
                navigate('/perfil');
                setMobileDrawerOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/perfil');
                  setMobileDrawerOpen(false);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Ver perfil"
            >
              <div className="relative shrink-0">
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--success)] border-2 border-[var(--sidebar-bg)]" />
              </div>
              {!railLabelsCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium text-white">{user.full_name}</p>
                  <p className="truncate text-[10px] text-white/50">
                    {ROLE_LABEL[user.role]}
                  </p>
                </div>
              )}
            </div>
          </SidebarFlyout>
        )}
      </div>

      <DropdownMenu.Root
        modal={false}
        onOpenChange={(open) => {
          setModeMenuOpen(open);
          if (!open && sidebarMode === 'hover') {
            scheduleHoverLeave();
          }
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'absolute right-0 top-1/2 z-50 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full md:flex',
              navCollapsed ? 'translate-x-[calc(50%+1.125rem)]' : 'translate-x-1/2',
              'border border-white/15 bg-[var(--sidebar-bg)]/95 text-white/70 shadow-md backdrop-blur-sm',
              'ring-1 ring-black/20 dark:ring-white/10',
              'transition-[color,background-color,border-color,box-shadow,transform] duration-300 motion-reduce:transition-none',
              'hover:border-white/25 hover:bg-[var(--sidebar-hover)] hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)]',
            )}
            title="Modo del menú lateral"
            aria-label="Elegir modo del menú lateral: expandido, colapsado o inteligente"
          >
            <LayoutPanelLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="right"
            align="center"
            sideOffset={10}
            className={cn(
              'z-[100] min-w-[240px] rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-xl outline-none',
            )}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Menú lateral
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={sidebarMode}
              onValueChange={(v) => setSidebarMode(v as SidebarMode)}
            >
              <DropdownMenu.RadioItem value="expanded" className={modeOptionClass}>
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-[var(--accent)]">
                  {sidebarMode === 'expanded' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : null}
                </span>
                <LayoutPanelLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Siempre expandido</span>
                  <span className="text-[11px] font-normal text-[var(--muted-foreground)]">Ancho completo fijo</span>
                </span>
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="collapsed" className={modeOptionClass}>
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-[var(--accent)]">
                  {sidebarMode === 'collapsed' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : null}
                </span>
                <PanelLeftClose className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Siempre colapsado</span>
                  <span className="text-[11px] font-normal text-[var(--muted-foreground)]">Solo iconos</span>
                </span>
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="hover" className={modeOptionClass}>
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-[var(--accent)]">
                  {sidebarMode === 'hover' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : null}
                </span>
                <MousePointerClick className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Inteligente</span>
                  <span className="text-[11px] font-normal text-[var(--muted-foreground)]">Se amplía al pasar el cursor (escritorio)</span>
                </span>
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </aside>
  );
}
