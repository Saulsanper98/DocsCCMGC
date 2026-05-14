import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Oculta la barra de scroll del elemento hasta que el usuario desplace; tras `idleMs`
 * sin scroll vuelve a ocultarse (útil en Windows donde el scrollbar ocupa sitio).
 */
export function useScrollRevealScrollbarClass(
  ref: RefObject<HTMLElement | null>,
  effectKey: unknown,
  idleMs = 1000,
): string {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback(() => {
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () => bump();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [ref, bump, effectKey]);

  return active ? 'doc-view-scrollbar-autohide--active' : '';
}
