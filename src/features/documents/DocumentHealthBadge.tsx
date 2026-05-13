import { AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { Document } from '@/shared/types';
import { computeDocumentHealthIssues, getDocumentHealthLevel } from '@/shared/utils/documentHealth';

export function DocumentHealthBadge({ doc, className }: { doc: Document; className?: string }) {
  const issues = computeDocumentHealthIssues({
    title: doc.title,
    categoryId: doc.category_id ?? '',
    summary: doc.summary,
    status: doc.status,
    updatedAt: doc.updated_at,
  });
  const level = getDocumentHealthLevel(issues);
  const title = issues.length ? issues.map((i) => i.label).join(' · ') : 'Sin avisos de salud';

  if (level === 'ok') {
    return (
      <span
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          className,
        )}
        title={title}
      >
        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{title}</span>
      </span>
    );
  }

  if (level === 'warn') {
    return (
      <span
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
          className,
        )}
        title={title}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{title}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
        className,
      )}
      title={title}
    >
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{title}</span>
    </span>
  );
}
