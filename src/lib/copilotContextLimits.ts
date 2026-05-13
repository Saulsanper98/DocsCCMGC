/** Limites del resumen de documentos que se envia al asistente (menos texto = menos latencia). */
export function getCopilotContextFetchLimits(): { maxDocs: number; snippetChars: number } {
  const docs = Number.parseInt(import.meta.env.VITE_COPILOT_CONTEXT_MAX_DOCS ?? '18', 10);
  const snip = Number.parseInt(import.meta.env.VITE_COPILOT_CONTEXT_SNIPPET_CHARS ?? '280', 10);
  return {
    maxDocs: Number.isFinite(docs) ? Math.min(60, Math.max(5, docs)) : 18,
    snippetChars: Number.isFinite(snip) ? Math.min(2000, Math.max(80, snip)) : 280,
  };
}
