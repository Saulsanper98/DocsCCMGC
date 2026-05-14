/**
 * Refina HTML generado por PDF.js / mammoth: índices pegados, pasos sin espacio
 * tras el número, glosario (acrónimos pegados), diagramas ASCII, etc.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Texto plano para heurísticas de importación: quita marcas inline (&lt;strong&gt;, etc.),
 * convierte &lt;br&gt; en espacio para recuperar saltos que el PDF metió dentro del mismo &lt;p&gt;.
 */
export function plainTextForImportHeuristics(htmlish: string): string {
  return htmlish
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Artefactos típicicos de extracción PDF: guiones o espacios sustituidos por "n" o pegados sin espacio.
 * Orden: frases largas antes que cortas para evitar solapes.
 */
function applyPdfGhostingHyphenFixes(t: string): string {
  return t
    .replace(/\bKVMnovernIP\b/gi, 'KVM over IP')
    .replace(/\bBAREnMETAL\b/g, 'Bare metal')
    .replace(/\bBarenMETAL\b/gi, 'Bare metal')
    .replace(/\bNIST\s*800n88\b/gi, 'NIST SP 800-88')
    .replace(/\bactivasnactivas\b/gi, 'activo-activo')
    .replace(/\bdualnfabric\b/gi, 'dual-fabric')
    .replace(/\bPostninstalaci[oó]n\b/gi, 'Post-instalación')
    .replace(/\bpostninstalaci[oó]n\b/gi, 'post-instalación')
    .replace(/\bAMDnV\b/g, 'AMD-V')
    .replace(/\bVTnx\b/g, 'VT-x')
    .replace(/\bSRnIOV\b/gi, 'SR-IOV')
    .replace(/\b3n2n1\b/g, '3-2-1')
    .replace(/\boffnsite\b/gi, 'off-site')
    .replace(/\bhotnspares\b/gi, 'hot spares')
    .replace(/\bhotnspare\b/gi, 'hot spare')
    .replace(/\bhotnswap\b/gi, 'hot-swap')
    .replace(/\bbarenmetal\b/gi, 'bare-metal')
    .replace(/\biDRACniLO\b/gi, 'iDRAC / iLO')
    .replace(/\biLOniDRAC\b/gi, 'iLO / iDRAC');
}

/** Viñetas y puntos típicos tras extracción: sin espacio tras • o repetición errónea tipo "11)". */
function normalizeImportedListsAndMarks(t: string): string {
  let s = t
    /* Espacio después de bullet (Unicode); texto pegado tras • sin espacio */
    .replace(/([\S\u00A0])(\u2022)(?=\S)/gu, '$1$2 ')
    .replace(/([^\s\n•])\s*•(?=\S)/g, '$1 • ');
  /* Pregunta "11) texto" → "1) texto"; "22)" → "2)" (lista numerada pegada mal al exportar PDF) */
  s = s.replace(/\b(\d)\1+\)\s*/g, '$1) ');
  return s;
}

/** Reemplazos frecuentes al extraer PDFs de documentación técnica (es). */
function applyKnownTypoMap(t: string): string {
  return normalizeImportedListsAndMarks(
    applyPdfGhostingHyphenFixes(t)
      .replace(/\bIntermediondidáctico\b/gi, 'Intermedio · Didáctico')
      .replace(/\blineninteractive\b/gi, 'line-interactive')
      .replace(/\bhotnspots\b/gi, 'hotspots')
      .replace(/\bracknUnpuerto\b/gi, 'rack / U / puerto')
      .replace(/\bSOPn(\d+)\b/gi, 'SOP $1')
      .replace(/\bPSUn([AB])\b/g, 'PSU $1')
      .replace(/\bPDUn([AB])\b/g, 'PDU $1'),
  );
}

/**
 * PDFs a veces devuelven párrafos casi todo en minúsculas. Solo si hay muy pocas mayúsculas,
 * capitaliza la primera letra del fragmento (es-ES) para mejorar legibilidad sin tocar siglas densas.
 */
