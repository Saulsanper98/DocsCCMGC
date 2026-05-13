import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, FileCode, File, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/app/store';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import toast from 'react-hot-toast';
import { uploadImportedOriginal } from './importUpload';
import { postProcessImportedHtml } from './importHtmlPostProcess';
import { extractPdfToHtml, type PdfExtractProgress } from './importPdf';

interface ImportModalProps {
  onClose: () => void;
}

type ParseStatus = 'idle' | 'parsing' | 'done' | 'error';

const ACCEPTED = '.md,.markdown,.txt,.docx,.pdf';
const MAX_SIZE_MB = 20;

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'md' || ext === 'markdown') return FileCode;
  if (ext === 'docx') return FileText;
  return File;
}

function stripFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}

// Markdown → HTML
function mdToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks first (before other replacements)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/((?:^[*-] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[*-] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    const b = block.trim();
    if (!b) return '';
    if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(b)) return b;
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  // styleMap es válido en mammoth; los tipos publicados a veces no lo incluyen
  const result = await mammoth.convertToHtml({
    arrayBuffer,
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Título'] => h1:fresh",
      "p[style-name='Título 1'] => h1:fresh",
      "p[style-name='Título 2'] => h2:fresh",
      "p[style-name='Título 3'] => h3:fresh",
      "p[style-name='Subtítulo'] => h2:fresh",
    ],
  } as Parameters<typeof mammoth.convertToHtml>[0]);
  return postProcessImportedHtml(result.value);
}

async function parsePdf(file: File, onProgress?: PdfExtractProgress): Promise<string> {
  return extractPdfToHtml(file, onProgress);
}

async function parseTxt(file: File): Promise<string> {
  const text = await file.text();
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function parseFile(file: File, onProgress?: PdfExtractProgress): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'md' || ext === 'markdown') return postProcessImportedHtml(mdToHtml(await file.text()));
  if (ext === 'txt') return postProcessImportedHtml(await parseTxt(file));
  if (ext === 'docx') return parseDocx(file);
  if (ext === 'pdf') return parsePdf(file, onProgress);
  throw new Error(`Formato no soportado: .${ext}`);
}

export function ImportModal({ onClose }: ImportModalProps) {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState('');

  const selectFile = useCallback((f: File) => {
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_SIZE_MB} MB`);
      return;
    }
    setFile(f);
    setTitle(stripFilename(f.name));
    setStatus('idle');
    setError('');
    setImportPhase('');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }, [selectFile]);

  async function handleImport() {
    if (!file || !user) return;
    setStatus('parsing');
    setImporting(true);
    setImportPhase('');
    try {
      const html = await parseFile(file, (info) => setImportPhase(info.message));

      const { data, error: err } = await supabase
        .from('documents')
        .insert({
          title: title || stripFilename(file.name),
          content: { type: 'doc', content: [] },
          content_text: '',
          author_id: user.id,
          status: 'draft',
          metadata: { imported_from: file.name, import_html: html },
        })
        .select()
        .single();

      if (err) throw err;
      const docId = (data as { id: string }).id;

      await uploadImportedOriginal(supabase, docId, file, user.id);

      setStatus('done');
      toast.success('Importado — texto editable y archivo original disponible como adjunto');
      onClose();
      navigate(`/documentos/${docId}/editar`);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setImporting(false);
      setImportPhase('');
    }
  }

  const FileIcon = file ? fileIcon(file.name) : Upload;

  return (
    <div className="fixed inset-0 z-app-modal flex items-center justify-center p-4" data-docbrain-overlay onClick={onClose}>
      <div className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
      <div
        className="relative w-full max-w-lg bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl ring-1 ring-black/[0.06] dark:ring-white/12 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Importar documento</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
              dragging
                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--muted)]'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileIcon className="w-10 h-10 text-[var(--accent)]" />
                <p className="text-sm font-medium text-[var(--foreground)]">{file.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[var(--muted-foreground)]">
                <Upload className="w-10 h-10 opacity-40" />
                <p className="text-sm font-medium">Arrastra un archivo aquí</p>
                <p className="text-xs">o haz clic para seleccionar</p>
                <p className="text-xs mt-1 opacity-60">.md · .txt · .docx · .pdf — máx {MAX_SIZE_MB} MB</p>
              </div>
            )}
          </div>

          {/* Status feedback */}
          {status === 'parsing' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Procesando archivo…
              </div>
              {importPhase ? (
                <p className="text-xs leading-snug text-[var(--muted-foreground)] pl-6">{importPhase}</p>
              ) : null}
            </div>
          )}
          {status === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Importado correctamente
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-[var(--destructive)]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <p className="text-xs leading-relaxed text-[var(--muted-foreground)] rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2.5">
            <span className="font-medium text-[var(--foreground)]">Sobre PDF:</span> primero leemos la capa de texto; si es muy escasa (escaneo), se aplica <strong className="font-medium text-[var(--foreground)]">OCR en el navegador</strong> (Tesseract, spa+eng). Puede tardar en documentos largos. Luego refinamos párrafos y listas.
          </p>

          {/* Title override */}
          {file && (
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-1">
                Título del documento
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={!file || importing || status === 'done'}
            loading={importing}
          >
            <Upload className="w-4 h-4" />
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}
