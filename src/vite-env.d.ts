/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Si `true` y no hay `VITE_AI_PROVIDER`, se usa Azure OpenAI (compatibilidad). */
  readonly VITE_ENABLE_COPILOT?: string;
  /** `ollama` (local, gratuito) o `azure` (Azure OpenAI). */
  readonly VITE_AI_PROVIDER?: string;
  /** Base HTTP de Ollama (p. ej. http://127.0.0.1:11434). */
  readonly VITE_OLLAMA_URL?: string;
  /** Nombre del modelo en Ollama (p. ej. llama3.2, mistral). */
  readonly VITE_OLLAMA_MODEL?: string;
  /** Tamaño de contexto (VRAM y tiempo por pasada); por defecto 2048. */
  readonly VITE_OLLAMA_NUM_CTX?: string;
  /** Máximo de tokens de salida; por defecto 768. */
  readonly VITE_OLLAMA_MAX_TOKENS?: string;
  /** Hilos CPU (opcional). */
  readonly VITE_OLLAMA_NUM_THREAD?: string;
  /** Tiempo que el modelo permanece cargado (p. ej. 10m = siguientes preguntas más rápidas). */
  readonly VITE_OLLAMA_KEEP_ALIVE?: string;
  /** Temperatura 0–2; por defecto 0.55 (algo más rápido/estable que 0.7). */
  readonly VITE_OLLAMA_TEMPERATURE?: string;
  /** Top-p muestreo; por defecto 0.92. */
  readonly VITE_OLLAMA_TOP_P?: string;
  /** Tope de caracteres de la base de conocimiento enviada al chat (truncado si sobra). */
  readonly VITE_OLLAMA_MAX_CONTEXT_CHARS?: string;
  /** Tope de caracteres del documento en acciones del editor (truncado si sobra). */
  readonly VITE_OLLAMA_MAX_INPUT_CHARS?: string;
  /** Tope más bajo para acciones que leen mucho texto (resumen, puntos clave, índice…). */
  readonly VITE_OLLAMA_MAX_INPUT_HEAVY_ACTION_CHARS?: string;
  /** Máx. tokens de salida solo para «Extraer puntos clave» (Ollama). */
  readonly VITE_OLLAMA_MAX_TOKENS_KEYPOINTS?: string;
  /** Máx. tokens de salida solo para «Resumir documento» (Ollama). */
  readonly VITE_OLLAMA_MAX_TOKENS_SUMMARY?: string;
  /** Documentos incluidos en el resumen para Copilot/búsqueda IA (5–60). */
  readonly VITE_COPILOT_CONTEXT_MAX_DOCS?: string;
  /** Caracteres de cada documento en ese resumen (80–2000). */
  readonly VITE_COPILOT_CONTEXT_SNIPPET_CHARS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
