import toast from 'react-hot-toast';

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Toast de error con acción «Reintentar» para fallos de red/API (p. ej. Supabase).
 */
export function toastSupabaseError(
  title: string,
  err: unknown,
  retry?: () => void | Promise<void>,
): void {
  const detail = getErrorMessage(err, title);
  const devHint = import.meta.env.DEV ? detail : undefined;

  if (retry) {
    toast.custom(
      (t) => (
        <div
          className="flex max-w-[min(100vw-2rem,24rem)] flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] shadow-lg"
          role="alert"
        >
          <p className="font-medium">{title}</p>
          {devHint && (
            <p className="text-xs text-[var(--muted-foreground)] break-words" title={devHint}>
              {devHint}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
              onClick={() => toast.dismiss(t.id)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-95"
              onClick={() => {
                toast.dismiss(t.id);
                void retry();
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      ),
      { duration: 12_000, id: `retry-${title}` },
    );
  } else {
    const msg =
      import.meta.env.DEV && detail && detail !== title
        ? `${title}: ${detail.length > 120 ? `${detail.slice(0, 120)}…` : detail}`
        : title;
    toast.error(msg);
  }
}