function maybeFixAllLowercaseProse(s: string): string {
  const core = s.trim();
  if (core.length < 36) return s;
  const letters = core.match(/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g);
  if (!letters || letters.length < 28) return s;
  let upper = 0;
  for (const c of letters) {
    if (c !== c.toLowerCase()) upper++;
  }
  if (upper / letters.length > 0.065) return s;
  const fc = core[0];
  if (!/[a-záéíóúñü]/.test(fc)) return s;
  const rest = core.slice(1);
  const fixedCore = fc.toLocaleUpperCase('es-ES') + rest;
  const leadLen = s.indexOf(core);
  if (leadLen < 0) return s;
  return s.slice(0, leadLen) + fixedCore + s.slice(leadLen + core.length);
}

export function fixGluedPlainText(s: string): string {
  let t = applyKnownTypoMap(s.normalize('NFC'));
  // Palabra minúscula pegada a siguiente palabra con mayúscula inicial ("servidorEl" → "servidor El")
  t = t.replace(/([a-záéíóúñü]{2,})([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})\b/g, '$1 $2');

  for (let i = 0; i < 5; i++) {
    const before = t;

    // Subsecciones tipo "1. 1 Tipos de rack" → "1.1 Tipos" (solo si sigue texto de sección)
    t = t.replace(/(\d+)\.\s+(\d{1,2})\s+(?=[A-ZÁÉÍÓÚÑÜ])/g, '$1.$2 ');

    // Palabra en minúscula + dígito + paso pegados ("ción1Dibuja", "ación1Solicitar")
    t = t.replace(
      /\b([a-záéíóúñü]{4,})(\d{1,2})([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})\b/g,
      '$1 $2 $3',
    );

    // Tras separador o inicio: " 1Solicitar", "(1Solicitar"
    t = t.replace(
      /(^|[\s.:;,(])(\d{1,2})([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})\b/g,
      '$1$2 $3',
    );

    // Punto + número de paso: "EPI.2Verificar", "aire. 2 Calcula" (con espacios opcionales)
    t = t.replace(
      /([a-záéíóúñü0-9)])(\.)\s*(\d{1,2})\s+([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})\b/g,
      '$1$2 $3 $4',
    );
    t = t.replace(/([a-záéíóúñü0-9)])(\.)(\d{1,2})([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,})\b/g, '$1$2 $3 $4');

    // Sin punto entre frase e ítem: "aire2Calcula" → "aire. 2 Calcula"
    t = t.replace(
      /([a-záéíóúñü])(\d{1,2})([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{3,})\b/g,
      '$1. $2 $3',
    );

    // Doble letra inicial glosario: UUnidad → U — Unidad
    t = t.replace(/\b([A-Z])\1([a-záéíóúñü]{3,})\b/g, '$1 — $1$2');

    // Acrónimo corto + palabra pegada (PDURegleta, SAISistema); evita partir HTTPRequest (segunda parte larga)
    t = t.replace(/\b([A-Z]{2,5})([A-Z][a-záéíóúñü]{4,})\b/g, '$1 $2');

    // Tras punto/cierre sin espacio: .PDU o ).Sistema
    t = t.replace(/([a-záéíóúñü0-9)])(\.)([A-Z]{2,}[a-z]?)/g, '$1$2 $3');

    // Tras barra en siglas: /UPSSistema
    t = t.replace(/(\/[A-Z]{2,})([A-Z][a-záéíóúñü]{4,})\b/g, '$1 $2');

    // Índice: "capacidad9 SOPs" o "capacidad 9SOPs"
    t = t.replace(/\bcapacidad\s*(\d{1,2})\s*(SOPs)\b/gi, 'capacidad $1 $2');

    // Convenciones habituales
    t = t.replace(/(\d)(Módulo)/gi, '$1 $2');
    t = t.replace(/(\d)(Título)/gi, '$1 $2');

    // Compactar espacios sobrantes (sin tocar saltos que el caller gestione)
    t = t.replace(/[\u00a0]/g, ' ');
    t = t.replace(/ {2,}/g, ' ');

    if (t === before) break;
  }

  t = maybeFixAllLowercaseProse(t);
  return t.trim();
}

