import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { cn } from '@/shared/utils/cn';
import type { SlashItem } from './slashItems';

export type SlashCommandsListProps = SuggestionProps<SlashItem, SlashItem>;

export type SlashCommandsHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export const SlashCommandsList = forwardRef<SlashCommandsHandle, SlashCommandsListProps>(
  function SlashCommandsList(props, ref) {
    const { items, command } = props;
    const [index, setIndex] = useState(0);
    const activeRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      setIndex(0);
    }, [items]);

    useEffect(() => {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [index, items]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown(event: KeyboardEvent) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const it = items[index];
            if (it) command(it);
            return true;
          }
          return false;
        },
      }),
      [items, index, command],
    );

    return (
      <div
        className={cn(
          'slash-commands-popover overflow-hidden rounded-2xl border border-[var(--border)]/90',
          'bg-[color-mix(in_srgb,var(--card)_92%,transparent)] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)]',
          'backdrop-blur-xl backdrop-saturate-150 ring-1 ring-black/[0.04] dark:ring-white/[0.08]',
          'motion-reduce:shadow-lg motion-reduce:backdrop-blur-none',
        )}
      >
        <div className="border-b border-[var(--border)]/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Insertar bloque
          </p>
        </div>

        <div
          className="slash-commands-scroll max-h-[min(52vh,340px)] overflow-y-auto px-1.5 py-1.5"
          role="listbox"
          aria-label="Comandos slash"
        >
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">Sin coincidencias</p>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              const active = i === index;
              return (
                <button
                  key={item.id}
                  ref={active ? activeRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'group/item flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-[background,box-shadow,transform] duration-150',
                    'motion-reduce:transform-none motion-reduce:transition-none',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--accent)_16%,var(--card))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_42%,transparent)]'
                      : 'hover:bg-[color-mix(in_srgb,var(--muted)_55%,transparent)]',
                  )}
                  onMouseEnter={() => setIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => command(item)}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-150',
                      'border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--muted)_65%,transparent)]',
                      active
                        ? 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--muted))] text-[var(--accent)]'
                        : 'text-[var(--muted-foreground)] group-hover/item:text-[var(--foreground)]',
                    )}
                  >
                    <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-sm font-semibold leading-tight text-[var(--foreground)]">{item.title}</span>
                    {item.subtitle ? (
                      <span className="mt-0.5 block font-mono text-[11px] leading-snug text-[var(--muted-foreground)] tabular-nums">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--border)]/50 bg-[var(--muted)]/25 px-3 py-1.5">
          <p className="text-center text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            <kbd className="rounded border border-[var(--border)]/80 bg-[var(--background)]/80 px-1 py-px font-mono">↑</kbd>{' '}
            <kbd className="rounded border border-[var(--border)]/80 bg-[var(--background)]/80 px-1 py-px font-mono">↓</kbd>{' '}
            navegar ·{' '}
            <kbd className="rounded border border-[var(--border)]/80 bg-[var(--background)]/80 px-1 py-px font-mono">Enter</kbd>{' '}
            insertar · <kbd className="rounded border border-[var(--border)]/80 bg-[var(--background)]/80 px-1 py-px font-mono">Esc</kbd> cerrar
          </p>
        </div>
      </div>
    );
  },
);
