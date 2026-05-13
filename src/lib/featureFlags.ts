/**
 * Proveedor del asistente conversacional en la UI.
 * - `ollama`: modelos locales gratuitos (Ollama + `ollama pull <modelo>`).
 * - `azure`: Azure OpenAI (licencia / coste).
 *
 * Prioridad: `VITE_AI_PROVIDER` explícito; si no, `VITE_ENABLE_COPILOT=true` implica Azure (compatibilidad).
 */
export type AiBackend = 'azure' | 'ollama';

export function getAiBackend(): AiBackend | null {
  const raw = (import.meta.env.VITE_AI_PROVIDER as string | undefined)?.trim().toLowerCase();
  if (raw === 'ollama') return 'ollama';
  if (raw === 'azure') return 'azure';
  if (import.meta.env.VITE_ENABLE_COPILOT === 'true') return 'azure';
  return null;
}

/** Muestra navegación y paneles del asistente (Copilot / Ollama / Azure). */
export function isCopilotUiEnabled(): boolean {
  return getAiBackend() !== null;
}
