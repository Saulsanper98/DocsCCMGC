import { History, RotateCcw, Tag, X } from 'lucide-react';
import { useVersions } from './useVersions';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { formatRelativeTime } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import type { DocumentVersion } from '@/shared/types';

interface VersionsPanelProps {
  documentId: string;
  onRestore: (content: Record<string, unknown>) => void;
  onClose: () => void;
}

export function VersionsPanel({ documentId, onRestore, onClose }: VersionsPanelProps) {
  const { versions, loading, restoreVersion } = useVersions(documentId);

  async function handleRestore(v: DocumentVersion) {
    const content = await restoreVersion(v);
    onRestore(content);
  }

  return (
    <div className="w-72 border-l border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">Historial de versiones</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <History className="w-8 h-8 text-[var(--muted-foreground)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--muted-foreground)]">No hay versiones guardadas todavía</p>
          </div>
        ) : (
          <div className="relative py-3">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-[var(--border)]" />

            {versions.map((v, i) => (
              <div key={v.id} className="group relative flex gap-3 px-3 py-3 hover:bg-[var(--muted)] transition-colors">
                {/* Timeline dot */}
                <div className={cn(
                  'relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2',
                  v.is_major_version
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--card)]'
                )}>
                  {v.is_major_version && <Tag className="w-2.5 h-2.5 text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      v{v.version_number}
                      {v.is_major_version && (
                        <span className="ml-1 text-[10px] px-1 rounded bg-[var(--accent)] text-white">mayor</span>
                      )}
                    </span>
                    {i > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRestore(v)}
                        title="Restaurar esta versión"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurar
                      </Button>
                    )}
                  </div>

                  {v.change_summary && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{v.change_summary}</p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5">
                    {v.author && <Avatar name={v.author.full_name} size="sm" />}
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {v.author?.full_name} · {formatRelativeTime(v.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
