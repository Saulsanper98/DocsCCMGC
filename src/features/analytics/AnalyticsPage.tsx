import { useEffect, useState } from 'react';
import { FileText, Eye, Users, TrendingUp, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/app/store';
import { DocumentationHealthCard } from '@/features/dashboard/DocumentationHealthCard';
import {
  fetchDocumentationHealthMetrics,
  type DocumentationHealthMetrics,
} from '@/features/dashboard/documentationHealthMetrics';
import { getAiBackend, isCopilotUiEnabled } from '@/lib/featureFlags';
import type { Document, UserProfile } from '@/shared/types';

interface AnalyticsData {
  topDocuments: Document[];
  topContributors: Array<UserProfile & { doc_count: number }>;
  totalDocs: number;
  totalUsers: number;
  docsThisMonth: number;
  outdatedDocs: Document[];
}

export function AnalyticsPage() {
  const [data, setData] = useState<Partial<AnalyticsData>>({});
  const [loading, setLoading] = useState(true);
  const [healthMetrics, setHealthMetrics] = useState<DocumentationHealthMetrics | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAppStore();

  useEffect(() => {
    fetchAnalytics();
  }, [user?.id]);

  async function fetchAnalytics() {
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
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">Estadísticas</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FileText, label: 'Total documentos', value: data.totalDocs, cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
          { icon: TrendingUp, label: 'Creados este mes', value: data.docsThisMonth, cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { icon: Users, label: 'Usuarios activos', value: data.totalUsers, cls: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
          { icon: Eye, label: 'Docs más leídos', value: (data.topDocuments?.[0]?.view_count ?? 0) + ' vistas', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${kpi.cls}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-[var(--foreground)] mb-1">{kpi.value ?? 0}</p>
            )}
            <p className="text-xs text-[var(--muted-foreground)]">{kpi.label}</p>
          </div>
        ))}
      </div>

      <DocumentationHealthCard metrics={healthMetrics} loading={healthLoading} className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top documents */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Documentos más consultados</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))
              : (data.topDocuments ?? []).length === 0
                ? (
                  <div className="px-3 py-4">
                    <EmptyState
                      className="!py-10"
                      icon={FileText}
                      title="Sin datos de vistas"
                      description="Aún no hay documentos publicados con visitas registradas."
                      action={{ label: 'Ir a documentos', onClick: () => navigate('/documentos') }}
                    />
                  </div>
                )
                : (data.topDocuments ?? []).map((doc, i) => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/documentos/${doc.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--muted)] transition-colors text-left"
                  >
                    <span className="text-xs font-bold text-[var(--muted-foreground)] w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{doc.title}</p>
                      {doc.category && (
                        <p className="text-xs truncate" style={{ color: doc.category.color }}>{doc.category.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] shrink-0">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{doc.view_count}</span>
                    </div>
                  </button>
                ))}
          </div>
        </div>

        {/* Outdated docs */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--foreground)]">Documentos sin actualizar (+6 meses)</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))
              : (data.outdatedDocs ?? []).length === 0
              ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  ¡Todo al día! No hay documentos desactualizados.
                </div>
              )
              : (data.outdatedDocs ?? []).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/documentos/${doc.id}/editar`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--muted)] transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{doc.title}</p>
                      {doc.author && (
                        <p className="text-xs text-[var(--muted-foreground)]">{doc.author.full_name}</p>
                      )}
                    </div>
                  </button>
                ))}
          </div>
        </div>
      </div>

      {/* IA / Copilot (solo si está contratado en el despliegue) */}
      <div className="mt-6 bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold text-[var(--foreground)]">
            {isCopilotUiEnabled() ? 'Uso del asistente IA' : 'Asistente IA (desactivado)'}
          </h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {isCopilotUiEnabled()
            ? getAiBackend() === 'ollama'
              ? 'Con Ollama local el tráfico no va a APIs de pago; las métricas detalladas de uso se pueden ampliar más adelante.'
              : 'Las métricas detalladas de uso del asistente se habilitarán cuando la integración esté configurada.'
            : 'Sin proveedor IA activo no hay asistente conversacional ni métricas asociadas. Para un asistente gratuito: VITE_AI_PROVIDER=ollama y Ollama en marcha. La documentación y el OCR en importación siguen disponibles.'}
        </p>
      </div>
    </div>
  );
}
