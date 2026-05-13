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
    <div className="w-72 border-l border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Comentarios
            {comments.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">({comments.length})</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={cn(
              'text-xs px-2 py-0.5 rounded-full transition-colors',
              showResolved ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            )}
          >
            {showResolved ? 'Todos' : 'Resueltos'}
          </button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New comment */}
      <form onSubmit={handleSubmit} className="p-3 border-b border-[var(--border)]">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Añadir un comentario..."
          rows={2}
          className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
          }}
        />
        <div className="flex justify-end mt-1.5">
          <Button type="submit" size="sm" loading={submitting} disabled={!newText.trim()} className="h-7 text-xs">
            <Send className="w-3 h-3" />
            Comentar
          </Button>
        </div>
      </form>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="p-3 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Sin comentarios"
            description="Sé el primero en comentar este documento."
          />
        ) : (
          <div className="space-y-1">
            {visible.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onResolve={resolveComment}
                onDelete={deleteComment}
                onReply={(content, parentId) => addComment(content, parentId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className={cn(
      'px-3 py-2.5 group',
      comment.is_resolved && 'opacity-60'
    )}>
      <div className="flex gap-2">
        {comment.author && <Avatar name={comment.author.full_name} src={comment.author.avatar_url} size="sm" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-[var(--foreground)]">{comment.author?.full_name}</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">{formatRelativeTime(comment.created_at)}</span>
            {comment.is_resolved && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                Resuelto
              </span>
            )}
          </div>

          {comment.anchor_text && (
            <p className="text-[10px] italic text-[var(--muted-foreground)] border-l-2 border-[var(--border)] pl-2 mb-1 line-clamp-1">
              "{comment.anchor_text}"
            </p>
          )}

          <p className="text-xs text-[var(--foreground)] leading-relaxed">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {!comment.is_resolved && (
              <button
                onClick={() => onResolve(comment.id)}
                className="text-[10px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                <Check className="w-3 h-3" /> Resolver
              </button>
            )}
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-[10px] flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Reply className="w-3 h-3" /> Responder
            </button>
            {isOwn && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[10px] flex items-center gap-1 text-[var(--destructive)] hover:opacity-80"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReply && (
            <div className="mt-2 flex gap-1.5">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribe una respuesta..."
                className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
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

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-2 space-y-2 border-l border-[var(--border)] pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2 group/reply">
              {reply.author && <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size="sm" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-[var(--foreground)]">{reply.author?.full_name}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{formatRelativeTime(reply.created_at)}</span>
                </div>
                <p className="text-xs text-[var(--foreground)]">{reply.content}</p>
                <button
                  onClick={() => onDelete(reply.id)}
                  className="text-[10px] text-[var(--destructive)] opacity-0 group-hover/reply:opacity-100 mt-1 transition-opacity"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
