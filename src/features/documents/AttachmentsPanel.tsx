import { useRef, useState } from 'react';
import {
  Paperclip, Upload, X, Download, Trash2,
  FileText, Image, Video, Sheet, Presentation, File, Eye,
} from 'lucide-react';
import { useAttachments } from './useAttachments';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { attachmentSupportsPreview } from './attachmentPreviewUtils';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { formatFileSize, formatRelativeTime } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import type { Attachment } from '@/shared/types';

interface AttachmentsPanelProps {
  documentId: string;
  onClose: () => void;
  canEdit?: boolean;
}

function getIcon(mime: string): React.ElementType {
  if (mime?.includes('pdf') || mime?.includes('text')) return FileText;
  if (mime?.startsWith('image/')) return Image;
  if (mime?.startsWith('video/')) return Video;
  if (mime?.includes('sheet') || mime?.includes('excel')) return Sheet;
  if (mime?.includes('presentation') || mime?.includes('powerpoint')) return Presentation;
  return File;
}

export function AttachmentsPanel({ documentId, onClose, canEdit }: AttachmentsPanelProps) {
  const { attachments, loading, uploading, uploadProgress, uploadFile, deleteAttachment } = useAttachments(documentId);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => uploadFile(f));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => uploadFile(f));
    e.target.value = '';
  }

  return (
    <>
    {preview && (
      <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} />
    )}
    <div className="w-[min(100vw-2rem,22rem)] sm:w-80 border-l border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden shrink-0 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] bg-gradient-to-r from-[var(--muted)]/30 to-transparent">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
            Adjuntos
            {attachments.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">({attachments.length})</span>
            )}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Upload zone */}
      {canEdit && (
        <div className="p-3 border-b border-[var(--border)]">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
              dragging ? 'border-[var(--accent)] bg-blue-50/50 dark:bg-blue-900/20' : 'border-[var(--border)] hover:border-[var(--accent)]/50'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--muted-foreground)]" />
            <p className="text-xs text-[var(--muted-foreground)]">
              Arrastra archivos aquí o <span className="text-[var(--accent)]">haz clic para subir</span>
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">PDF, Word, Excel, imágenes, vídeos · Máx. 50MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {uploading && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mb-1">
                <span>Subiendo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : attachments.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="Sin archivos adjuntos"
            description={canEdit ? 'Sube el primer archivo usando el área de arriba.' : 'Este documento no tiene adjuntos.'}
          />
        ) : (
          <div className="space-y-2 px-3 pb-3">
            {attachments.map((att) => (
              <AttachmentItem
                key={att.id}
                attachment={att}
                canEdit={canEdit}
                onPreview={() => setPreview(att)}
                canOpen={attachmentSupportsPreview(att.mime_type, att.file_name)}
                onDelete={() => deleteAttachment(att.id, att.file_path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function AttachmentItem({
  attachment, canEdit, onDelete, onPreview, canOpen,
}: {
  attachment: Attachment;
  canEdit?: boolean;
  onDelete: () => void;
  onPreview: () => void;
  canOpen: boolean;
}) {
  const Icon = getIcon(attachment.mime_type ?? '');

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-2.5 shadow-sm transition-all hover:border-[var(--accent)]/35 hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--muted)] to-[var(--muted)]/50 ring-1 ring-[var(--border)]">
        <Icon className="h-4 w-4 text-[var(--accent)]" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--foreground)]" title={attachment.file_name}>
          {attachment.file_name}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          {attachment.file_size ? formatFileSize(attachment.file_size) : '—'}
          {' · '}{formatRelativeTime(attachment.created_at)}
          {attachment.is_main_file && (
            <span className="ml-1 rounded bg-[var(--accent)]/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[var(--accent)]">
              Original
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {attachment.url && canOpen && (
          <button
            type="button"
            onClick={() => onPreview()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--accent)] hover:bg-[var(--accent)]/10"
            title="Leer en la app"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        {attachment.url && (
          <a
            href={attachment.url}
            download={attachment.file_name}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            title="Descargar"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-[var(--destructive)]"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
