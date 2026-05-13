import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { postProcessImportedHtml } from './importHtmlPostProcess';
import { extractHtmlFromPdfViaOcr, shouldUsePdfOcr, type PdfOcrProgress } from './importPdfOcr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

export type PdfExtractProgress = (info: { stage: 'text' | 'ocr'; message: string }) => void;

type Span = { str: string; x0: number; x1: number; fontSize: number; hasEOL: boolean };

type Line = { y: number; text: string; fontSize: number; endedWithHardEOL: boolean };

/** Une spans en una línea visual; inserta espacio aunque el PDF deje cajas pegadas. */
function joinSpansLine(spans: Span[]): { text: string; endedWithHardEOL: boolean } {
  if (spans.length === 0) return { text: '', endedWithHardEOL: false };
  const sorted = [...spans].sort((a, b) => a.x0 - b.x0);
  let out = '';
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = cur.x0 - prev.x1;
      const fs = Math.max(prev.fontSize, cur.fontSize, 8);
      const a = prev.str.replace(/\s+$/u, '');
      const b = cur.str.replace(/^\s+/u, '');
      let sep = '';
      if (gap > Math.max(0.2, fs * 0.026)) sep = ' ';
      else if (
        a.length > 0 &&
        b.length > 0 &&
        /[\p{L}\p{N}]$/u.test(a) &&
        /^[\p{L}\p{N}]/u.test(b) &&
        gap > -2.5
      ) {
        sep = ' ';
      }
      out += sep + cur.str;
    } else {
      out += cur.str;
    }
  }
  const endedWithHardEOL = sorted[sorted.length - 1]?.hasEOL ?? false;
  let text = out.replace(/\s+/g, ' ').trim();
  // Guion de fin de línea típico en PDF (partición de palabra)
  text = text.replace(/([\p{L}])-\s+([\p{L}])/gu, '$1$2');
  return { text, endedWithHardEOL };
}

function looksLikeBulletLine(t: string): boolean {
  const s = t.trim();
  if (s.length < 2 || s.length > 220) return false;
  return (
    /^[•·▪▸►-]\s*\S/u.test(s) ||
    /^\d{1,3}[.)]\s+\S/u.test(s) ||
    /^[a-z]\)\s+\S/i.test(s)
  );
}

function looksLikeHeadingLine(t: string, fontSize: number, avgSize: number): boolean {
  const s = t.trim();
  if (s.length < 3 || s.length > 140) return false;
  if (fontSize > avgSize * 1.22) return true;
  if (/^(Módulo\s+\d+|Capítulo\s+\d+|Anexo\s+[A-Z0-9]|SOP\s*\d|SOP\s+[—–-]|Índice|Glosario|Introducción|Conclusión|Referencias)\b/i.test(s)) {
    return true;
  }
  if (/^\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÑÜ]/.test(s) && s.length < 90) return true;
  return false;
}

/**
 * Extrae texto de un PDF a HTML semántico (p/h/ul) y lo pasa por postProcessImportedHtml.
 * Si la capa de texto es muy pobre (escaneo), usa OCR en el cliente (Tesseract).
 */
