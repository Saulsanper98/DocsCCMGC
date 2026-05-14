import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Copy, Sparkles, BookOpen, FilePenLine, FolderTree, ListChecks } from 'lucide-react';
import { copilot } from '@/lib/copilot';
import { getCopilotContextFetchLimits } from '@/lib/copilotContextLimits';
import { getAiBackend, isCopilotUiEnabled } from '@/lib/featureFlags';
import { supabase } from '@/lib/supabase';
import { Button } from '@/shared/components/ui/Button';
import { Avatar } from '@/shared/components/ui/Avatar';
import { useAppStore } from '@/app/store';
import { cn } from '@/shared/utils/cn';
import { formatRelativeTime, formatAbsoluteDateTime } from '@/shared/utils/format';
import { toastSupabaseError } from '@/shared/utils/supabaseToast';
import toast from 'react-hot-toast';
import type { Document } from '@/shared/types';
import { markdownToSafeHtml } from '@/lib/markdownToSafeHtml';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const suggestions: { text: string; icon: typeof BookOpen }[] = [
  {
    icon: BookOpen,
    text: 'Resume en viñetas los puntos clave de los documentos publicados que tienes como contexto.',
  },
  {
    icon: FilePenLine,
    text: 'Ayúdame a redactar un párrafo introductorio para un procedimiento o guía que voy a subir a DocBrain.',
  },
  {
    icon: FolderTree,
    text: 'Sugiere cómo podría agrupar por temas o categorías la información que ves en los extractos cargados.',
  },
  {
    icon: ListChecks,
    text: 'Enumera una checklist de revisión antes de publicar un documento (metadatos, claridad, enlaces).',
  },
];

/** Tipografía para HTML generado desde Markdown en burbujas del asistente */
const assistantMarkdownClass =
  'copilot-chat-md text-[13px] leading-[1.68] text-[var(--foreground)] ' +
  '[&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_p:first-child]:mt-0 ' +
  '[&_ul]:my-2.5 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:marker:text-[var(--muted-foreground)] ' +
  '[&_ol]:my-2.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 ' +
  '[&_li]:pl-0.5 [&_li]:marker:font-medium ' +
  '[&_h1]:mb-2 [&_h1]:mt-1 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--foreground)] ' +
  '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:border-b [&_h2]:border-[var(--border)]/60 [&_h2]:pb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--foreground)] ' +
  '[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[var(--foreground)] ' +
  '[&_h4]:mb-1 [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-[var(--muted-foreground)] ' +
  '[&_strong]:font-semibold [&_strong]:text-[var(--foreground)] [&_em]:italic ' +
  '[&_code]:rounded-md [&_code]:border [&_code]:border-[var(--border)]/80 [&_code]:bg-[var(--muted)]/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] ' +
  '[&_pre]:my-3 [&_pre]:max-h-64 [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[var(--muted)]/40 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-[3px] [&_blockquote]:border-violet-500/50 [&_blockquote]:bg-[var(--muted)]/25 [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_blockquote]:pr-2 [&_blockquote]:text-[var(--muted-foreground)] ' +
  '[&_a]:font-medium [&_a]:text-violet-600 [&_a]:underline-offset-2 hover:[&_a]:text-violet-500 dark:[&_a]:text-violet-300 dark:hover:[&_a]:text-violet-200 ' +
  '[&_hr]:my-5 [&_hr]:border-[var(--border)] ' +
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-[var(--border)] [&_table]:text-left [&_table]:text-[12px] ' +
  '[&_th]:border-b [&_th]:border-[var(--border)] [&_th]:bg-[var(--muted)]/60 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:font-semibold ' +
  '[&_td]:border-b [&_td]:border-[var(--border)]/70 [&_td]:px-2.5 [&_td]:py-1.5 [&_tr:last-child_td]:border-b-0';

