/** Tipos que pueden abrirse en el visor integrado (PDF, Word, imagen, texto). */
export function attachmentSupportsPreview(mime: string | undefined, fileName: string): boolean {
  const m = (mime ?? '').toLowerCase();
  const n = fileName.toLowerCase();
  if (m.includes('pdf') || /\.pdf$/i.test(n)) return true;
  if (m.includes('word') || m.includes('officedocument') || /\.docx?$/i.test(n)) return true;
  if (m.startsWith('image/')) return true;
  if (m.startsWith('text/') || m.includes('markdown') || /\.(txt|md|markdown)$/i.test(n)) return true;
  return false;
}
