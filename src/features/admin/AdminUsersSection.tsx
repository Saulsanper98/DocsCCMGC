import { useEffect, useState } from 'react';
import { Users, Pencil, Mail } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Input } from '@/shared/components/ui/Input';
import { formatRelativeTime } from '@/shared/utils/format';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';
import { useAppStore } from '@/app/store';
import { cn } from '@/shared/utils/cn';
import toast from 'react-hot-toast';
import type { UserProfile, UserRole } from '@/shared/types';

const roles: UserRole[] = ['admin', 'editor', 'viewer', 'operator'];
const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
  operator: 'Operador',
};
const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  operator: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

/** Gestión de perfiles y roles (solo admins; el contenedor ya validó permisos). */
export function AdminUsersSection() {
  const { user: currentUser } = useAppStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleDialogUser, setRoleDialogUser] = useState<UserProfile | null>(null);
  const [draftRole, setDraftRole] = useState<UserRole>('viewer');

  useEffect(() => {
    void fetchUsers();
  }, []);

  useEffect(() => {
    if (roleDialogUser) setDraftRole(roleDialogUser.role);
  }, [roleDialogUser]);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toastSupabaseError('No se pudo cargar la lista de usuarios', error, fetchUsers);
      return;
    }
    if (data) setUsers(data as UserProfile[]);
  }

  async function updateRole(id: string, role: UserRole) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) {
      toastSupabaseError('No se pudo actualizar el rol', error, () => updateRole(id, role));
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    setRoleDialogUser(null);
    toast.success('Rol actualizado');
  }

  const filtered = users.filter(
    (u) =>
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          {users.length} perfiles · Los usuarios aparecen al iniciar sesión por primera vez (Supabase Auth).
        </p>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full max-w-sm"
          aria-label="Filtrar usuarios"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="divide-y divide-[var(--border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No hay usuarios"
              description="Los perfiles aparecen cuando los usuarios inician sesión por primera vez (Supabase Auth)."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="Ningún usuario coincide"
              description="Prueba con otras palabras en el buscador."
              action={{ label: 'Limpiar búsqueda', onClick: () => setSearch('') }}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((u) => (
              <div key={u.id} className="group flex flex-wrap items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                <Avatar name={u.full_name} src={u.avatar_url} size="md" />

                <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{u.full_name}</p>
                    {u.id === currentUser?.id && (
                      <span className="rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                        Tú
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <Mail className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">{u.email}</span>
                    </span>
                    {u.department ? (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">{u.department}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', roleColors[u.role])}>
                    {roleLabels[u.role]}
                  </span>
                  {u.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 hover:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                      onClick={() => setRoleDialogUser(u)}
                      title="Cambiar rol"
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  )}
                </div>

                <span className="ml-auto w-full shrink-0 text-right text-xs text-[var(--muted-foreground)] sm:ml-0 sm:w-24">
                  {u.last_active ? formatRelativeTime(u.last_active) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog.Root open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[200] bg-black/50" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-[201] w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl outline-none focus:outline-none">
            <AlertDialog.Title className="text-base font-semibold text-[var(--foreground)]">
              Cambiar rol
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-[var(--muted-foreground)]">
              Usuario: <span className="font-medium text-[var(--foreground)]">{roleDialogUser?.full_name}</span>
              <br />
              Correo: {roleDialogUser?.email}
            </AlertDialog.Description>

            <div className="mt-4">
              <label htmlFor="role-select" className="text-xs font-medium text-[var(--muted-foreground)]">
                Nuevo rol
              </label>
              <select
                id="role-select"
                value={draftRole}
                onChange={(e) => setDraftRole(e.target.value as UserRole)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost" size="sm" type="button">
                  Cancelar
                </Button>
              </AlertDialog.Cancel>
              <Button
                size="sm"
                type="button"
                disabled={!roleDialogUser || draftRole === roleDialogUser.role}
                onClick={() => {
                  if (!roleDialogUser) return;
                  if (draftRole === roleDialogUser.role) {
                    setRoleDialogUser(null);
                    return;
                  }
                  void updateRole(roleDialogUser.id, draftRole);
                }}
              >
                Confirmar
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
