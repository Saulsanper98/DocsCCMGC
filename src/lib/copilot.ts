import { getAiBackend } from './featureFlags';

const azureEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string;
const azureKey = import.meta.env.VITE_AZURE_OPENAI_KEY as string;
const deployment = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string || 'gpt-4o';

function ollamaBaseUrl(): string {
  const u = (import.meta.env.VITE_OLLAMA_URL as string | undefined)?.trim();
  return (u || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function ollamaModel(): string {
  return (import.meta.env.VITE_OLLAMA_MODEL as string | undefined)?.trim() || 'llama3.2';
}

/** Serializa llamadas a Ollama: evita varias inferencias a la vez (picos CPU/GPU y congelones). */
let ollamaRequestChain: Promise<unknown> = Promise.resolve();

function runOllamaExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = ollamaRequestChain.then(fn, fn);
  ollamaRequestChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function ollamaIntFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function ollamaFloatFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function truncateChars(text: string, maxChars: number, note: string): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n${note}`;
}

function ollamaNumThread(): number | undefined {
  const raw = (import.meta.env.VITE_OLLAMA_NUM_THREAD as string | undefined)?.trim();
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(32, n);
}

/** Cadena Ollama `keep_alive`: p. ej. `30s`, `0` (descarga el modelo al acabar). */
function ollamaKeepAlive(): string | number {
  const raw = (import.meta.env.VITE_OLLAMA_KEEP_ALIVE as string | undefined)?.trim();
  if (raw === undefined || raw === '') return '45s';
  if (raw === '0') return 0;
  const asNum = Number(raw);
  if (raw === String(asNum) && Number.isFinite(asNum)) return asNum;
  return raw;
}

export type CopilotAction =
  | 'improve_writing'
  | 'summarize'
  | 'generate_toc'
  | 'continue_writing'
  | 'extract_key_points'
  | 'check_consistency'
  | 'generate_checklist'
  | 'translate'
  | 'change_tone'
  | 'generate_template';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CopilotResponse {
  content: string;
  sources?: string[];
}

const actionPrompts: Record<CopilotAction, string> = {
  improve_writing: 'Mejora la redacción del siguiente texto manteniendo su significado, haciéndolo más claro y profesional. Devuelve solo el texto mejorado:',
  summarize: 'Genera un resumen ejecutivo de 3-5 puntos clave del siguiente documento. Usa formato de lista con viñetas:',
  generate_toc: 'Analiza los encabezados del siguiente contenido y genera una tabla de contenidos estructurada en formato Markdown:',
  continue_writing: 'Dado el contexto del siguiente texto, continúa escribiendo de forma coherente y natural con 2-3 párrafos adicionales:',
  extract_key_points:
    'Extrae entre 5 y 12 puntos clave del siguiente texto. Responde solo con una lista Markdown (líneas que empiecen por `- `). Cada ítem: una frase corta o dos como máximo. Sin párrafos introductorios ni conclusiones:',
  check_consistency: 'Analiza el siguiente texto y detecta posibles inconsistencias, términos contradictorios o información que pueda estar desactualizada:',
  generate_checklist: 'Convierte el siguiente procedimiento descrito en texto en una checklist accionable en formato Markdown con checkboxes:',
  translate: 'Traduce el siguiente texto al inglés manteniendo el formato y estructura:',
  change_tone: 'Reescribe el siguiente texto con un tono más formal y profesional, adecuado para documentación institucional:',
  generate_template: 'Basándote en la estructura del siguiente documento, genera una plantilla en blanco con la misma estructura pero con placeholders [CAMPO] para rellenar:',
};

async function callAzureOpenAI(messages: Message[]): Promise<string> {
  if (!azureEndpoint || !azureKey) {
    throw new Error('Azure OpenAI no configurado. Añade VITE_AZURE_OPENAI_ENDPOINT y VITE_AZURE_OPENAI_KEY en .env');
  }

  const url = `${azureEndpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureKey,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure OpenAI error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

/**
 * API nativa `/api/chat`: admite `options` (VRAM/RAM, hilos CPU) y `keep_alive`.
 * El reparto de capas CPU/GPU lo decide Ollama/llama.cpp (ver `ollama ps`: % CPU/GPU).
 */
async function callOllamaNativeChat(
  messages: Message[],
  optionOverrides?: Record<string, number>,
): Promise<string> {
  const base = ollamaBaseUrl();
  const model = ollamaModel();
  const url = `${base}/api/chat`;

  const numCtx = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_NUM_CTX, 2048, 512, 131072);
  const numPredict = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_TOKENS, 768, 32, 8192);
  const numThread = ollamaNumThread();
  const temperature = ollamaFloatFromEnv(import.meta.env.VITE_OLLAMA_TEMPERATURE, 0.55, 0, 2);
  const topP = ollamaFloatFromEnv(import.meta.env.VITE_OLLAMA_TOP_P, 0.92, 0.05, 1);

  const options: Record<string, number> = {
    num_ctx: numCtx,
    num_predict: numPredict,
    temperature,
    top_p: topP,
    ...optionOverrides,
  };
  if (numThread !== undefined) options.num_thread = numThread;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      keep_alive: ollamaKeepAlive(),
      options,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Ollama no respondió (${response.status}). ¿Servicio en marcha y modelo \`${model}\` (\`ollama pull ${model}\`)? ${err}`,
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
    error?: string;
  };
  if (data.error) {
    const msg =
      typeof data.error === 'string'
        ? data.error
        : typeof data.error === 'object' && data.error !== null && 'message' in data.error
          ? String((data.error as { message?: unknown }).message ?? 'Error en Ollama')
          : 'Error en Ollama';
    throw new Error(msg);
  }
  return data.message?.content ?? '';
}

