import { useState } from 'react';
import { MessageSquare, Check, Trash2, Reply, X, Send } from 'lucide-react';
import { useComments } from './useComments';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { formatRelativeTime } from '@/shared/utils/format';
import { useAppStore } from '@/app/store';
import { cn } from '@/shared/utils/cn';
import { formatModLabel } from '@/shared/utils/platform';
import type { Comment } from '@/shared/types';

interface CommentsPanelProps {
  documentId: string;
  onClose: () => void;
}

export function CommentsPanel({ documentId, onClose }: CommentsPanelProps) {
  const { comments, loading, addComment, resolveComment, deleteComment } = useComments(documentId);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const visible = comments.filter((c) => showResolved || !c.is_resolved);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);
    await addComment(newText);
    setNewText('');
    setSubmitting(false);
  }

  return (
    <aside
      className="flex w-[min(20rem,100%)] shrink-0 flex-col overflow-hidden border-l border-[var(--border)]/80 bg-[var(--muted)]/15 shadow-[inset_1px_0_0_0_rgba(255,255,255,0.04)] dark:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.2)]"
      aria-label="Panel de comentarios"
    >
      <header className="shrink-0 border-b border-[var(--border)]/80 bg-[var(--card)]/90 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)] ring-1 ring-[var(--accent)]/20">
              <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">Comentarios</h2>
              {comments.length > 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {comments.filter((c) => !c.is_resolved).length} abiertos
                  {comments.some((c) => c.is_resolved) ? ` · ${comments.filter((c) => c.is_resolved).length} resueltos` : ''}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)]">Conversación del documento</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-[var(--muted-foreground)]" onClick={onClose} aria-label="Cerrar comentarios" title="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {comments.length > 0 && (
          <div
            className="mt-2.5 flex rounded-lg bg-[var(--muted)]/60 p-0.5 ring-1 ring-[var(--border)]/60"
            role="tablist"
            aria-label="Filtrar comentarios"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showResolved}
              onClick={() => setShowResolved(false)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-center text-[11px] font-medium transition-colors',
                !showResolved
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
            >
              Solo abiertos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showResolved}
              onClick={() => setShowResolved(true)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-center text-[11px] font-medium transition-colors',
                showResolved
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
            >
              Todos
            </button>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="shrink-0 border-b border-[var(--border)]/80 bg-[var(--card)]/40 p-3">
        <label htmlFor="comment-new" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Nuevo comentario
        </label>
        <textarea
          id="comment-new"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Escribe aquí…"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--border)]/90 bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] shadow-sm placeholder:text-[var(--muted-foreground)] outline-none transition-shadow focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--ring)]/80"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--muted-foreground)]">{formatModLabel()}+Enter para enviar</span>
          <Button type="submit" size="sm" variant="brand" loading={submitting} disabled={!newText.trim()} className="h-8 gap-1.5 px-3 text-xs shadow-sm">
            <Send className="h-3.5 w-3.5" aria-hidden />
            Publicar
          </Button>
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="space-y-4 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-[var(--border)]/60 bg-[var(--card)]/40 p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-[45%]" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 && comments.length > 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--muted)]/50 text-[var(--muted-foreground)]">
              <Check className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Todo resuelto</p>
            <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-[var(--muted-foreground)]">
              No quedan comentarios abiertos. Pulsa <span className="font-medium text-[var(--foreground)]">Todos</span> arriba para ver el historial.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Aún no hay comentarios"
            description="Publica el primero para dejar constancia o coordinar cambios en el documento."
            variant="embedded"
            className="py-8 px-4"
          />
        ) : (
          <ul className="space-y-2 p-3 pb-4">
            {visible.map((comment) => (
              <li key={comment.id} className="list-none">
                <CommentThread
                  comment={comment}
                  onResolve={resolveComment}
                  onDelete={deleteComment}
                  onReply={(content, parentId) => addComment(content, parentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function CommentThread({
  comment, onResolve, onDelete, onReply,
}: {
  comment: Comment;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (content: string, parentId: string) => void;
}) {
  const { user } = useAppStore();
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);

  const isOwn = comment.author_id === user?.id;

  return (
    <div
      className={cn(
        'group rounded-xl border border-[var(--border)]/70 bg-[var(--card)]/70 p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
        comment.is_resolved && 'border-emerald-500/20 bg-[var(--muted)]/25 opacity-90',
      )}
    >
      <div className="flex gap-3">
        {comment.author && <Avatar name={comment.author.full_name} src={comment.author.avatar_url} size="sm" className="mt-0.5 ring-2 ring-[var(--background)]" />}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-[var(--foreground)]">{comment.author?.full_name}</span>
            <time className="text-[11px] tabular-nums text-[var(--muted-foreground)]" dateTime={comment.created_at}>
              {formatRelativeTime(comment.created_at)}
            </time>
            {comment.is_resolved && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3" aria-hidden />
                Resuelto
              </span>
            )}
          </div>

          {comment.anchor_text && (
            <blockquote className="mb-2 border-l-2 border-[var(--accent)]/50 bg-[var(--muted)]/40 py-1 pl-2.5 pr-2 text-[11px] italic leading-snug text-[var(--muted-foreground)]">
              <span className="line-clamp-2">&ldquo;{comment.anchor_text}&rdquo;</span>
            </blockquote>
          )}

          <p className="text-sm leading-relaxed text-[var(--foreground)]">{comment.content}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--border)]/50 pt-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            {!comment.is_resolved && (
              <button
                type="button"
                onClick={() => onResolve(comment.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Resolver
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReply(!showReply)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Reply className="h-3.5 w-3.5" aria-hidden />
              Responder
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Eliminar
              </button>
            )}
          </div>

          {showReply && (
            <div className="mt-3 flex gap-2 rounded-lg border border-[var(--border)]/80 bg-[var(--background)] p-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Respuesta…"
                className="min-w-0 flex-1 bg-transparent px-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && replyText.trim()) {
                    onReply(replyText, comment.id);
                    setReplyText('');
                    setShowReply(false);
                  }
                  if (e.key === 'Escape') setShowReply(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="relative mt-3 ml-2 space-y-2 border-l-2 border-[var(--border)]/80 pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="group/reply rounded-lg bg-[var(--muted)]/35 p-2.5 pl-3">
              <div className="flex gap-2">
                {reply.author && <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold text-[var(--foreground)]">{reply.author?.full_name}</span>
                    <time className="text-[10px] text-[var(--muted-foreground)]" dateTime={reply.created_at}>
                      {formatRelativeTime(reply.created_at)}
                    </time>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--foreground)]">{reply.content}</p>
                  <button
                    type="button"
                    onClick={() => onDelete(reply.id)}
                    className="mt-1.5 text-[11px] font-medium text-[var(--destructive)] opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/reply:opacity-100"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
