import { createWorker, PSM } from 'tesseract.js';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Menos de esto en todo el PDF → casi seguro escaneado o imagen. */
const MIN_TOTAL_CHARS = 96;
/** Caracteres por página por debajo de esto → probable escaneo o texto incrustado pobre. */
const MIN_CHARS_PER_PAGE = 72;
const MAX_RENDER_LONG_SIDE = 2100;

export type PdfOcrProgress = (message: string, pageIndex: number, totalPages: number) => void;

export function shouldUsePdfOcr(textLayerCharCount: number, numPages: number): boolean {
  if (numPages <= 0) return false;
  if (textLayerCharCount < MIN_TOTAL_CHARS) return true;
  return textLayerCharCount / numPages < MIN_CHARS_PER_PAGE;
}

/**
 * Rasteriza cada página y ejecuta Tesseract (spa+eng). Devuelve HTML simple (&lt;p&gt;, separadores de página).
 */
export async function extractHtmlFromPdfViaOcr(
  pdf: PDFDocumentProxy,
  onProgress?: PdfOcrProgress,
): Promise<string> {
  const total = pdf.numPages;
  onProgress?.('Preparando OCR (Tesseract, idiomas spa+eng)…', 0, total);

  const worker = await createWorker(['spa', 'eng'], undefined, {
    logger: (m) => {
      if (m.status === 'loading tesseract core') onProgress?.('OCR: cargando núcleo…', 0, total);
      if (m.status === 'loading language traineddata') onProgress?.('OCR: descargando modelos de idioma…', 0, total);
      if (m.status === 'initializing api') onProgress?.('OCR: inicializando…', 0, total);
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });

    const pageChunks: string[] = [];

    for (let pageNum = 1; pageNum <= total; pageNum++) {
      onProgress?.(`OCR página ${pageNum} de ${total}`, pageNum, total);
      const page = await pdf.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      let scale = 2;
      const longSide = Math.max(base.width, base.height) * scale;
      if (longSide > MAX_RENDER_LONG_SIDE) {
        scale = MAX_RENDER_LONG_SIDE / Math.max(base.width, base.height);
      }
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const w = Math.max(1, Math.floor(viewport.width));
      const h = Math.max(1, Math.floor(viewport.height));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo obtener contexto 2D del canvas');

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const {
        data: { text },
      } = await worker.recognize(canvas);
      const raw = (text ?? '').replace(/\r\n/g, '\n').trim();
      if (!raw) continue;

      const paragraphs = raw
        .split(/\n\s*\n+/)
        .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const inner =
        paragraphs.length > 0
          ? paragraphs.map((p) => `<p>${p}</p>`).join('')
          : `<p>${raw.replace(/\n/g, '<br>')}</p>`;

      if (pageNum > 1) {
        pageChunks.push('<hr class="import-ocr-page-sep" />');
      }
      pageChunks.push(inner);
    }

    return pageChunks.join('') || '<p>(OCR no extrajo texto legible. Prueba con un PDF de mayor calidad o escaneo más nítido.)</p>';
  } finally {
    await worker.terminate();
  }
}
