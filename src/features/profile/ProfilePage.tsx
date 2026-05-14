import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Mail,
  User,
  LogOut,
  Palette,
  FileText,
  Search,
  Settings,
  Copy,
  Check,
  Sparkles,
  Fingerprint,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import { useAuth } from '@/features/auth/useAuth';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Card } from '@/shared/components/ui/Card';
import { formatDate, formatAbsoluteDateTime } from '@/shared/utils/format';
import { formatPrivacyEmail } from '@/shared/utils/formatPrivacy';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { cn } from '@/shared/utils/cn';
import type { UserRole } from '@/shared/types';
import toast from 'react-hot-toast';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
  operator: 'Operador',
};

const ROLE_BADGE_VARIANT: Record<UserRole, 'default' | 'success' | 'warning' | 'secondary'> = {
  admin: 'default',
  editor: 'success',
  operator: 'warning',
  viewer: 'secondary',
};

const THEME_LABEL: Record<'light' | 'dark' | 'system', string> = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
};

type DocStats = {
  total: number;
  published: number;
  drafts: number;
  favorites: number;
};

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
      {children}
    </h2>
  );
}

function PrefRow({ label, on, description }: { label: string; on: boolean; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
          on
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-[var(--muted)] text-[var(--muted-foreground)]',
        )}
      >
        {on ? (
          <>
            <Check className="h-3 w-3" aria-hidden />
            Activo
          </>
        ) : (
          'Desactivado'
        )}
      </span>
    </div>
  );
}