export async function extractPdfToHtml(file: File, onProgress?: PdfExtractProgress): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allLines: Line[] = [];
  let textLayerCharCount = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lineMap = new Map<
      number,
      { spans: Span[]; maxSize: number }
    >();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      textLayerCharCount += item.str.length;
      const hasEOL = Boolean(item.hasEOL);
      const y = Math.round(item.transform[5]);
      const fontSize = Math.abs(item.transform[3]) || 12;
      const x0 = item.transform[4];
      const w =
        typeof item.width === 'number' && item.width > 0
          ? item.width
          : item.str.length * fontSize * 0.52;
      const x1 = x0 + w;

      let bucketY = y;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          bucketY = existingY;
          break;
        }
      }

      if (!lineMap.has(bucketY)) {
        lineMap.set(bucketY, { spans: [], maxSize: fontSize });
      }
      const bucket = lineMap.get(bucketY)!;
      bucket.spans.push({ str: item.str, x0, x1, fontSize, hasEOL });
      bucket.maxSize = Math.max(bucket.maxSize, fontSize);
    }

    const sorted = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]);

    for (const [y, { spans, maxSize }] of sorted) {
      const { text, endedWithHardEOL } = joinSpansLine(spans);
      if (text) allLines.push({ y, text, fontSize: maxSize, endedWithHardEOL });
    }

    allLines.push({ y: -9999, text: '', fontSize: 0, endedWithHardEOL: false });
  }

  if (shouldUsePdfOcr(textLayerCharCount, pdf.numPages)) {
    onProgress?.({ stage: 'ocr', message: 'Capa de texto escasa: aplicando OCR en el navegador…' });
    const ocrProgress: PdfOcrProgress = (message, _pageIndex, totalPages) => {
      onProgress?.({
        stage: 'ocr',
        message: totalPages > 0 ? `${message}` : message,
      });
    };
    const ocrHtml = await extractHtmlFromPdfViaOcr(pdf, ocrProgress);
    return postProcessImportedHtml(ocrHtml);
  }

  onProgress?.({ stage: 'text', message: 'Extrayendo texto del PDF…' });

  const validLines = allLines.filter((l) => l.text && l.fontSize > 0);
  const avgSize =
    validLines.length > 0
      ? validLines.reduce((s, l) => s + l.fontSize, 0) / validLines.length
      : 12;

  /** Altura de línea típica por página (evita mezclar saltos entre páginas). */
  function medianLineHeightForPages(lines: Line[]): number {
    const pages: Line[][] = [];
    let cur: Line[] = [];
    for (const L of lines) {
      if (!L.text && L.y === -9999) {
        if (cur.length) pages.push(cur);
        cur = [];
      } else if (L.text && L.fontSize > 0) {
        cur.push(L);
      }
    }
    if (cur.length) pages.push(cur);

    const medians: number[] = [];
    for (const pl of pages) {
      const gaps: number[] = [];
      for (let i = 1; i < pl.length; i++) {
        const g = Math.abs(pl[i - 1].y - pl[i].y);
        if (g > 1 && g < 56) gaps.push(g);
      }
      if (gaps.length === 0) continue;
      gaps.sort((a, b) => a - b);
      medians.push(gaps[Math.floor(gaps.length / 2)]!);
    }
    if (medians.length === 0) return Math.max(avgSize * 1.12, 10);
    return medians.reduce((a, b) => a + b, 0) / medians.length;
  }

  const medianLh = medianLineHeightForPages(allLines);

  const htmlParts: string[] = [];
  let paragraph: string[] = [];
  let prevY: number | null = null;
  let prevEndedEOL = false;
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer
      .map((raw) => {
        const t = raw.replace(/^[•·▪▸►-]\s*/u, '').replace(/^\d{1,3}[.)]\s+/, '').replace(/^[a-z]\)\s+/i, '').trim();
        return `<li>${t}</li>`;
      })
      .join('');
    htmlParts.push(`<ul>${items}</ul>`);
    bulletBuffer = [];
  }

  function flushParagraph() {
    flushBullets();
    if (paragraph.length > 0) {
      const merged = paragraph.join(' ').replace(/\s+/g, ' ').trim();
      if (merged) htmlParts.push(`<p>${merged}</p>`);
      paragraph = [];
    }
  }

  for (const line of allLines) {
    if (!line.text) {
      flushParagraph();
      prevY = null;
      prevEndedEOL = false;
      continue;
    }

    const gap = prevY !== null ? Math.abs(prevY - line.y) : 0;
    const lh = Math.max(medianLh, line.fontSize * 0.9, 8);
    const isLargeGap = gap > lh * 2.15;
    const isMediumGap = gap > lh * 0.95;
    const isHeading = looksLikeHeadingLine(line.text, line.fontSize, avgSize);

    const lt = line.text.trim();
    const startsNewSection =
      paragraph.length > 0 &&
      /^(Módulo\s+\d+|Checklist\s*[—–-]|Diagrama\s*[—–-]|SOP\s+[—–:]|Plantillas?\s+y\s+diagramas|Plantilla\s*[—–-]|\d{1,2}\.\d{1,2}\s+\S|SOPs\s+[—–-]|Glosario\b|Autoevaluación\b|Índice\b)/i.test(
        lt,
      );

    if (isLargeGap || isHeading || startsNewSection) {
      flushParagraph();
    } else if (prevEndedEOL && isMediumGap) {
      flushParagraph();
    }

    if (isHeading) {
      const level =
        line.fontSize > avgSize * 1.58
          ? 'h1'
          : line.fontSize > avgSize * 1.32
            ? 'h2'
            : line.fontSize > avgSize * 1.18
              ? 'h3'
              : 'h4';
      htmlParts.push(`<${level}>${line.text}</${level}>`);
    } else if (looksLikeBulletLine(line.text)) {
      flushParagraph();
      bulletBuffer.push(line.text);
    } else {
      flushBullets();
      paragraph.push(line.text);
    }

    prevY = line.y;
    prevEndedEOL = line.endedWithHardEOL;
  }

  flushParagraph();
  return postProcessImportedHtml(htmlParts.join(''));
}
