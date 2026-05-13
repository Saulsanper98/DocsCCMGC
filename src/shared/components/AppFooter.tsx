/** Etiqueta corta de entorno: `import.meta.env.VITE_APP_ENV` o `import.meta.env.MODE`. */
function buildEnvSuffix(): string | null {
  const custom = import.meta.env.VITE_APP_ENV?.trim();
  if (custom) return custom;
  const m = import.meta.env.MODE;
  if (m === 'production') return null;
  if (m === 'development') return 'dev';
  return m;
}

export function AppFooter() {
  const v = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  const env = buildEnvSuffix();

  return (
    <footer className="shrink-0 bg-[var(--background)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-[var(--muted-foreground)] tabular-nums">
      <span>{import.meta.env.VITE_APP_NAME ?? 'DocBrain CCMGC'}</span>
      {v ? (
        <>
          {' · '}
          <span className="tabular-nums">v{v}</span>
        </>
      ) : null}
      {env ? (
        <>
          {' · '}
          <span
            className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)]"
            title="Entorno (VITE_APP_ENV o modo de build)"
          >
            {env}
          </span>
        </>
      ) : null}
    </footer>
  );
}