/** Párrafo que parece diagrama de rack / ASCII (varias U## o bloques entre corchetes). */
function looksLikeAsciiDiagram(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length < 40) return false;
  const rackLoose = (flat.match(/\bU\s*\d{1,2}\b/gi) || []).length;
  const rack = (flat.match(/\bU\d{1,2}\b/g) || []).length;
  const rackUnits = Math.max(rackLoose, rack);
  const brackets = (flat.match(/\[[^\]]{1,40}\]/g) || []).length;
  const bars = (flat.match(/\|{2,}/g) || []).length;
  const score = rackUnits + brackets + bars * 2;
  if (score >= 4) return true;
  if (rackUnits >= 3) return flat.length >= 80;
  if (rackUnits >= 2 && brackets >= 2) return true;
  return false;
}

/**
 * Índice en un solo párrafo: "1 Módulo 1 — … 2 Módulo 2 — …" (pdf.js junta líneas).
 */
function trySplitDenseIndexParagraph(trimmed: string): string | null {
  if (/<[a-z]/i.test(trimmed)) return null;
  const t = fixGluedPlainText(trimmed.replace(/\s+/g, ' ')).trim();
  const numberedMod = (t.match(/\d+\s+Módulo\s+\d+/gi) ?? []).length;
  if (numberedMod >= 2) {
    const parts = t.split(/\s+(?=\d+\s+Módulo\s+\d+)/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.map((p) => `<p class="import-toc-line">${fixGluedPlainText(p)}</p>`).join('');
    }
  }
  const bareMod = (t.match(/Módulo\s+\d+\s*[—–-]/gi) ?? []).length;
  if (bareMod >= 2) {
    const parts = t.split(/\s+(?=Módulo\s+\d+\s+[—–-])/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.map((p) => `<p class="import-toc-line">${fixGluedPlainText(p)}</p>`).join('');
    }
  }
  return null;
}

/** Repara HTML ya guardado (un &lt;p&gt; con todo el índice). Idempotente si ya está partido. */
export function repairDenseIndexInHtml(html: string): string {
  return repairImportArtifactsInHtml(html);
}

/**
 * Reparaciones al abrir el editor: índice en un &lt;p&gt;, en &lt;li&gt;&lt;p&gt; (TipTap),
 * y línea "capacidad 9 SOPs" pegada al módulo 8.
 */
