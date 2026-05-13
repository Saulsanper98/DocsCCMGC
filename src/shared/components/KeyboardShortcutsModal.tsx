import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { formatModLabel } from '@/shared/utils/platform';
import { isCopilotUiEnabled } from '@/lib/featureFlags';

interface ShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: ShortcutsModalProps) {
  const shortcuts = useMemo(() => {
    const m = formatModLabel();
    const rows = [
      { keys: [m, 'K'], desc: 'Abrir paleta de comandos / búsqueda' },
      { keys: [m, 'N'], desc: 'Nuevo documento' },
      { keys: [m, 'Shift', 'N'], desc: 'Nota rápida (modal)' },
      { keys: [m, 'S'], desc: 'Guardar documento (en editor)' },
      { keys: [m, 'E'], desc: 'Alternar vista previa (en editor)' },
      ...(isCopilotUiEnabled() ? ([{ keys: [m, 'Shift', 'C'], desc: 'Abrir panel Copilot' }] as const) : []),
      { keys: [m, '/'], desc: 'Ver atajos de teclado' },
      { keys: ['↑', '↓'], desc: 'Navegar en paleta de comandos' },
      { keys: ['↵'], desc: 'Seleccionar en paleta de comandos' },
      { keys: ['ESC'], desc: 'Cerrar modal / paleta' },
    ];
    return rows;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl ring-1 ring-black/[0.06] dark:ring-white/12 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Atajos de teclado</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 space-y-2">
          {shortcuts.map(({ keys, desc }) => (
            <div key={desc} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-[var(--foreground)]">{desc}</span>
              <div className="flex items-center gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 px-2 rounded border border-[var(--border)] text-xs font-mono text-[var(--foreground)] bg-[var(--muted)] items-center justify-center"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