async function callChatCompletions(
  messages: Message[],
  ollamaOptionOverrides?: Record<string, number>,
): Promise<string> {
  const backend = getAiBackend();
  if (backend === null) {
    throw new Error(
      'Asistente IA no habilitado. Para Ollama gratuito local: VITE_AI_PROVIDER=ollama. Para Azure: VITE_AI_PROVIDER=azure o VITE_ENABLE_COPILOT=true y credenciales.',
    );
  }
  if (backend === 'ollama') {
    return runOllamaExclusive(() => callOllamaNativeChat(messages, ollamaOptionOverrides));
  }
  return callAzureOpenAI(messages);
}

const HEAVY_INPUT_ACTIONS: CopilotAction[] = [
  'extract_key_points',
  'summarize',
  'check_consistency',
  'generate_toc',
  'generate_checklist',
];

function ollamaInputCapForAction(action: CopilotAction): number {
  const maxIn = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_INPUT_CHARS, 24000, 2000, 500000);
  if (!HEAVY_INPUT_ACTIONS.includes(action)) return maxIn;
  const heavyCap = ollamaIntFromEnv(
    import.meta.env.VITE_OLLAMA_MAX_INPUT_HEAVY_ACTION_CHARS,
    12000,
    2000,
    maxIn,
  );
  return Math.min(maxIn, heavyCap);
}

function ollamaOptionOverridesForAction(action: CopilotAction): Record<string, number> | undefined {
  if (getAiBackend() !== 'ollama') return undefined;
  const baseCtx = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_NUM_CTX, 2048, 512, 131072);
  const basePred = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_TOKENS, 768, 32, 8192);
  if (action === 'extract_key_points') {
    const pred = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_TOKENS_KEYPOINTS, 448, 64, basePred);
    return {
      num_predict: Math.min(basePred, pred),
      num_ctx: Math.min(baseCtx, 1792),
    };
  }
  if (action === 'summarize') {
    const pred = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_TOKENS_SUMMARY, 512, 64, basePred);
    return { num_predict: Math.min(basePred, pred) };
  }
  return undefined;
}

export const copilot = {
  async transform(action: CopilotAction, content: string): Promise<string> {
    const systemPrompt = 'Eres un asistente experto del Centro de Control de la Movilidad de Gran Canaria (CCMGC). Ayudas con la gestión de documentación técnica y operativa.';
    let body = content;
    if (getAiBackend() === 'ollama') {
      const cap = ollamaInputCapForAction(action);
      body = truncateChars(
        body,
        cap,
        '[Texto truncado para acelerar la inferencia. Ajusta VITE_OLLAMA_MAX_INPUT_HEAVY_ACTION_CHARS o VITE_OLLAMA_MAX_INPUT_CHARS en .env.]',
      );
    }
    const userPrompt = `${actionPrompts[action]}\n\n${body}`;

    return callChatCompletions(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ollamaOptionOverridesForAction(action),
    );
  },

  async chat(
    message: string,
    context: string,
    history: Message[]
  ): Promise<CopilotResponse> {
    let ctx = context;
    if (getAiBackend() === 'ollama') {
      const maxCtx = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_CONTEXT_CHARS, 12000, 2000, 500000);
      ctx = truncateChars(
        ctx,
        maxCtx,
        '[Base de conocimiento truncada para acelerar; sube VITE_OLLAMA_MAX_CONTEXT_CHARS o reduce documentos en contexto.]',
      );
    }
    const systemPrompt = `Eres el asistente de conocimiento del CCMGC. Tienes acceso a la base de documentación del departamento. Responde de forma precisa y cita los documentos fuente cuando sea relevante.

Base de conocimiento disponible:
${ctx}`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const content = await callChatCompletions(messages);
    return { content };
  },

  isConfigured(): boolean {
    const backend = getAiBackend();
    if (backend === null) return false;
    if (backend === 'ollama') return true;
    return !!(azureEndpoint && azureKey);
  },

  /** Etiqueta breve para la UI (cabeceras, administración). */
  providerLabel(): string {
    const b = getAiBackend();
    if (b === 'ollama') {
      const ctx = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_NUM_CTX, 2048, 512, 131072);
      const pred = ollamaIntFromEnv(import.meta.env.VITE_OLLAMA_MAX_TOKENS, 768, 32, 8192);
      return `Ollama · ${ollamaModel()} · ctx ${ctx} · salida ≤${pred} tok`;
    }
    if (b === 'azure') return `Azure OpenAI · ${deployment}`;
    return '—';
  },
};
