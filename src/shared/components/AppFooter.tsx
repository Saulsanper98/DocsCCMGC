import { buildEnvSuffix } from '@/shared/utils/buildEnv';
import { useAppStore } from '@/app/store';
import { cn } from '@/shared/utils/cn';

export function AppFooter() {
  const footerCompact = useAppStore((s) => s.footerCompact);
  const v = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  const env = buildEnvSuffix();

  return (
    <footer
      className={cn(
        'shrink-0 border-0 bg-[var(--background)]/90',
        'px-3 text-center tabular-nums text-[var(--muted-foreground)]',
        footerCompact ? 'py-0.5 text-[8px] leading-tight text-[var(--muted-foreground)]/90' : 'py-2 text-[11px] leading-snug',
        'pb-[max(0.35rem,env(safe-area-inset-bottom))]',
      )}
    >
      <span>{import.meta.env.VITE_APP_NAME ?? 'DocBrain CCMGC'}</span>
      {v ? (
        <>
          {' · '}
          <span className="tabular-nums">v{v}</span>
        </>
      ) : null}
      {env ? (
        footerCompact ? (
          <>
            {' · '}
            <span className="uppercase tracking-wide">{env}</span>
          </>
        ) : (
          <>
            {' · '}
            <span
              className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)]"
              title="Entorno (VITE_APP_ENV o modo de build)"
            >
              {env}
            </span>
          </>
        )
      ) : null}
    </footer>
  );
}