export function repairImportArtifactsInHtml(html: string): string {
  let s = html;

  // Lista ordenada (TipTap): un <li> con "… capacidad 9 SOPs …"
  s = s.replace(/<li[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, (full, inner: string) => {
    const plain = plainTextForImportHeuristics(inner);
    if (!plain) return full;
    const cap = trySplitCapacidadSopIndexLine(plain);
    if (!cap) return full;
    const chunks = [...cap.matchAll(/<p class="import-toc-line">([\s\S]*?)<\/p>/g)];
    if (chunks.length !== 2) return full;
    return (
      `<li class="import-toc-line"><p>${chunks[0][1]}</p></li>` +
      `<li class="import-toc-line"><p>${chunks[1][1]}</p></li>`
    );
  });

  s = s.replace(/<p>([\s\S]*?)<\/p>/gi, (full, inner: string) => {
    const plain = plainTextForImportHeuristics(inner);
    if (!plain) return full;
    return (
      trySplitDenseIndexParagraph(plain) ??
      trySplitCapacidadSopIndexLine(plain) ??
      full
    );
  });

  return s;
}

/**
 * Índice: "Módulo 8 — … y capacidad 9 SOPs — …" en un solo párrafo → dos entradas.
 * (El test del prefijo que termina exactamente en "capacidad" fallaba con espacios raros del PDF.)
 */
function trySplitCapacidadSopIndexLine(trimmed: string): string | null {
  if (/<[a-z]/i.test(trimmed)) return null;
  const t = fixGluedPlainText(trimmed.replace(/\s+/g, ' ')).trim();
  const m = t.match(/^(.+?\bcapacidad)\s+(\d{1,2})\s+(SOPs\b[\s\S]*)$/i);
  if (!m) return null;
  const first = m[1].trim();
  const second = `${m[2]} ${m[3]}`.trim();
  if (first.length < 20 || second.length < 8) return null;

  return `<p class="import-toc-line">${fixGluedPlainText(first)}</p><p class="import-toc-line">${fixGluedPlainText(second)}</p>`;
}

/**
 * Autoevaluación en viñetas sin números: "Autoevaluación … Dibuja … Calcula … Define …"
 * (el PDF a veces elimina el "1. 2. 3.").
 */
function trySplitAutoevalImperativeParagraph(trimmed: string): string | null {
  const t = normalizeAutoevaluaciónNumbering(fixGluedPlainText(trimmed.replace(/\s+/g, ' '))).trim();
  if (t.length < 40 || !/\bAutoevaluación\b/i.test(t)) return null;

  const IMP =
    'Dibuja|Calcula|Define|Describe|Explica|Lista|Indica|Completa|Señala|Nombra|Elabora|Enumera|Justifica|Analiza|Compara';
  const splitRe = new RegExp(`\\s+(?=(?:${IMP})\\b)`, 'i');
  const parts = t.split(splitRe).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const first = parts[0];
  if (!/^Autoevaluación\b/i.test(first)) return null;
  const rest = parts.slice(1);
  if (rest.length < 2) return null;

  const leadVerb = new RegExp(`^(?:${IMP})\\b`, 'i');
  if (!rest.every((r) => leadVerb.test(r))) return null;

  const introHtml = `<p class="import-exercise-intro">${fixGluedPlainText(first)}</p>`;
  const itemsHtml = rest.map((r) => `<li>${fixGluedPlainText(r.trim())}</li>`).join('');

  return `${introHtml}<ul class="import-imperative-exercises">${itemsHtml}</ul>`;
}

/**
 * Autoevaluación / ejercicios: un solo <p> con "… 1 Verbo … 2 Verbo … 3 Verbo".
 * Separa en título corto + lista ordenada (el PDF suele perder saltos entre ítems).
 */
/** "Autoevaluación1Dibuja" / "Autoevaluación 1Dibuja" → espacios correctos antes de la lista numerada */
function normalizeAutoevaluaciónNumbering(t: string): string {
  return t
    .replace(/\bAutoevaluación(\d{1,2})\b/gi, 'Autoevaluación $1')
    .replace(/\bAutoevaluación[ \t]*(\d{1,2})([A-ZÁÉÍÓÚÑÜ])/gi, 'Autoevaluación $1 $2');
}

function trySplitNumberedExerciseParagraph(trimmed: string): string | null {
  const t = normalizeAutoevaluaciónNumbering(fixGluedPlainText(trimmed.replace(/\s+/g, ' '))).trim();
  if (t.length < 50) return null;

  // Partir delante de " N " cuando N es 1–2 dígitos y va seguido de verbo/oración (mayúscula inicial + minúsculas)
  const sep = /\s+(?=\d{1,2}\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,}\b)/g;
  const parts = t.split(sep).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let intro: string | null = null;
  let numberedParts: string[];

  if (/^\d{1,2}\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]/.test(parts[0])) {
    numberedParts = parts;
  } else {
    intro = parts[0];
    numberedParts = parts.slice(1);
  }

  if (numberedParts.length < 2) return null;

  const itemRe = /^\d{1,2}\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]/;
  if (!numberedParts.every((s) => itemRe.test(s))) return null;

  const introHtml =
    intro && intro.length > 0 ? `<p class="import-exercise-intro">${fixGluedPlainText(intro)}</p>` : '';

  const itemsHtml = numberedParts
    .map((s) => {
      const body = s.replace(/^\d{1,2}\s+/, '').trim();
      return `<li>${fixGluedPlainText(body)}</li>`;
    })
    .join('');

  return `${introHtml}<ol class="import-numbered-exercises">${itemsHtml}</ol>`;
}

/**
 * Glosario denso: varias entradas separadas solo por ". " + sigla o término corto.
 * Parte en párrafos más cortos (sin tocar bloques ya estructurados).
 */
function trySplitGlossaryParagraph(trimmed: string): string | null {
  const t = trimmed.replace(/\s+/g, ' ').trim();
  if (t.length < 120) return null;
  if (/^[\s\S]*<\s*[/?a-z]/i.test(trimmed)) return null;

  const sepClassic =
    /(?<=[a-záéíóúñü)]\.)\s+(?=(?:[A-ZÁÉÍÓÚÑÜ]{2,5}\s+[a-záéíóúñü]|[A-ZÁÉÍÓÚÑÜ]\s+[—–-]|\bU\s+[Uu]nidad\b))/gi;

  /** Glosario técnico: ". PDU …", ". SAI/UPS …", ". Blanking …" (sigla o marca tras punto) */
  const sepTech = /\. (?=(?:(?:PDU|SAI|BMC|CRAC|Blanking)\b|SAI\/|BMC\/|CRAC\/|U\s+Unidad))/gi;

  let parts = t.split(sepClassic).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) {
    parts = t.split(sepTech).map((p) => p.trim()).filter(Boolean);
  }
  if (parts.length < 3) return null;
  if (parts.some((p) => p.length < 10)) return null;

  return parts
    .map((p) => `<p class="import-gloss-line">${fixGluedPlainText(p)}</p>`)
    .join('');
}

