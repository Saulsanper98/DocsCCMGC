import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, TrendingUp, Clock, FileEdit, Users,
  Bot, Plus, ArrowRight, Activity, Map as MapIcon,
  AlertTriangle, TrendingDown, Minus,
} from 'lucide-react';
import { useAppStore } from '@/app/store';
import { supabase } from '@/lib/supabase';
import { copilot } from '@/lib/copilot';
import { isCopilotUiEnabled } from '@/lib/featureFlags';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Button } from '@/shared/components/ui/Button';
import { Avatar } from '@/shared/components/ui/Avatar';
import { StatusBadge } from '@/shared/components/ui/Badge';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { getGreeting, formatRelativeTime, formatNumber } from '@/shared/utils/format';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';
import type { Document, ActivityLog } from '@/shared/types';
import { DocumentationHealthCard } from './DocumentationHealthCard';
import { fetchDocumentationHealthMetrics, type DocumentationHealthMetrics } from './documentationHealthMetrics';
import { cn } from '@/shared/utils/cn';

interface Stats {
  total: number;
  thisMonth: number;
  myDrafts: number;
  mostViewed: Document | null;
}

/* Mini sparkline SVG inline (7 puntos aleatorios de tendencia) */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 56, h = 24, pad = 2;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - v / max) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={points} stroke={color} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, thisMonth: 0, myDrafts: 0, mostViewed: null });
  const [healthMetrics, setHealthMetrics] = useState<DocumentationHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);

  const [heroRef, heroInView] = useIntersectionObserver<HTMLDivElement>();
  const [statsRef, statsInView] = useIntersectionObserver<HTMLDivElement>();
  const [actionsRef, actionsInView] = useIntersectionObserver<HTMLDivElement>();

  useEffect(() => {
    loadDashboard();
  }, [user?.id]);

  async function loadDashboard() {
    setLoading(true);
    try {
      try {
        setHealthMetrics(await fetchDocumentationHealthMetrics(user?.id));
      } catch {
        setHealthMetrics({ draftsNoCategory: 0, activeNoSummary: 0, staleDrafts: 0, myPendingReviews: 0 });
      }
      await Promise.all([fetchRecentDocs(), fetchStats(), fetchActivity()]);
    } catch (err) {
      toastSupabaseError('No se pudo cargar el panel principal', err, loadDashboard);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentDocs() {
    const { data, error } = await supabase
      .from('documents')
      .select('*, author:profiles!author_id(id,full_name,avatar_url), category:categories!category_id(id,name,color,icon)')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (data) setRecentDocs(data as Document[]);
  }

  async function fetchStats() {
    const thisMonth = new Date();
    thisMonth.setDate(1);

    const [total, monthly, drafts, mostViewed] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
      supabase.from('documents').select('id', { count: 'exact', head: true }).gte('created_at', thisMonth.toISOString()),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('author_id', user?.id ?? '').eq('status', 'draft'),
      supabase.from('documents').select('*, category:categories!category_id(id,name,color)').eq('status', 'published').order('view_count', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (total.error) throw total.error;
    if (monthly.error) throw monthly.error;
    if (drafts.error) throw drafts.error;
    if (mostViewed.error) throw mostViewed.error;

    const totalDocs = total.count ?? 0;
    const myDrafts = drafts.count ?? 0;

    setStats({ total: totalDocs, thisMonth: monthly.count ?? 0, myDrafts, mostViewed: (mostViewed.data ?? null) as Document | null });

    // Build insights
    const msgs: string[] = [];
    if (myDrafts > 0) msgs.push(`Tienes ${myDrafts} ${myDrafts === 1 ? 'borrador pendiente' : 'borradores pendientes'}`);
    if ((monthly.count ?? 0) === 0) msgs.push('Ningún documento creado este mes aún');
    setInsights(msgs);
  }

  async function fetchActivity() {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*, user:profiles!user_id(id,full_name,avatar_url), document:documents!document_id(id,title)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    if (data) setActivity(data as ActivityLog[]);
  }

  const actionLabels: Record<string, string> = {
    created: 'creó', edited: 'editó', published: 'publicó',
    archived: 'archivó', commented: 'comentó en',
  };

  /* Sparkline seeds (simulated weekly trend from thisMonth count) */
  const totalSparkline = useMemo(() => {
    const base = stats.total;
    return [base - 8, base - 5, base - 3, base - 6, base - 2, base - 1, base].map(v => Math.max(0, v));
  }, [stats.total]);
  const monthSparkline = useMemo(() => {
    const b = stats.thisMonth;
    return [0, b > 3 ? 1 : 0, b > 2 ? 1 : 0, b > 1 ? 2 : 0, b > 0 ? b - 1 : 0, b, b].map(v => Math.max(0, v));
  }, [stats.thisMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* Hero greeting */}
      <div
        ref={heroRef}
        className={`observe-fade ${heroInView ? 'in-view' : ''}`}
        style={{ transitionDelay: '0ms' }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--brand-600)] via-[var(--brand-700)] to-[var(--brand-800)] p-6 shadow-[var(--shadow-lg)]">
          {/* Glow ambiental */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brand-400)] opacity-10 blur-3xl" />
            <div className="absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-white opacity-5 blur-2xl" />
          </div>
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {getGreeting()}, {user?.full_name.split(' ')[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}CCMGC
            </p>
            {insights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {insights.map((ins) => (
                  <span key={ins} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {ins}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div
        ref={statsRef}
        className={`grid grid-cols-2 lg:grid-cols-4 gap-4 observe-fade ${statsInView ? 'in-view' : ''}`}
        style={{ transitionDelay: '80ms' }}
      >
        <StatCard
          icon={FileText}
          label="Total documentos"
          value={stats.total}
          loading={loading}
          color="blue"
          sparkline={totalSparkline}
          trend="up"
          trendLabel="+3 este mes"
        />
        <StatCard
          icon={TrendingUp}
          label="Creados este mes"
          value={stats.thisMonth}
          loading={loading}
          color="emerald"
          sparkline={monthSparkline}
          trend={stats.thisMonth > 0 ? 'up' : 'neutral'}
          trendLabel={stats.thisMonth > 0 ? `${stats.thisMonth} nuevos` : 'Sin actividad'}
        />
        <StatCard
          icon={FileEdit}
          label="Mis borradores"
          value={stats.myDrafts}
          loading={loading}
          color="amber"
          trend={stats.myDrafts > 3 ? 'down' : 'neutral'}
          trendLabel={stats.myDrafts > 0 ? 'Pendientes de revisión' : 'Todo al día'}
          onClick={() => navigate('/borradores')}
        />
        {isCopilotUiEnabled() && (
        <StatCard
          icon={Bot}
          label="Copilot"
          value={copilot.isConfigured() ? 'Activo' : 'Sin config.'}
          loading={false}
          color={copilot.isConfigured() ? 'emerald' : 'slate'}
          trend={copilot.isConfigured() ? 'up' : 'neutral'}
          trendLabel={copilot.isConfigured() ? 'Disponible' : 'Sin configurar'}
          onClick={() => navigate('/copilot')}
        />
        )}
      </div>

      <DocumentationHealthCard metrics={healthMetrics} loading={loading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent documents */}
        <div className="lg:col-span-2 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden card-hover-lift">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Documentos recientes</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/documentos')}>
              Ver todos <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              : recentDocs.length === 0
              ? (
                  <EmptyState
                    variant="embedded"
                    icon={FileText}
                    title="No hay documentos recientes"
                    description="Los documentos no archivados aparecerán aquí ordenados por última actualización."
                    action={{ label: 'Nuevo documento', onClick: () => navigate('/documentos/nuevo') }}
                    secondaryAction={{ label: 'Ir a documentos', onClick: () => navigate('/documentos') }}
                  />
              )
              : recentDocs.map((doc, i) => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/documentos/${doc.id}`)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--muted)] transition-colors text-left group stagger-item"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-transform group-hover:scale-110"
                      style={{ background: doc.category?.color ? `${doc.category.color}20` : 'var(--muted)' }}
                    >
                      <FileText className="w-4 h-4" style={{ color: doc.category?.color ?? 'var(--muted-foreground)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{doc.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">
                        {doc.category?.name ?? 'Sin categoría'} · {formatRelativeTime(doc.updated_at)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </button>
                ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] overflow-hidden card-hover-lift">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Actividad del equipo</h2>
            <Activity className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))
              : activity.length === 0
              ? (
                  <EmptyState
                    variant="embedded"
                    icon={Activity}
                    title="Sin actividad reciente"
                    description="Cuando el equipo registre cambios en el registro de actividad, lo verás aquí."
                  />
              )
              : activity.map((log, i) => (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-2.5 hover:bg-[var(--muted)]/40 transition-colors stagger-item" style={{ animationDelay: `${i * 30}ms` }}>
                    {log.user && <Avatar name={log.user.full_name} src={log.user.avatar_url} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--foreground)]">
                        <span className="font-medium">{log.user?.full_name ?? 'Alguien'}</span>
                        {' '}{actionLabels[log.action] ?? log.action}{' '}
                        {log.document && (
                          <button
                            onClick={() => navigate(`/documentos/${log.document_id}`)}
                            className="font-medium text-[var(--accent)] hover:underline"
                          >
                            {log.document.title}
                          </button>
                        )}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {formatRelativeTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div
        ref={actionsRef}
        className={cn(
          `grid grid-cols-2 gap-3 sm:grid-cols-3 observe-fade ${actionsInView ? 'in-view' : ''}`,
          isCopilotUiEnabled() ? 'lg:grid-cols-5' : 'lg:grid-cols-4',
        )}
        style={{ transitionDelay: '120ms' }}
      >
        {[
          { icon: Plus, label: 'Nuevo documento', action: () => navigate('/documentos/nuevo'), color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', hint: 'Ctrl+N' },
          { icon: Clock, label: 'Ver recientes', action: () => navigate('/recientes'), color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', hint: '' },
          ...(isCopilotUiEnabled()
            ? [{ icon: Bot, label: 'Preguntar a Copilot', action: () => navigate('/copilot'), color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400', hint: '' } as const]
            : []),
          { icon: MapIcon, label: 'Mapa de conocimiento', action: () => navigate('/mapa'), color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400', hint: '' },
          { icon: Users, label: 'Ver equipo', action: () => navigate('/admin?tab=team'), color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', hint: '' },
        ].map((q) => (
          <button
            key={q.label}
            onClick={q.action}
            className="group flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/30 hover:-translate-y-0.5 transition-all duration-200 text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${q.color}`}>
              <q.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--foreground)] block truncate">{q.label}</span>
              {q.hint && <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{q.hint}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  loading?: boolean;
  color: 'blue' | 'emerald' | 'amber' | 'slate';
  sparkline?: number[];
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  onClick?: () => void;
}

const colorMap = {
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', accent: '#3b82f6' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', accent: '#10b981' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', accent: '#f59e0b' },
  slate: { icon: 'bg-[var(--muted)] text-[var(--muted-foreground)]', accent: '#64748b' },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};
const trendColors = {
  up: 'text-[var(--success)]',
  down: 'text-[var(--warning)]',
  neutral: 'text-[var(--muted-foreground)]',
};

function StatCard({ icon: Icon, label, value, loading, color, sparkline, trend = 'neutral', trendLabel, onClick }: StatCardProps) {
  const numValue = typeof value === 'number' ? value : 0;
  const animatedValue = useCountUp(numValue, 900, !loading && typeof value === 'number');
  const TrendIcon = trend ? trendIcons[trend] : null;
  const { accent } = colorMap[color];

  return (
    <div
      className={`relative bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-[var(--accent)]/40 hover:shadow-md hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Gradient background subtle */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-40"
        style={{ background: `radial-gradient(ellipse at top right, ${accent}14, transparent 65%)` }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color].icon}`}>
            <Icon className="w-5 h-5" />
          </div>
          {sparkline && !loading && (
            <Sparkline values={sparkline} color={accent} />
          )}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-12 mb-1" />
        ) : (
          <p className="text-2xl font-bold text-[var(--foreground)] mb-1 tabular-nums">
            {typeof value === 'number' ? formatNumber(animatedValue) : value}
          </p>
        )}
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        {trendLabel && TrendIcon && !loading && (
          <div className={`flex items-center gap-1 mt-2 ${trendColors[trend]}`}>
            <TrendIcon className="h-3 w-3 shrink-0" />
            <span className="text-[10px] font-medium">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
