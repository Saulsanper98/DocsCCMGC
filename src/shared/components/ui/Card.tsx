import { type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export type CardElevation = 'flat' | 'raised' | 'floating' | 'modal';

const elevations: Record<CardElevation, string> = {
  flat: 'border border-[var(--border)] bg-transparent shadow-none',
  raised:
    'border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]',
  floating:
    'border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-lg)] card-hover-lift',
  modal:
    'border border-[var(--border)] bg-[var(--glass-light)] dark:bg-[var(--glass-dark)] shadow-[var(--shadow-xl)] backdrop-blur-xl ring-1 ring-black/[0.04] dark:ring-white/10',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  lift?: boolean;
}

export function Card({ elevation = 'raised', lift = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--border-radius-lg)]',
        elevations[elevation],
        lift && 'card-hover-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
