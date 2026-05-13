import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { DocumentStatus } from '@/shared/types';
import { computeDocumentHealthIssues } from '@/shared/utils/documentHealth';

export type { HealthIssue } from '@/shared/utils/documentHealth';

export function DocumentHealthStrip({
  title,
  categoryId,
  summary,
  status,
  updatedAt,
  className,
}: {
  title: string;
  categoryId: string;
  summary?: string;
  status: DocumentStatus;
  updatedAt?: string;
  className?: string;
}) {
  const issues = computeDocumentHealthIssues({ title, categoryId, summary, status, updatedAt });
  const warns = issues.filter((i) => i.severity === 'warn');

  if (issues.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400',
          className,
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Salud del documento: correcta</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]',
        className,
      )}
      title={issues.map((i) => i.label).join(' · ')}
    >
      {warns.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
      <span className="font-medium text-[var(--foreground)]">Salud:</span>
      {issues.map((i) => (
        <span
          key={i.id}
          className={cn(
            'rounded-md px-1.5 py-0.5',
            i.severity === 'warn' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-[var(--muted)]',
          )}
        >
          {i.label}
        </span>
      ))}
    </div>
  );
}
