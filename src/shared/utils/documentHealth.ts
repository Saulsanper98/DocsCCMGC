import type { DocumentStatus } from '@/shared/types';

export type HealthIssue = { id: string; label: string; severity: 'warn' | 'info' };

export function computeDocumentHealthIssues(params: {
  title: string;
  categoryId: string;
  summary: string | undefined;
  status: DocumentStatus;
  updatedAt: string | undefined;
}): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (!params.title.trim()) {
    issues.push({ id: 'title', label: 'Sin título', severity: 'warn' });
  }
  if (!params.categoryId) {
    issues.push({ id: 'category', label: 'Sin categoría', severity: 'warn' });
  }
  if (!params.summary?.trim()) {
    issues.push({ id: 'summary', label: 'Sin resumen', severity: 'info' });
  }
  if (params.status === 'draft' && params.updatedAt) {
    const days = (Date.now() - new Date(params.updatedAt).getTime()) / (86400 * 1000);
    if (days > 21) {
      issues.push({ id: 'stale-draft', label: 'Borrador sin actualizar >21 días', severity: 'info' });
    }
  }
  return issues;
}

/** Peor severidad para badges rápidos. */
export function getDocumentHealthLevel(issues: HealthIssue[]): 'ok' | 'info' | 'warn' {
  if (issues.some((i) => i.severity === 'warn')) return 'warn';
  if (issues.length > 0) return 'info';
  return 'ok';
}
