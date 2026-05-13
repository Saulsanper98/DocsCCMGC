import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { cn } from '@/shared/utils/cn';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, className, size = 'sm' }: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <button
      onClick={() => copy(text)}
      aria-label={copied ? '¡Copiado!' : 'Copiar'}
      title={copied ? '¡Copiado!' : 'Copiar'}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-all duration-150',
        'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
        'hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
        copied && 'text-[var(--success)]',
        className,
      )}
    >
      {copied
        ? <Check className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        : <Copy className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      }
    </button>
  );
}
