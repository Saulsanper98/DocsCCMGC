import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/shared/utils/cn';

export function AppTooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={280} skipDelayDuration={400} disableHoverableContent>
      {children}
    </Tooltip.Provider>
  );
}

export function AppTooltip({
  label,
  side = 'right',
  children,
  disabled,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled || !label.trim()) return <>{children}</>;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[70] max-w-[240px] rounded-lg border border-[var(--border)]',
            'bg-[var(--popover)] px-2.5 py-1.5 text-xs font-medium text-[var(--popover-foreground)] shadow-lg',
            'motion-reduce:transition-none transition-opacity duration-150',
          )}
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--popover)]" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
