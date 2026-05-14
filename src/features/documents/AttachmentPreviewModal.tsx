import { useState, useEffect } from 'react';
import { X, Download, Loader2, ExternalLink } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { Attachment } from '@/shared/types';
import { Button } from '@/shared/components/ui/Button';
import { postProcessImportedHtml } from './importHtmlPostProcess';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface AttachmentPreviewModalProps {
  attachment: Attachment;
  onClose: () => void;
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(720);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const mime = attachment.mime_type ?? '';
  const nameLower = attachment.file_name.toLowerCase();
  const isPdf = mime.includes('pdf') || nameLower.endsWith('.pdf');
  const isDocx =
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    nameLower.endsWith('.docx') ||
    nameLower.endsWith('.doc');
  const isImage = mime.startsWith('image/');
  const isText =
    mime.startsWith('text/') ||
    mime.includes('markdown') ||
    /\.(txt|md|markdown)$/i.test(attachment.file_name);

  useEffect(() => {
    const measure = () => setPageWidth(Math.min(880, Math.floor(window.innerWidth - 64)));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!attachment.url || !isDocx) return;
    let cancelled = false;
    setDocxLoading(true);
    setDocxError(null);
    (async () => {
      try {
        const res = await fetch(attachment.url!);
        if (!res.ok) throw new Error('No se pudo descargar el archivo');
        const buf = await res.arrayBuffer();
        const mammoth = await import('mammoth');
        const { value } = await mammoth.convertToHtml({
          arrayBuffer: buf,
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Título 1'] => h1:fresh",
            "p[style-name='Título 2'] => h2:fresh",
          ],
        } as Parameters<typeof mammoth.convertToHtml>[0]);
        if (!cancelled) setDocxHtml(postProcessImportedHtml(value));
      } catch (e) {
        if (!cancelled) setDocxError(e instanceof Error ? e.message : 'Error al generar vista previa');
      } finally {
        if (!cancelled) setDocxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.url, isDocx]);

  useEffect(() => {
    if (!attachment.url || !isText) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(attachment.url!);
        const t = await res.text();
        if (!cancelled) setTextContent(t);
      } catch {
        if (!cancelled) setTextContent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.url, isText]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl ring-1 ring-white/10"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-b from-[var(--muted)]/80 to-[var(--card)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Vista previa
            </p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)]" title={attachment.file_name}>
              {attachment.file_name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {attachment.url && (
              <>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Nueva pestaña
                </a>
                <a
                  href={attachment.url}
                  download={attachment.file_name}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-white hover:opacity-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]">
          {!attachment.url ? (
            <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">
              No hay URL de descarga disponible.
            </p>
          ) : isPdf ? (
            <div className="mx-auto w-full max-w-none px-4 py-6">
              {pdfError ? (
                <p className="text-center text-sm text-[var(--destructive)]">{pdfError}</p>
              ) : (
                <>
                  {pdfLoading && (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-10 w-10 animate-spin text-[var(--accent)]" />
                    </div>
                  )}
                  <Document
                    file={attachment.url}
                    loading={null}
                    onLoadSuccess={({ numPages: n }) => {
                      setNumPages(n);
                      setPdfLoading(false);
                      setPdfError(null);
                    }}
                    onLoadError={(err) => {
                      setPdfError(err.message || 'No se pudo cargar el PDF');
                      setPdfLoading(false);
                    }}
                    className="flex flex-col items-center gap-4"
                  >
                    {Array.from({ length: numPages }, (_, i) => (
                      <Page
                        key={i}
                        pageNumber={i + 1}
                        width={pageWidth}
                        className="rounded-lg shadow-lg ring-1 ring-black/20"
                        renderTextLayer
                        renderAnnotationLayer
                      />
                    ))}
                  </Document>
                </>
              )}
            </div>
          ) : isDocx ? (
            <div className="mx-auto w-full max-w-none px-4 py-8 sm:px-6">
              {docxLoading && (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
                </div>
              )}
              {docxError && (
                <p className="text-center text-sm text-[var(--destructive)]">{docxError}</p>
              )}
              {!docxLoading && docxHtml && (
                <article
                  className="doc-view-article ProseMirror rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 shadow-inner"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
            </div>
          ) : isImage ? (
            <div className="flex justify-center p-6">
              <img
                src={attachment.url}
                alt={attachment.file_name}
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          ) : isText && textContent !== null ? (
            <pre className="mx-auto w-full max-w-none whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-[var(--foreground)] sm:p-8">
              {textContent}
            </pre>
          ) : (
            <div className="space-y-4 p-10 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Vista previa integrada no disponible para este tipo de archivo. Ábrelo en una pestaña nueva
                o descárgalo.
              </p>
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
