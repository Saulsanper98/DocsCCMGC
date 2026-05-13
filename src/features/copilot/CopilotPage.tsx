import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Copy, Sparkles } from 'lucide-react';
import { copilot } from '@/lib/copilot';
import { getCopilotContextFetchLimits } from '@/lib/copilotContextLimits';
import { getAiBackend, isCopilotUiEnabled } from '@/lib/featureFlags';
import { supabase } from '@/lib/supabase';
import { Button } from '@/shared/components/ui/Button';
import { Avatar } from '@/shared/components/ui/Avatar';
import { useAppStore } from '@/app/store';
import { cn } from '@/shared/utils/cn';
import { formatRelativeTime, formatAbsoluteDateTime } from '@/shared/utils/format';
import toast from 'react-hot-toast';
import type { Document } from '@/shared/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const suggestions = [
  '¿Cuál es el protocolo ante una incidencia grave en carretera?',
  '¿Cómo se gestiona el cierre de un túnel por mantenimiento?',
  'Resúmeme los procedimientos de emergencia más importantes.',
  '¿Qué normativa aplica para la señalización temporal de obras?',
];

export function CopilotPage() {
  const { user } = useAppStore();
  const copilotEnabled = isCopilotUiEnabled();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copilotEnabled) return;
    void loadContext();
  }, [copilotEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadContext() {
    const { maxDocs, snippetChars } = getCopilotContextFetchLimits();
    const { data } = await supabase
      .from('documents')
      .select('title, content_text')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(maxDocs);

    const ctx = (data ?? [])
      .map((d) => `# ${(d as Document).title}\n${((d as Document).content_text ?? '').slice(0, snippetChars)}`)
      .join('\n\n---\n\n');
    setContext(ctx);
  }

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
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="font-semibold text-[var(--foreground)]">Asistente IA CCMGC</h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              {copilot.isConfigured()
                ? `${copilot.providerLabel()} · base de conocimiento activa`
                : 'No configurado — revisa Azure en .env si el proveedor es Azure'}
            </p>
          </div>
          {copilot.isConfigured() && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Activo
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">¿En qué puedo ayudarte?</h2>
                <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
                  Pregúntame sobre cualquier procedimiento, normativa o protocolo del CCMGC.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-violet-300 dark:hover:border-violet-700 transition-colors text-sm text-[var(--foreground)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  ) : (
                    user && <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                  )}

                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'assistant'
                      ? 'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]'
                      : 'bg-[var(--accent)] text-white'
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={cn('text-[10px] tabular-nums', msg.role === 'assistant' ? 'text-[var(--muted-foreground)]' : 'text-white/70')}
                        title={formatAbsoluteDateTime(msg.timestamp)}
                      >
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copiado'); }}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
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
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-3">
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

        {/* Input */}
        <div className="px-6 py-4 border-t border-[var(--border)] shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-2xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={loading || !copilot.isConfigured()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:ring-2 focus:ring-violet-400 transition-all disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading || !copilot.isConfigured()}
              loading={loading}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
