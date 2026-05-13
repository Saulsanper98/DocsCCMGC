import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { documentDetailSelect, documentListSelect } from '@/lib/supabaseEmbeds';
import { useAppStore } from '@/app/store';
import type { Document, DocumentStatus } from '@/shared/types';
import toast from 'react-hot-toast';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';

interface UseDocumentsOptions {
  categoryId?: string;
  filter?: 'favorites' | 'recent' | 'drafts' | 'archived' | 'mine';
  search?: string;
  status?: DocumentStatus;
}

/** Solo filtrar por categoría si es un UUID real (no claves tipo "favorites" del árbol). */
export function isCategoryUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Error al cargar documentos';
  }
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { user } = useAppStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (
        (options.filter === 'drafts' || options.filter === 'mine' || options.filter === 'favorites') &&
        !user?.id
      ) {
        setDocuments([]);
        return;
      }

      let query = supabase
        .from('documents')
        .select(documentListSelect)
        .order('updated_at', { ascending: false });

      if (options.filter === 'drafts') {
        query = query.eq('status', 'draft').eq('author_id', user!.id);
      } else if (options.filter === 'archived') {
        query = query.eq('status', 'archived');
      } else if (options.filter === 'mine') {
        query = query.eq('author_id', user!.id).neq('status', 'archived');
      } else if (options.filter === 'favorites') {
        const { data: favIds } = await supabase
          .from('favorites')
          .select('document_id')
          .eq('user_id', user!.id);
        const ids = (favIds ?? []).map((f) => f.document_id as string);
        if (ids.length === 0) {
          setDocuments([]);
          return;
        }
        query = query.in('id', ids).neq('status', 'archived');
      } else if (options.filter === 'recent') {
        query = query.neq('status', 'archived').limit(20);
      } else {
        query = query.neq('status', 'archived');
      }

      if (options.categoryId && isCategoryUuid(options.categoryId)) {
        query = query.eq('category_id', options.categoryId);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.search) {
        query = query.ilike('title', `%${options.search}%`);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      const rows = (data ?? []) as Document[];
      if (user?.id && rows.length > 0) {
        const ids = rows.map((d) => d.id);
        const { data: favRows } = await supabase
          .from('favorites')
          .select('document_id')
          .eq('user_id', user.id)
          .in('document_id', ids);
        const favSet = new Set((favRows ?? []).map((r) => r.document_id as string));
        setDocuments(rows.map((d) => ({ ...d, is_favorite: favSet.has(d.id) })));
      } else {
        setDocuments(rows);
      }
    } catch (err) {
      setError(errorMessage(err));
      toastSupabaseError('No se pudieron cargar los documentos', err, fetch);
    } finally {
      setLoading(false);
    }
  }, [options.categoryId, options.filter, options.search, options.status, user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  async function deleteDocument(id: string) {
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success('Documento eliminado');
    } catch (err) {
      toastSupabaseError('No se pudo eliminar el documento', err, () => deleteDocument(id));
    }
  }

  async function updateStatus(id: string, status: DocumentStatus) {
    try {
      const updateData: Partial<Document> = {
        status,
        ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
        ...(status === 'archived' ? { archived_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase.from('documents').update(updateData).eq('id', id);
      if (error) throw error;
      setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, ...updateData } : d));
      const labels: Record<DocumentStatus, string> = {
        draft: 'movido a borradores',
        review: 'enviado a revisión',
        published: 'publicado',
        archived: 'archivado',
      };
      toast.success(`Documento ${labels[status]}`);
    } catch (err) {
      toastSupabaseError('No se pudo actualizar el estado', err, () => updateStatus(id, status));
    }
  }

  async function toggleFavorite(documentId: string, isFav: boolean) {
    if (!user) return;
    try {
      if (isFav) {
        const { error } = await supabase.from('favorites').delete().match({ user_id: user.id, document_id: documentId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, document_id: documentId });
        if (error) throw error;
      }
      setDocuments((prev) => {
        if (options.filter === 'favorites' && isFav) {
          return prev.filter((d) => d.id !== documentId);
        }
        return prev.map((d) => (d.id === documentId ? { ...d, is_favorite: !isFav } : d));
      });
    } catch (err) {
      toastSupabaseError('No se pudieron actualizar los favoritos', err, () => toggleFavorite(documentId, isFav));
    }
  }

  return { documents, loading, error, refetch: fetch, deleteDocument, updateStatus, toggleFavorite };
}

export function useDocument(id: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const { user } = useAppStore();

  useEffect(() => {
    if (!id) return;
    fetchDocument();
    checkFavorite();
    incrementView();
  }, [id]);

  async function fetchDocument() {
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select(documentDetailSelect)
      .eq('id', id)
      .single();
    setDocument(data as Document | null);
    setLoading(false);
  }

  async function checkFavorite() {
    if (!user) return;
    const { data } = await supabase
      .from('favorites')
      .select('document_id')
      .match({ user_id: user.id, document_id: id })
      .maybeSingle();
    setIsFavorite(!!data);
  }

  async function incrementView() {
    await supabase.rpc('increment_view_count', { doc_id: id });
  }

  async function toggleFavorite() {
    if (!user) return;
    if (isFavorite) {
      await supabase.from('favorites').delete().match({ user_id: user.id, document_id: id });
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, document_id: id });
    }
    setIsFavorite(!isFavorite);
  }

  return { document, loading, isFavorite, toggleFavorite, refetch: fetchDocument };
}
