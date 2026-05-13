import { cn } from '@/shared/utils/cn';

interface SkeletonProps {
  className?: string;
  /** Usa gradiente shimmer (tokens + animations.css) en lugar de pulse. */
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer }: SkeletonProps) {
  return (
    <div
      className={cn(
        shimmer ? 'skeleton' : 'animate-pulse motion-reduce:animate-none rounded-md bg-[var(--muted)]',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 && 'w-3/4')} />
      ))}
    </div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="p-4 border border-[var(--border)] rounded-lg space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton shimmer className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton shimmer className="h-4 w-3/4" />
          <Skeleton shimmer className="h-3 w-1/2" />
        </div>
        <Skeleton shimmer className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/** Lista de tarjetas de documento (vista documentos). */
export function SkeletonDocumentList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Placeholders del dashboard (widgets). */
export function SkeletonDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <Skeleton shimmer className="h-3 w-24" />
          <Skeleton shimmer className="h-8 w-16" />
          <Skeleton shimmer className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
