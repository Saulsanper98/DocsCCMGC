import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, StickyNote } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils/cn';

export type QuickNoteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickNoteModal({ open, onOpenChange }: QuickNoteModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  function goToEditor() {
    navigate('/documentos/nuevo', {
      state: {
        quickNoteTitle: title.trim() || 'Nota rápida',
        quickNoteText: body.trim(),
      },
    });
    setTitle('');
    setBody('');
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-app-modal bg-[var(--overlay-scrim)] backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:backdrop-blur-none" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[201] w-[min(100%-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl',
            'focus:outline-none',
          )}
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)]">
                <StickyNote className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              </div>
              <Dialog.Title className="text-base font-semibold text-[var(--foreground)]">
                Nueva nota rápida
              </Dialog.Title>
            </div>
            <Dialog.Close
              type="button"
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe la nota…"
              rows={5}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] outline-none"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Se abrirá el editor como borrador con este texto. Podrás guardar o publicar desde allí.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={goToEditor} disabled={!body.trim()}>
              Abrir en editor
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
