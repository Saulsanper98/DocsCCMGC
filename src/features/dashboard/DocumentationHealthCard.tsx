import { HeartPulse, FolderOpen, FileWarning, Inbox, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { cn } from '@/shared/utils/cn';
import type { DocumentationHealthMetrics } from './documentationHealthMetrics';

interface DocumentationHealthCardProps {
  metrics: DocumentationHealthMetrics | null;
  loading: boolean;
  className?: string;
}

export function DocumentationHealthCard({ metrics, loading, className }: DocumentationHealthCardProps) {
  const navigate = useNavigate();

  const rows = [
    {
      key: 'cat',
      icon: FolderOpen,
      label: 'Borradores sin categoría',
      value: metrics?.draftsNoCategory ?? 0,
      hint: 'Asigna una carpeta para mejorar la navegación.',
      action: () => navigate('/borradores'),
      actionLabel: 'Ir a borradores',
    },
    {
      key: 'sum',
      icon: FileWarning,
      label: 'Activos sin resumen',
      value: metrics?.activeNoSummary ?? 0,
      hint: 'Un resumen ayuda en búsquedas y listados.',
      action: () => navigate('/documentos'),
      actionLabel: 'Ver documentos',
    },
    {
      key: 'stale',
      icon: Inbox,
      label: 'Borradores sin tocar >21 días',
      value: metrics?.staleDrafts ?? 0,
      hint: 'Publica, archiva o actualiza para reducir deuda.',
      action: () => navigate('/borradores'),
      actionLabel: 'Revisar borradores',
    },
    {
      key: 'rev',
      icon: ClipboardList,
      label: 'Revisiones pendientes (tuyas)',
      value: metrics?.myPendingReviews ?? 0,
      hint: 'Asignaciones en el flujo de aprobación.',
      action: () => navigate('/turno'),
      actionLabel: 'Panel de turno',
    },
  ];

  const totalAlerts =
    (metrics?.draftsNoCategory ?? 0) +
    (metrics?.activeNoSummary ?? 0) +
    (metrics?.staleDrafts ?? 0) +
    (metrics?.myPendingReviews ?? 0);

  return (
    <Card elevation="raised" className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <HeartPulse className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">Salud de la documentación</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Indicadores agregados del repositorio (no archivados salvo donde se indica)</p>
          </div>
        </div>
        {!loading && metrics && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              totalAlerts === 0
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
            )}
          >
            {totalAlerts === 0 ? 'Todo en orden' : `${totalAlerts} puntos a revisar`}
          </span>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--muted)]/10 p-4"
              >
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))
          : rows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col gap-2 rounded-lg border border-[var(--border)]/70 bg-[var(--muted)]/10 p-4"
              >
                <div className="flex items-start gap-2">
                  <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--foreground)]">{row.label}</p>
                    <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">{row.hint}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{row.value}</p>
                  <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={row.action}>
                    {row.actionLabel}
                  </Button>
                </div>
              </div>
            ))}
      </div>
    </Card>
  );
}
