import { useMemo } from 'react';

/** Retraso por ítem para animaciones tipo stagger en listas (Prompt V2). */
export function useAnimatedListItem(index: number, stepMs = 20) {
  return useMemo(
    () =>
      ({
        style: { animationDelay: `${index * stepMs}ms` },
      }) as const,
    [index, stepMs],
  );
}
