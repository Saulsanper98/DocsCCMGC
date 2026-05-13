import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'danger' | 'link' | 'brand';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

const transition =
  'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--duration-base)] motion-reduce:transition-none [transition-timing-function:var(--ease-smooth)]';

const variants = {
  default: cn(
    'bg-[var(--primary)] text-white shadow-sm hover:shadow-md hover:opacity-95 active:opacity-90 active:shadow-sm active:scale-[0.97]',
    'ring-1 ring-black/10 dark:ring-white/15',
    transition,
  ),
  brand: cn(
    'bg-[var(--brand-600)] text-white shadow-[var(--shadow-brand)] hover:shadow-lg hover:opacity-95 active:scale-[0.97]',
    'ring-1 ring-black/10 dark:ring-white/10',
    transition,
  ),
  secondary: cn(
    'bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)] shadow-[var(--shadow-xs)]',
    'hover:bg-[var(--muted)]',
    transition,
  ),
  ghost: cn('hover:bg-[var(--muted)] text-[var(--foreground)]', transition),
  outline: cn(
    'border border-[var(--border)] bg-transparent hover:bg-[var(--muted)] text-[var(--foreground)]',
    transition,
  ),
  destructive: cn(
    'bg-[var(--destructive)] text-white hover:opacity-95 active:scale-[0.98] shadow-sm hover:shadow-[0_0_0_1px_rgba(239,68,68,0.35)]',
    transition,
  ),
  link: 'text-[var(--accent)] underline-offset-4 hover:underline p-0 h-auto transition-colors',
};

const sizes = {
  xs: 'h-7 px-2 text-xs rounded-md gap-1.5',
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-11 px-6 text-base rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const variantKey = (variant === 'danger' ? 'destructive' : variant) as keyof typeof variants;
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[0.42] disabled:saturate-[0.55] disabled:shadow-none',
          variants[variantKey],
          sizes[size],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