function StatTile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)]/80 bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-4 py-3 shadow-sm dark:bg-[color-mix(in_srgb,var(--card)_70%,transparent)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-[var(--muted)]/60 motion-reduce:animate-none" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">{value}</p>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, theme, unreadCount } = useAppStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { copy, copied } = useCopyToClipboard();

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<DocStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const displayEmail = useMemo(() => {
    const fromProfile = user?.email?.trim();
    if (fromProfile) return fromProfile;
    if (authEmail?.trim()) return authEmail.trim();
    return null;
  }, [user?.email, authEmail]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setStatsLoading(true);
    void (async () => {
      try {
        const [totalQ, pubQ, draftQ, favQ] = await Promise.all([
          supabase.from('documents').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
          supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id)
            .eq('status', 'published'),
          supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id)
            .eq('status', 'draft'),
          supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);
        if (cancelled) return;
        setStats({
          total: totalQ.count ?? 0,
          published: pubQ.count ?? 0,
          drafts: draftQ.count ?? 0,
          favorites: favQ.count ?? 0,
        });
      } catch {
        if (!cancelled) setStats({ total: 0, published: 0, drafts: 0, favorites: 0 });
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const notifEmail = user.preferences?.notification_email ?? false;
  const notifInapp = user.preferences?.notification_inapp ?? false;
  const dept = user.department?.trim();
  const isAdmin = user.role === 'admin';
  const userId = user.id;

  function copyId() {
    copy(userId);
    toast.success('Identificador copiado');
  }

  return (
    <div className="app-page-x mx-auto w-full max-w-6xl space-y-8 pb-12 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
            'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors',
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Inicio
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/documentos')}>
            <FileText className="h-4 w-4" />
            Documentos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/notificaciones')}>
            <Bell className="h-4 w-4" />
            Notificaciones
            {unreadCount > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--accent)] px-1.5 py-0 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* Hero */}
      <Card
        elevation="raised"
        className="overflow-hidden border-[var(--border)]/80 p-0 shadow-[0_24px_64px_-28px_rgba(15,23,42,0.35)] dark:shadow-[0_28px_72px_-24px_rgba(0,0,0,0.65)]"
      >
        <div className="relative h-28 sm:h-32 overflow-hidden bg-gradient-to-br from-[var(--accent)]/35 via-[var(--brand-600)]/20 to-transparent dark:from-[var(--accent)]/25 dark:via-slate-900/40">
          <div
            className="absolute inset-0 opacity-[0.15] dark:opacity-[0.22]"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 120%, white, transparent 55%), radial-gradient(circle at 90% -20%, var(--accent), transparent 45%)`,
            }}
          />
        </div>
        <div className="relative px-5 pb-6 pt-0 sm:px-8">
          <div className="-mt-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-6">
              <div className="relative shrink-0">
                <Avatar
                  name={user.full_name}
                  src={user.avatar_url}
                  size="lg"
                  className="!h-[5.25rem] !w-[5.25rem] !text-2xl ring-4 ring-[var(--card)] shadow-lg"
                />
                <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-[var(--success)] ring-[3px] ring-[var(--card)]" />
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-center sm:pb-1 sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="app-page-title text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    {user.full_name}
                  </h1>
                  <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {displayEmail ? (
                    <span className="text-[var(--foreground)]/90">{formatPrivacyEmail(displayEmail)}</span>
                  ) : (
                    'Correo no disponible en esta sesión.'
                  )}
                </p>
                <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--muted-foreground)] sm:justify-start">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
                  DocBrain CCMGC — tu espacio de documentación operativa
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div>
        <SectionTitle id="profile-activity">Actividad en documentos</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Documentos creados" value={stats?.total ?? '—'} loading={statsLoading} />
          <StatTile label="Publicados" value={stats?.published ?? '—'} loading={statsLoading} />
          <StatTile label="Borradores" value={stats?.drafts ?? '—'} loading={statsLoading} />
          <StatTile label="Favoritos" value={stats?.favorites ?? '—'} loading={statsLoading} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-7">
          <Card elevation="raised" className="p-5 sm:p-6">
            <SectionTitle id="profile-account">Datos de la cuenta</SectionTitle>
            <div className="mt-4 divide-y divide-[var(--border)]/80">
              <div className="flex gap-3 py-4 first:pt-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                  <User className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">Departamento</p>
                  {dept ? (
                    <p className="mt-0.5 text-sm text-[var(--foreground)]">{dept}</p>
                  ) : (
                    <p className="mt-0.5 text-sm italic text-[var(--muted-foreground)] leading-relaxed">
                      Sin departamento en el perfil. Si debería figurar, un administrador puede actualizarlo en la
                      gestión de usuarios.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                  <Mail className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">Correo de acceso</p>
                  {displayEmail ? (
                    <p className="mt-0.5 break-all font-mono text-sm text-[var(--foreground)]">{displayEmail}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">No se pudo leer el correo de la sesión.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                  <Fingerprint className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">Identificador de usuario</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 font-mono text-[11px] text-[var(--foreground)]">
                      {userId}
                    </code>
                    <button
                      type="button"
                      onClick={copyId}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-4 text-xs text-[var(--muted-foreground)]">
                <p>
                  Cuenta desde el{' '}
                  <span className="font-medium text-[var(--foreground)]">{formatDate(user.created_at)}</span>
                </p>
                <p className="mt-1" title={formatAbsoluteDateTime(user.updated_at)}>
                  Perfil actualizado: <span className="text-[var(--foreground)]">{formatDate(user.updated_at)}</span>
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6 lg:col-span-5">
          <Card elevation="raised" className="p-5 sm:p-6">
            <SectionTitle id="profile-prefs">Notificaciones</SectionTitle>
            <div className="mt-2 divide-y divide-[var(--border)]/80">
              <PrefRow
                label="Correo electrónico"
                on={notifEmail}
                description="Avisos importantes por email (según políticas del sistema)."
              />
              <PrefRow label="En la aplicación" on={notifInapp} description="Centro de notificaciones en DocBrain." />
            </div>
          </Card>

          <Card elevation="raised" className="p-5 sm:p-6">
            <SectionTitle id="profile-ui">Interfaz</SectionTitle>
            <div className="mt-4 flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                <Palette className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)]">Tema actual</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{THEME_LABEL[theme]}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Cambia entre claro, oscuro o según el sistema desde la barra superior (icono sol / luna). Comodidad
                  visual y pausas están en el menú de ajustes del header.
                </p>
              </div>
            </div>
          </Card>

          <Card elevation="raised" className="p-5 sm:p-6">
            <SectionTitle id="profile-shortcuts">Accesos rápidos</SectionTitle>
            <nav className="mt-4 grid gap-2" aria-labelledby="profile-shortcuts">
              <Link
                to="/buscar"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors"
              >
                <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                Búsqueda global
              </Link>
              <Link
                to="/documentos/nuevo"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                Nuevo documento
              </Link>
              <Link
                to="/ayuda"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
                Ayuda y atajos
              </Link>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)]/40 transition-colors"
                >
                  <Settings className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  Administración
                </Link>
              ) : null}
            </nav>
          </Card>
        </div>
      </div>

      <Card elevation="raised" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Sesión</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Cierra la sesión en este dispositivo cuando termines.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </div>
  );
}
