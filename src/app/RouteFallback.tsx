/** Indicador de carga para rutas cargadas con React.lazy(). */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 p-8">
      <div
        className="h-10 w-10 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-sm text-[var(--muted-foreground)]">Cargando vista…</p>
    </div>
  );
}
