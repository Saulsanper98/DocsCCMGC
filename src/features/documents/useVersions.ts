import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import type { DocumentVersion } from '@/shared/types';
import toast from 'react-hot-toast';

export function useVersions(documentId: string) {
  const { user } = useAppStore();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (documentId) fetch();
  }, [documentId]);

  async function fetch() {
    setLoading(true);
    const { data } = await supabase
      .from('document_versions')
      .select('*, author:profiles!created_by(id,full_name,avatar_url)')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });
    if (data) setVersions(data as DocumentVersion[]);
    setLoading(false);
  }

  async function saveVersion(
    content: Record<string, unknown>,
    contentText: string,
    summary?: string,
    isMajor = false
  ) {
    if (!user || !documentId) return;
    const nextNum = (versions[0]?.version_number ?? 0) + 1;
    const { error } = await supabase.from('document_versions').insert({
      document_id: documentId,
      version_number: nextNum,
      content,
      content_text: contentText,
      change_summary: summary ?? null,
      created_by: user.id,
      is_major_version: isMajor,
    });
    if (error) {
      toast.error(`Error al guardar versión: ${error.message}`);
    } else {
      await fetch();
    }
  }

  async function restoreVersion(version: DocumentVersion) {
    await supabase
      .from('documents')
      .update({
        content: version.content,
        content_text: version.content_text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    await saveVersion(version.content, version.content_text ?? '', `Restaurado desde v${version.version_number}`, false);
    toast.success(`Versión ${version.version_number} restaurada`);
    return version.content;
  }

  return { versions, loading, saveVersion, restoreVersion, refetch: fetch };
}
