import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, Notification, Category } from '@/shared/types';
import { SIDEBAR_ADMIN_DEFAULT_ORDER, SIDEBAR_MAIN_DEFAULT_ORDER } from '@/shared/navigation/sidebarNavConfig';

export type DocumentsViewMode = 'list' | 'grid' | 'table';
export type EditorReadingWidth = 'narrow' | 'medium' | 'wide';
export type UiDensity = 'comfortable' | 'compact';

/** Rail lateral: fijo expandido, fijo colapsado, o ancho mínimo y expansión al pasar el cursor (solo escritorio). */
export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

interface AppState {
  user: UserProfile | null;
  theme: 'light' | 'dark' | 'system';
  sidebarMode: SidebarMode;
  /** Solo modo `hover`: el rail está expandido por puntero encima del aside. No persistir. */
  sidebarHoverExpanded: boolean;
  commandPaletteOpen: boolean;
  copilotPanelOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  categories: Category[];
  selectedCategoryId: string | null;
  searchQuery: string;
  /** Drawer de navegación en vista móvil/ancho estrecho */
  mobileDrawerOpen: boolean;
  /** Lista de documentos: vista lista / cuadrícula / tabla */
  documentsViewMode: DocumentsViewMode;
  /** Editor: ancho de lectura del bloque de contenido */
  editorReadingWidth: EditorReadingWidth;
  /** Editor: oculta barras de formato inferiores para escribir sin distracciones */
  editorZenMode: boolean;
  /** Orden de enlaces del rail principal (ids de sidebarNavConfig) */
  sidebarNavOrderMain: string[];
  sidebarNavOrderAdmin: string[];
  /** Listados y tablas: filas más compactas o más aire */
  uiDensity: UiDensity;

  setUser: (user: UserProfile | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setSidebarHoverExpanded: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setCopilotPanelOpen: (open: boolean) => void;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setCategories: (categories: Category[]) => void;
  setSelectedCategoryId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setDocumentsViewMode: (mode: DocumentsViewMode) => void;
  setEditorReadingWidth: (w: EditorReadingWidth) => void;
  setEditorZenMode: (zen: boolean) => void;
  setSidebarNavOrderMain: (ids: string[]) => void;
  setSidebarNavOrderAdmin: (ids: string[]) => void;
  setUiDensity: (d: UiDensity) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      theme: 'system',
      sidebarMode: 'hover',
      sidebarHoverExpanded: false,
      commandPaletteOpen: false,
      copilotPanelOpen: false,
      notifications: [],
      unreadCount: 0,
      categories: [],
      selectedCategoryId: null,
      searchQuery: '',
      mobileDrawerOpen: false,
      documentsViewMode: 'list',
      editorReadingWidth: 'medium',
      editorZenMode: false,
      sidebarNavOrderMain: [...SIDEBAR_MAIN_DEFAULT_ORDER],
      sidebarNavOrderAdmin: [...SIDEBAR_ADMIN_DEFAULT_ORDER],
      uiDensity: 'comfortable',

      setUser: (user) => set({ user }),
      setTheme: (theme) => set({ theme }),
      setSidebarMode: (sidebarMode) => set({ sidebarMode, sidebarHoverExpanded: false }),
      setSidebarHoverExpanded: (sidebarHoverExpanded) => set({ sidebarHoverExpanded }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setCopilotPanelOpen: (open) => set({ copilotPanelOpen: open }),
      setNotifications: (notifications) =>
        set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),
      markNotificationRead: (id) =>
        set((s) => {
          const notifications = s.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n,
          );
          return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
        }),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
          unreadCount: 0,
        })),
      setCategories: (categories) => set({ categories }),
      setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
      setDocumentsViewMode: (documentsViewMode) => set({ documentsViewMode }),
      setEditorReadingWidth: (editorReadingWidth) => set({ editorReadingWidth }),
      setEditorZenMode: (editorZenMode) => set({ editorZenMode }),
      setSidebarNavOrderMain: (sidebarNavOrderMain) => set({ sidebarNavOrderMain }),
      setSidebarNavOrderAdmin: (sidebarNavOrderAdmin) => set({ sidebarNavOrderAdmin }),
      setUiDensity: (uiDensity) => set({ uiDensity }),
    }),
    {
      name: 'docbrain-app',
      partialize: (state) => ({
        theme: state.theme,
        sidebarMode: state.sidebarMode,
        documentsViewMode: state.documentsViewMode,
        editorReadingWidth: state.editorReadingWidth,
        sidebarNavOrderMain: state.sidebarNavOrderMain,
        sidebarNavOrderAdmin: state.sidebarNavOrderAdmin,
        uiDensity: state.uiDensity,
        /* editorZenMode deliberadamente omitido para no persistirlo. */
      }),
      merge: (persistedState, currentState) => {
        const raw = persistedState as Record<string, unknown> | null | undefined;
        const base = { ...currentState, ...(raw ?? {}) };

        let sidebarMode: SidebarMode = 'hover';
        if (raw && typeof raw.sidebarCollapsed === 'boolean' && raw.sidebarMode == null) {
          sidebarMode = raw.sidebarCollapsed ? 'collapsed' : 'expanded';
        } else if (
          raw &&
          (raw.sidebarMode === 'expanded' || raw.sidebarMode === 'collapsed' || raw.sidebarMode === 'hover')
        ) {
          sidebarMode = raw.sidebarMode as SidebarMode;
        }
        if (sidebarMode !== 'expanded' && sidebarMode !== 'collapsed' && sidebarMode !== 'hover') {
          sidebarMode = 'hover';
        }

        return {
          ...base,
          sidebarMode,
          sidebarHoverExpanded: false,
          editorZenMode: false,
          sidebarNavOrderMain:
            Array.isArray(base.sidebarNavOrderMain) && base.sidebarNavOrderMain.length > 0
              ? base.sidebarNavOrderMain
              : [...SIDEBAR_MAIN_DEFAULT_ORDER],
          sidebarNavOrderAdmin:
            Array.isArray(base.sidebarNavOrderAdmin) && base.sidebarNavOrderAdmin.length > 0
              ? base.sidebarNavOrderAdmin
              : [...SIDEBAR_ADMIN_DEFAULT_ORDER],
        };
      },
    },
  ),
);
