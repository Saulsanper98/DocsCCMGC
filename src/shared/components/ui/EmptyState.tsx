import { type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/shared/utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** En paneles ya enmarcados (p. ej. dashboard): sin borde ni sombra segunda. */
  variant?: 'default' | 'embedded';
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  variant = 'default',
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const embedded = variant === 'embedded';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center w-full',
        embedded
          ? 'py-12 px-5 sm:px-6'
          : 'py-16 px-6 sm:px-8 max-w-lg mx-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 shadow-[var(--shadow-card)]',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center mb-4',
          embedded
            ? 'w-11 h-11 rounded-xl bg-[var(--muted)]/50 text-[var(--muted-foreground)]'
            : 'w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--muted)] to-[var(--muted)]/40 ring-1 ring-[var(--border)] text-[var(--muted-foreground)]',
        )}
      >
        <Icon className={embedded ? 'w-5 h-5' : 'w-7 h-7'} />
      </div>
      <h3
        className={cn(
          'font-semibold tracking-tight text-[var(--foreground)] mb-1.5',
          embedded ? 'text-base' : 'text-lg',
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-[var(--muted-foreground)] mb-4',
            embedded ? 'text-xs max-w-sm' : 'text-sm max-w-sm',
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
