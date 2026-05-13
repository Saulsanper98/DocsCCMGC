import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label: React.ReactNode;
  id?: string;
  description?: string;
}

export function Checkbox({ className, label, id, description, ...props }: CheckboxProps) {
  const cid = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="flex items-start gap-2.5">
      <CheckboxPrimitive.Root
        id={cid}
        className={cn(
          'peer mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)]',
          'bg-[var(--background)] text-[var(--accent-foreground)] shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-current">
          <Check className="h-3 w-3 stroke-[3]" aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="min-w-0 flex-1">
        {cid ? (
          <label htmlFor={cid} className="cursor-pointer text-sm text-[var(--foreground)]">
            {label}
          </label>
        ) : (
          <span className="text-sm text-[var(--foreground)]">{label}</span>
        )}
        {description ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
    </div>
  );
}
