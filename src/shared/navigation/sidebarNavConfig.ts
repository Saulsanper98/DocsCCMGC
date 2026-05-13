import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Search,
  Bot,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { UserProfile } from '@/shared/types';
import { isCopilotUiEnabled } from '@/lib/featureFlags';

export type SidebarNavItemDef = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Texto secundario en flyout (sidebar colapsado) */
  description: string;
  /** Si está definido, solo visible para esos roles */
  roles?: Array<'admin' | 'editor' | 'viewer' | 'operator'>;
  /** Requiere admin u operator (p. ej. Turno) */
  operatorOrAdmin?: true;
};

const mainNavAll: SidebarNavItemDef[] = [
  {
    id: 'home',
    label: 'Inicio',
    to: '/',
    icon: LayoutDashboard,
    description: 'Panel principal y resumen',
  },
  {
    id: 'documents',
    label: 'Documentos',
    to: '/documentos',
    icon: FileText,
    description: 'Biblioteca y categorías',
  },
  {
    id: 'search',
    label: 'Búsqueda',
    to: '/buscar',
    icon: Search,
    description: 'Buscar en todo el contenido',
  },
  {
    id: 'copilot',
    label: 'Copilot IA',
    to: '/copilot',
    icon: Bot,
    description: 'Asistente contextual',
  },
  {
    id: 'analytics',
    label: 'Estadísticas',
    to: '/estadisticas',
    icon: BarChart3,
    description: 'Métricas y uso',
  },
];

const adminNavAll: SidebarNavItemDef[] = [
  {
    id: 'admin',
    label: 'Administración',
    to: '/admin',
    icon: Settings,
    description: 'Equipo, sistema e integraciones',
    roles: ['admin'],
  },
];

export const SIDEBAR_MAIN_DEFAULT_ORDER = mainNavAll.map((i) => i.id);
export const SIDEBAR_ADMIN_DEFAULT_ORDER = adminNavAll.map((i) => i.id);

function roleOk(def: SidebarNavItemDef, user: UserProfile | null): boolean {
  if (!user) return false;
  if (def.operatorOrAdmin) {
    return user.role === 'admin' || user.role === 'operator';
  }
  if (def.roles?.length) {
    return def.roles.includes(user.role);
  }
  return true;
}

export function getVisibleMainNav(user: UserProfile | null): SidebarNavItemDef[] {
  return mainNavAll.filter((d) => {
    if (d.id === 'copilot' && !isCopilotUiEnabled()) return false;
    return roleOk(d, user);
  });
}

export function getVisibleAdminNav(user: UserProfile | null): SidebarNavItemDef[] {
  if (!user || user.role !== 'admin') return [];
  return adminNavAll;
}

/** Aplica orden guardado: primero ids válidos en orden, luego ids nuevos al final. */
export function mergeNavOrder(saved: string[], visibleDefs: SidebarNavItemDef[]): string[] {
  const allowed = new Set(visibleDefs.map((d) => d.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of saved) {
    if (allowed.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const d of visibleDefs) {
    if (!seen.has(d.id)) out.push(d.id);
  }
  return out;
}

export function orderDefsByIds(defs: SidebarNavItemDef[], ids: string[]): SidebarNavItemDef[] {
  const map = new Map(defs.map((d) => [d.id, d] as const));
  return ids.map((id) => map.get(id)).filter(Boolean) as SidebarNavItemDef[];
}
