import { cn } from '@/shared/utils/cn';
import type { DocumentStatus } from '@/shared/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';
  className?: string;
}

const variants = {
  default: 'bg-[var(--accent)] text-white',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  destructive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  secondary: 'bg-[var(--secondary)] text-[var(--secondary-foreground)]',
  outline: 'border border-[var(--border)] text-[var(--foreground)]',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

const statusConfig: Record<DocumentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  review: { label: 'En revisión', variant: 'warning' },
  published: { label: 'Publicado', variant: 'success' },
  archived: { label: 'Archivado', variant: 'outline' },
};

export function StatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}
