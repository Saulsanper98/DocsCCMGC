import type { SupabaseClient } from '@supabase/supabase-js';

/** Nombre seguro para la ruta en Storage */
export function safeStorageFileName(name: string): string {
  return name.replace(/[^\w.\-\s()]/g, '_').replace(/\s+/g, ' ').trim() || 'original';
}

function mimeForExt(ext: string, file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Sube el archivo importado a Storage y registra adjunto principal (formato original). */
export async function uploadImportedOriginal(
  supabase: SupabaseClient,
  docId: string,
  file: File,
  userId: string
): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const safeName = safeStorageFileName(file.name);
  const filePath = `${docId}/${safeName}`;
  const contentType = mimeForExt(ext, file);

  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { contentType, upsert: true });

  if (uploadErr) throw uploadErr;

  const { error: dbErr } = await supabase.from('attachments').insert({
    document_id: docId,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: contentType,
    uploaded_by: userId,
    is_main_file: true,
  });

  if (dbErr) throw dbErr;
}
