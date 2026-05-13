import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import type { Attachment } from '@/shared/types';
import toast from 'react-hot-toast';

const MAX_SIZE_MB = 50;

export function useAttachments(documentId: string) {
  const { user } = useAppStore();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (documentId) fetch();
  }, [documentId]);

  async function fetch() {
    setLoading(true);
    const { data } = await supabase
      .from('attachments')
      .select('*, uploader:profiles!uploaded_by(id,full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (data) {
      const rows = [...(data as Attachment[])].sort((a, b) =>
        a.is_main_file === b.is_main_file ? 0 : a.is_main_file ? -1 : 1
      );
      const withUrls = await Promise.all(
        rows.map(async (a) => {
          const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(a.file_path, 3600);
          return { ...a, url: urlData?.signedUrl };
        })
      );
      setAttachments(withUrls);
    }
    setLoading(false);
  }

  async function uploadFile(file: File, isMain = false) {
    if (!user || !documentId) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`El archivo supera el límite de ${MAX_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const ext = file.name.split('.').pop();
    const path = `${documentId}/${Date.now()}.${ext}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { error: dbError } = await supabase.from('attachments').insert({
        document_id: documentId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
        is_main_file: isMain,
      });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success(`"${file.name}" subido correctamente`);
      await fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteAttachment(id: string, path: string) {
    try {
      await supabase.storage.from('documents').remove([path]);
      await supabase.from('attachments').delete().eq('id', id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success('Archivo eliminado');
    } catch {
      toast.error('Error al eliminar el archivo');
    }
  }

  return { attachments, loading, uploading, uploadProgress, uploadFile, deleteAttachment };
}