function AssistantMessageBody({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    try {
      return markdownToSafeHtml(markdown);
    } catch {
      try {
        return markdownToSafeHtml(`\`\`\`text\n${markdown}\n\`\`\``);
      } catch {
        return '<p>No se pudo formatear la respuesta.</p>';
      }
    }
  }, [markdown]);

  return (
    <div
      className={assistantMarkdownClass}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CopilotPage() {
  const { user } = useAppStore();
  const copilotEnabled = isCopilotUiEnabled();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    const { maxDocs, snippetChars } = getCopilotContextFetchLimits();
    const { data, error } = await supabase
      .from('documents')
      .select('title, content_text')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(maxDocs);

    if (error) {
      toastSupabaseError('No se pudo cargar el contexto de documentos', error, loadContext);
      return;
    }

    const ctx = (data ?? [])
      .map((d) => `# ${(d as Document).title}\n${((d as Document).content_text ?? '').slice(0, snippetChars)}`)
      .join('\n\n---\n\n');
    setContext(ctx);
  }, []);

  useEffect(() => {
    if (!copilotEnabled) return;
    void loadContext();
  }, [copilotEnabled, loadContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    if (!copilot.isConfigured()) {
      toast.error(
        getAiBackend() === 'azure'
          ? 'Azure OpenAI no está configurado (endpoint y clave en .env).'
          : 'Revisa la configuración del asistente en .env.',
      );
      return;
    }

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const response = await copilot.chat(text, context, history);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      }]);
    } catch {
      toast.error('Error al conectar con el asistente IA');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  if (!copilotEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
          <Bot className="h-8 w-8" aria-hidden />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Asistente IA no disponible</h1>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            La búsqueda y la documentación siguen igual. Para un asistente{' '}
            <strong className="font-medium text-[var(--foreground)]">gratis y local</strong>, define{' '}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">VITE_AI_PROVIDER=ollama</code>, instala
            Ollama en un equipo accesible desde el navegador y descarga el modelo (p. ej.{' '}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">ollama pull llama3.2</code>). Opcionalmente
            ajusta <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">VITE_OLLAMA_URL</code> y{' '}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">VITE_OLLAMA_MODEL</code>. Con licencia
            Microsoft: <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">VITE_AI_PROVIDER=azure</code> o{' '}
            <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">VITE_ENABLE_COPILOT=true</code> y variables
            Azure en <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">.env</code>.
          </p>
        </div>
        <Link
          to="/documentos"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 text-sm font-medium text-[var(--secondary-foreground)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--muted)]"
        >
          Ir a documentos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--border)] bg-[var(--background)]/60 py-3.5 app-page-x backdrop-blur-[2px] sm:items-center sm:py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400 sm:mt-0">
            <Bot className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[0.9375rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-base">
              Asistente IA CCMGC
            </h1>
            <p
              className="mt-0.5 text-xs leading-snug text-[var(--muted-foreground)] line-clamp-2 sm:line-clamp-1 sm:truncate"
              title={
                copilot.isConfigured()
                  ? `${copilot.providerLabel()} · base de conocimiento activa`
                  : 'No configurado — revisa Azure en .env si el proveedor es Azure'
              }
            >
              {copilot.isConfigured()
                ? `${copilot.providerLabel()} · base de conocimiento activa`
                : 'No configurado — revisa Azure en .env si el proveedor es Azure'}
            </p>
          </div>
          {copilot.isConfigured() && (
            <span className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 sm:mt-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 motion-reduce:animate-none" />
              </span>
              Activo
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto app-page-x py-6 sm:py-8">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full min-h-[min(100%,26rem)] w-full max-w-2xl flex-col justify-center gap-9 py-2 sm:max-w-3xl sm:gap-11">
              <header className="text-center">
                <div className="mx-auto mb-3 inline-flex text-violet-600 opacity-90 dark:text-violet-400">
                  <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} aria-hidden />
                </div>
                <h2 className="text-balance text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl sm:tracking-tight">
                  Asistente sobre tu biblioteca DocBrain
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-pretty text-sm leading-relaxed text-[var(--muted-foreground)] sm:max-w-xl sm:text-[0.9375rem]">
                  El contexto incluye extractos de documentos <strong className="font-medium text-[var(--foreground)]">publicados</strong> en CCMGC.
                  Puedes preguntar por contenido, redacción o buenas prácticas de gestión documental.
                </p>
              </header>

              <section aria-labelledby="copilot-suggestions-heading" className="text-left">
                <h3
                  id="copilot-suggestions-heading"
                  className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                >
                  Sugerencias
                </h3>
                <ul className="divide-y divide-[var(--border)]/50 rounded-sm border border-[var(--border)]/60 bg-[var(--muted)]/[0.06] dark:bg-[var(--card)]/20">
                  {suggestions.map(({ text, icon: Icon }) => (
                    <li key={text}>
                      <button
                        type="button"
                        onClick={() => sendMessage(text)}
                        className={cn(
                          'group flex w-full gap-3.5 px-3 py-3.5 text-left transition-[background-color,border-color] duration-150 sm:px-4 sm:py-4',
                          'border-l-[3px] border-l-transparent hover:border-l-violet-500/55 hover:bg-[var(--muted)]/30',
                          'motion-reduce:transition-none',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/35',
                        )}
                      >
                        <Icon
                          className="mt-0.5 h-5 w-5 shrink-0 text-violet-600/90 transition-opacity group-hover:text-violet-600 dark:text-violet-400/90 dark:group-hover:text-violet-300"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[var(--foreground)] sm:text-sm group-hover:text-violet-950 dark:group-hover:text-violet-100">
                          {text}
                          <span className="mt-1.5 flex items-center gap-1 text-[11px] font-normal text-violet-600/75 opacity-0 transition-opacity group-hover:opacity-100 dark:text-violet-300/80">
                            Enviar pregunta
                            <Send className="h-3 w-3 shrink-0" aria-hidden />
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  ) : (
                    user && <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                  )}

                  <div
                    className={cn(
                      'min-w-0 rounded-lg px-4 py-3 text-sm',
                      msg.role === 'assistant'
                        ? 'max-w-[min(100%,42rem)] flex-1 border border-[var(--border)]/60 bg-[var(--muted)]/15 text-[var(--foreground)] dark:bg-[var(--card)]/40'
                        : 'max-w-[85%] rounded-lg bg-[var(--accent)] text-white sm:max-w-[75%]',
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <AssistantMessageBody markdown={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    <div
                      className={cn(
                        'flex items-center justify-between gap-2',
                        msg.role === 'assistant'
                          ? 'mt-3 border-t border-[var(--border)]/40 pt-2.5 dark:border-white/10'
                          : 'mt-2',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] tabular-nums',
                          msg.role === 'assistant' ? 'text-[var(--muted-foreground)]' : 'text-white/70',
                        )}
                        title={formatAbsoluteDateTime(msg.timestamp)}
                      >
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(msg.content);
                            toast.success('Respuesta copiada (Markdown)');
                          }}
                          className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                          title="Copiar respuesta"
                          aria-label="Copiar respuesta en Markdown"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--muted)]/15 px-4 py-3 dark:bg-[var(--card)]/40">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-[var(--muted-foreground)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Compositor: una sola pieza (menos “caja + botón redondo”) */}
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)]/90 py-3 backdrop-blur-[2px] app-page-x sm:py-3.5">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-4xl items-stretch overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--muted)]/[0.12] shadow-sm transition-[box-shadow,border-color] focus-within:border-violet-500/35 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.18)] dark:bg-[var(--card)]/25 dark:focus-within:shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              disabled={loading || !copilot.isConfigured()}
              className="min-h-[2.75rem] min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none disabled:opacity-50 sm:px-4"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading || !copilot.isConfigured()}
              loading={loading}
              title="Enviar"
              aria-label="Enviar mensaje"
              className="h-auto min-h-[2.75rem] w-11 shrink-0 rounded-none border-0 border-l border-[var(--border)]/70 bg-violet-600 text-white shadow-none ring-0 hover:bg-violet-700 disabled:opacity-40 sm:w-12"
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
