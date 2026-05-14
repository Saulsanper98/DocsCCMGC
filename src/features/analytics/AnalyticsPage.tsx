import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  FileText,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store';
import { DocumentationHealthCard } from '@/features/dashboard/DocumentationHealthCard';
import {
  fetchDocumentationHealthMetrics,
  type DocumentationHealthMetrics,
} from '@/features/dashboard/documentationHealthMetrics';
import type { Document } from '@/shared/types';
import { formatNumber, formatRelativeTime } from '@/shared/utils/format';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { cn } from '@/shared/utils/cn';

interface AnalyticsData {
  topDocuments: Document[];
  totalDocs: number;
  totalUsers: number;
  docsThisMonth: number;
  outdatedDocs: Document[];
}

/** Mini sparkline (mismo patrón que el panel principal). */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 56;
  const h = 24;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - v / max) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={points} stroke={color} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

const statColorMap = {
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-400', accent: '#3b82f6' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400', accent: '#10b981' },
  violet: { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-900/25 dark:text-violet-400', accent: '#8b5cf6' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400', accent: '#f59e0b' },
} as const;

const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus };
const trendColors = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-amber-600 dark:text-amber-400',
  neutral: 'text-[var(--muted-foreground)]',
};

function AnalyticsStatCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
  sparkline,
  trend = 'neutral',
  trendLabel,
  onClick,
}: {
  icon: ElementType;
  label: string;
  value: number | string;
  loading?: boolean;
  color: keyof typeof statColorMap;
  sparkline?: number[];
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  onClick?: () => void;
}) {
  const numValue = typeof value === 'number' ? value : 0;
  const animatedValue = useCountUp(numValue, 900, !loading && typeof value === 'number');
  const TrendIc = trendIcons[trend];
  const { accent } = statColorMap[color];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200',
        onClick && 'cursor-pointer hover:border-[var(--accent)]/35 hover:shadow-md motion-safe:hover:-translate-y-0.5',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-50"
        style={{ background: `radial-gradient(ellipse at top right, ${accent}18, transparent 62%)` }}
      />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', statColorMap[color].icon)}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          {sparkline && !loading ? <Sparkline values={sparkline} color={accent} /> : null}
        </div>
        {loading ? (
          <Skeleton className="mb-1 h-8 w-16" />
        ) : (
          <p className="mb-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
            {typeof value === 'number' ? formatNumber(animatedValue) : value}
          </p>
        )}
        <p className="text-xs font-medium leading-snug text-[var(--muted-foreground)]">{label}</p>
        {trendLabel && !loading && (
          <div className={cn('mt-2 flex items-center gap-1', trendColors[trend])}>
            <TrendIc className="h-3 w-3 shrink-0" aria-hidden />
            <span className="text-[10px] font-medium leading-tight">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<Partial<AnalyticsData>>({});
  const [loading, setLoading] = useState(true);
  const [healthMetrics, setHealthMetrics] = useState<DocumentationHealthMetrics | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAppStore();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const thisMonth = new Date();
    thisMonth.setDate(1);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
      setHealthLoading(true);
      const [topDocs, total, monthly, users, outdated, health] = await Promise.all([
        supabase
          .from('documents')
          .select('*, category:categories!category_id(id,name,color)')
          .eq('status', 'published')
          .order('view_count', { ascending: false })
          .limit(10),
        supabase.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).gte('created_at', thisMonth.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('documents')
          .select('*, author:profiles!author_id(id,full_name)')
          .eq('status', 'published')
          .lt('updated_at', sixMonthsAgo.toISOString())
          .limit(5),
        fetchDocumentationHealthMetrics(user?.id),
      ]);

      if (topDocs.error) throw topDocs.error;
      if (total.error) throw total.error;
      if (monthly.error) throw monthly.error;
      if (users.error) throw users.error;
      if (outdated.error) throw outdated.error;

      setData({
        topDocuments: (topDocs.data ?? []) as Document[],
        totalDocs: total.count ?? 0,
        docsThisMonth: monthly.count ?? 0,
        totalUsers: users.count ?? 0,
        outdatedDocs: (outdated.data ?? []) as Document[],
      });
      setHealthMetrics(health);
    } catch (err) {
      toastSupabaseError('No se pudieron cargar las estadísticas', err, fetchAnalytics);
    } finally {
      setLoading(false);
      setHealthLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const totalSparkline = useMemo(() => {
    const base = data.totalDocs ?? 0;
    return [base - 6, base - 4, base - 5, base - 2, base - 3, base - 1, base].map((v) => Math.max(0, v));
  }, [data.totalDocs]);

  const monthSparkline = useMemo(() => {
    const b = data.docsThisMonth ?? 0;
    return [0, b > 3 ? 1 : 0, b > 2 ? 1 : 0, b > 1 ? 2 : 0, b > 0 ? b - 1 : 0, b, b].map((v) => Math.max(0, v));
  }, [data.docsThisMonth]);

  const usersSparkline = useMemo(() => {
    const u = data.totalUsers ?? 0;
    return [Math.max(0, u - 3), Math.max(0, u - 2), Math.max(0, u - 2), u - 1, u, u, u].map((v) => Math.max(0, v));
  }, [data.totalUsers]);

  const viewsSparkline = useMemo(() => {
    const tops = (data.topDocuments ?? []).slice(0, 7).map((d) => d.view_count);
    const pad = Array(Math.max(0, 7 - tops.length)).fill(0);
    return [...pad, ...tops].slice(-7);
  }, [data.topDocuments]);

  const topDoc = data.topDocuments?.[0];
  const maxViews = useMemo(
    () => Math.max(...(data.topDocuments ?? []).map((d) => d.view_count), 1),
    [data.topDocuments],
  );

  const leaderViews = topDoc?.view_count ?? 0;

  return (
    <div className="app-page-x w-full max-w-none space-y-8 py-6 sm:py-8">
      {/* Cabecera */}
      <header className="flex flex-col gap-4 border-b border-[var(--border)]/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <BarChart3 className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Biblioteca</span>
          </div>
          <h1 className="app-page-title text-balance">Estadísticas</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            Vista agregada del repositorio: volumen, lecturas y documentación que necesita atención. Los datos excluyen
            archivados salvo donde se indica.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 self-start sm:self-auto"
          onClick={() => void fetchAnalytics()}
          disabled={loading}
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Actualizar
        </Button>
      </header>

      {/* KPIs */}
      <section aria-labelledby="analytics-kpis-heading">
        <h2 id="analytics-kpis-heading" className="sr-only">
          Indicadores principales
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <AnalyticsStatCard
            icon={FileText}
            label="Total documentos"
            value={data.totalDocs ?? 0}
            loading={loading}
            color="blue"
            sparkline={totalSparkline}
            trend="up"
            trendLabel="Activos (no archivados)"
            onClick={() => navigate('/documentos')}
          />
          <AnalyticsStatCard
            icon={TrendingUp}
            label="Creados este mes"
            value={data.docsThisMonth ?? 0}
            loading={loading}
            color="emerald"
            sparkline={monthSparkline}
            trend={(data.docsThisMonth ?? 0) > 0 ? 'up' : 'neutral'}
            trendLabel={(data.docsThisMonth ?? 0) > 0 ? 'Nuevos en el mes' : 'Sin altas este mes'}
          />
          <AnalyticsStatCard
            icon={Users}
            label="Perfiles de usuario"
            value={data.totalUsers ?? 0}
            loading={loading}
            color="violet"
            sparkline={usersSparkline}
            trend="neutral"
            trendLabel="Cuentas en la plataforma"
            onClick={() => navigate('/admin?tab=team')}
          />
          <AnalyticsStatCard
            icon={Eye}
            label="Vistas del líder"
            value={leaderViews}
            loading={loading}
            color="amber"
            sparkline={viewsSparkline}
            trend={leaderViews > 0 ? 'up' : 'neutral'}
            trendLabel={
              topDoc?.title
                ? topDoc.title.length > 48
                  ? `${topDoc.title.slice(0, 48)}…`
                  : topDoc.title
                : 'Sin publicados con visitas'
            }
            onClick={() => topDoc && navigate(`/documentos/${topDoc.id}`)}
          />
        </div>
      </section>

      <DocumentationHealthCard metrics={healthMetrics} loading={healthLoading} className="shadow-[var(--shadow-card)]" />

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <Card elevation="raised" lift className="flex min-h-[min(22rem,50vh)] flex-col overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Ranking por vistas</h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Publicados · orden por visitas</p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => navigate('/documentos')}>
              Ver biblioteca
            </Button>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-[var(--border)]/80">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))
            ) : (data.topDocuments ?? []).length === 0 ? (
              <div className="flex flex-1 items-center">
                <EmptyState
                  variant="embedded"
                  icon={FileText}
                  title="Sin datos de vistas"
                  description="Cuando haya documentos publicados con visitas, aparecerán aquí con una barra proporcional al más leído."
                  action={{ label: 'Ir a documentos', onClick: () => navigate('/documentos') }}
                />
              </div>
            ) : (
              (data.topDocuments ?? []).map((doc, i) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => navigate(`/documentos/${doc.id}`)}
                  className="group flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-[var(--muted)]/35 sm:px-5 sm:py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 text-center text-[11px] font-bold tabular-nums text-[var(--muted-foreground)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)]" title={doc.title}>
                        {doc.title}
                      </p>
                      {doc.category ? (
                        <p className="truncate text-xs font-medium" style={{ color: doc.category.color }}>
                          {doc.category.name}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--muted-foreground)]">Sin categoría</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-[var(--muted-foreground)]">
                      <Eye className="h-3.5 w-3.5 opacity-80" aria-hidden />
                      <span className="font-medium text-[var(--foreground)]">{doc.view_count}</span>
                    </div>
                  </div>
                  <div className="ml-9 flex items-center gap-2 sm:ml-9">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500/90 to-amber-400/70 transition-[width] duration-500"
                        style={{ width: `${Math.max(6, (doc.view_count / maxViews) * 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card elevation="raised" lift className="flex min-h-[min(22rem,50vh)] flex-col overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3.5 sm:px-5">
            <h2 className="font-semibold text-[var(--foreground)]">Sin actualizar (+6 meses)</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Publicados con última edición anterior a seis meses · conviene revisar vigencia
            </p>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-[var(--border)]/80">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 sm:px-5">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))
            ) : (data.outdatedDocs ?? []).length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                  <Clock className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-center text-sm font-medium text-[var(--foreground)]">Todo al día en este criterio</p>
                <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
                  No hay publicados con más de seis meses sin cambios. Sigue publicando y manteniendo guías al día.
                </p>
                <Button type="button" variant="secondary" size="sm" className="mt-5" onClick={() => navigate('/documentos')}>
                  Explorar documentos
                </Button>
              </div>
            ) : (
              (data.outdatedDocs ?? []).map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => navigate(`/documentos/${doc.id}/editar`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--muted)]/35 sm:px-5"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-sm ring-2 ring-amber-400/30" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{doc.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {doc.author?.full_name ? `${doc.author.full_name} · ` : ''}
                      actualizado {formatRelativeTime(doc.updated_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
