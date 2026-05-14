import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { formatModLabel } from '@/shared/utils/platform';
import { isCopilotUiEnabled } from '@/lib/featureFlags';

interface ShortcutsModalProps {
  onClose: () => void;
}

type ShortcutRow = { keys: string[]; desc: string };

export function KeyboardShortcutsModal({ onClose }: ShortcutsModalProps) {
  const groups = useMemo(() => {
    const m = formatModLabel();
    const global: ShortcutRow[] = [
      { keys: [m, 'K'], desc: 'Abrir paleta de comandos / búsqueda' },
      { keys: [m, 'N'], desc: 'Nuevo documento' },
      { keys: [m, 'Shift', 'N'], desc: 'Nota rápida (modal)' },
      { keys: [m, '/'], desc: 'Ver atajos de teclado' },
    ];
    const editor: ShortcutRow[] = [
      { keys: [m, 'S'], desc: 'Guardar documento' },
      { keys: [m, 'E'], desc: 'Alternar vista previa' },
    ];
    const copilot: ShortcutRow[] = isCopilotUiEnabled()
      ? [{ keys: [m, 'Shift', 'C'], desc: 'Abrir panel Copilot' }]
      : [];
    const palette: ShortcutRow[] = [
      { keys: ['↑', '↓'], desc: 'Navegar en la paleta' },
      { keys: ['↵'], desc: 'Seleccionar' },
      { keys: ['ESC'], desc: 'Cerrar modal o paleta' },
    ];
    return [
      { title: 'Aplicación', rows: global },
      { title: 'Editor', rows: editor },
      ...(copilot.length ? [{ title: 'Copilot', rows: copilot }] as const : []),
      { title: 'Paleta de comandos', rows: palette },
    ];
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl ring-1 ring-black/[0.06] dark:ring-white/12 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Atajos de teclado</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto overscroll-contain">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`kbd-group-${g.title.replace(/\s/g, '-')}`}>
              <h3
                id={`kbd-group-${g.title.replace(/\s/g, '-')}`}
                className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2"
              >
                {g.title}
              </h3>
              <ul className="space-y-1 rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                {g.rows.map((row) => (
                  <li
                    key={row.desc}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-[var(--card)]"
                  >
                    <span className="text-sm text-[var(--foreground)]">{row.desc}</span>
                    <div className="flex items-center gap-1 shrink-0" aria-hidden>
                      {row.keys.map((k) => (
                        <kbd
                          key={`${row.desc}-${k}`}
                          className="inline-flex h-6 min-w-[1.5rem] px-2 rounded border border-[var(--border)] text-xs font-mono text-[var(--foreground)] bg-[var(--muted)] items-center justify-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
