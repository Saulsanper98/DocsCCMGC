import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import type { Comment } from '@/shared/types';
import toast from 'react-hot-toast';

function nestComments(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  map.forEach((c) => {
    if (c.parent_id) {
      const parent = map.get(c.parent_id);
      if (parent) parent.replies!.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

export function useComments(documentId: string) {
  const { user } = useAppStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  /** `silent`: no pone la lista en estado de carga (evita parpadeos tras mutaciones o realtime). */
  const reload = useCallback(
    async (silent = false) => {
      if (!documentId) return;
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*, author:profiles!author_id(id,full_name,avatar_url)')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });
        if (error) {
          if (!silent) toast.error('No se pudieron cargar los comentarios');
          return;
        }
        if (data) setComments(nestComments(data as Comment[]));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (!documentId) return;
    void reload(false);
    const channel = supabase
      .channel(`comments:${documentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `document_id=eq.${documentId}` },
        () => {
          void reload(true);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [documentId, reload]);

  async function addComment(content: string, parentId?: string, anchorText?: string) {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from('comments').insert({
      document_id: documentId,
      parent_id: parentId ?? null,
      author_id: user.id,
      content: content.trim(),
      anchor_text: anchorText ?? null,
    });
    if (error) {
      toast.error('Error al añadir comentario');
      return;
    }
    await reload(true);
  }

  async function resolveComment(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from('comments')
      .update({ is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Error al resolver comentario');
      return;
    }
    toast.success('Comentario resuelto');
    await reload(true);
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar comentario');
      return;
    }
    await reload(true);
  }

  return { comments, loading, addComment, resolveComment, deleteComment };
}
