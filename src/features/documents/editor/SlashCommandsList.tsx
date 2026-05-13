import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
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

    useEffect(() => {
      setIndex(0);
    }, [items]);

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
      <div className="min-w-[280px] max-w-[360px] max-h-[min(50vh,320px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 text-left shadow-xl">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--muted-foreground)]">Sin coincidencias</p>
        ) : (
          items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors',
                i === index
                  ? 'bg-[var(--surface-highlight)] text-[var(--foreground)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
              )}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command(item)}
            >
              <span className="font-medium">{item.title}</span>
              {item.subtitle && (
                <span className="text-xs text-[var(--muted-foreground)]">{item.subtitle}</span>
              )}
            </button>
          ))
        )}
      </div>
    );
  },
);