function fixHeadingInner(inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed || /<[a-z]/i.test(trimmed)) return inner;
  return fixGluedPlainText(trimmed);
}

/**
 * Procesa el interior de un único <p> (sin anidar otro bloque).
 */
function processSingleParagraphInner(inner: string): string {
  const trimmed = inner.trim();
  if (!trimmed) return '<p></p>';

  const plainForSplit = plainTextForImportHeuristics(trimmed);
  const skipExerciseSplits = /<(?:table|ul|ol|pre|blockquote)\b/i.test(trimmed);

  if (!skipExerciseSplits && looksLikeAsciiDiagram(plainForSplit)) {
    // TipTap espera pre>code con language-* para mapear a codeBlock con fuente monoespaciada
    return `<pre class="import-ascii-block"><code class="language-ascii">${escapeHtml(plainForSplit)}</code></pre>`;
  }

  const denseIdx = trySplitDenseIndexParagraph(plainForSplit);
  if (denseIdx) return denseIdx;

  const capSop = trySplitCapacidadSopIndexLine(plainForSplit);
  if (capSop) return capSop;

  const exercises = !skipExerciseSplits && trySplitNumberedExerciseParagraph(plainForSplit);
  if (exercises) return exercises;

  const imperative = !skipExerciseSplits && trySplitAutoevalImperativeParagraph(plainForSplit);
  if (imperative) return imperative;

  const gloss = trySplitGlossaryParagraph(plainForSplit);
  if (gloss) return gloss;

  const modCount = (plainForSplit.match(/\d+\s*Módulo/gi) || []).length;
  if (modCount > 1) {
    const parts = plainForSplit.split(/(?=\d+\s*Módulo)/i).filter(Boolean);
    return parts
      .map((p) => {
        const fixed = fixGluedPlainText(p.trim().replace(/^[,;\s]+/, ''));
        return `<p class="import-toc-line">${fixed}</p>`;
      })
      .join('');
  }

  const numberedDash = plainForSplit.match(/\d+\s*[—–-]/g);
  if (numberedDash && numberedDash.length >= 3) {
    const parts = plainForSplit.split(/(?=\d+\s*[—–-]\s)/i).filter(Boolean);
    if (parts.length > 1) {
      return parts
        .map((p) => `<p class="import-toc-line">${fixGluedPlainText(p.trim())}</p>`)
        .join('');
    }
  }

  const fixed = fixGluedPlainText(plainForSplit.length > 0 ? plainForSplit : trimmed);
  return `<p>${fixed}</p>`;
}

/**
 * Refina HTML generado por PDF.js / mammoth: índices pegados, módulos sin espacio, etc.
 */
export function postProcessImportedHtml(html: string): string {
  let s = html;

  // Subapartado roto en dos párrafos: "7." y "Montaje y cableado" (saltos de página en el PDF)
  s = s.replace(
    /<p>\s*(\d{1,2})\.\s*<\/p>\s*<p>\s*([^<\d][^<]{0,120}?)<\/p>/gi,
    '<p class="import-subsection-heading"><span class="import-sec-num">$1.</span> $2</p>',
  );

  // Encabezados planos: corregir pegados típicos del PDF
  s = s.replace(
    /<h([1-4])>([\s\S]*?)<\/h\1>/gi,
    (m, level: string, inner: string) => {
      if (/<[a-z][\s\S]*>/i.test(inner.trim())) return m;
      return `<h${level}>${fixHeadingInner(inner)}</h${level}>`;
    },
  );

  s = s.replace(/<p>([\s\S]*?)<\/p>/gi, (_m, inner: string) => {
    return processSingleParagraphInner(inner);
  });

  return s;
}
