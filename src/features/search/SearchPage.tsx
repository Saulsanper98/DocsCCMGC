import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bot, FileText, Clock, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { supabase } from '@/lib/supabase';
import { copilot } from '@/lib/copilot';
import { getCopilotContextFetchLimits } from '@/lib/copilotContextLimits';
import { isCopilotUiEnabled } from '@/lib/featureFlags';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Avatar } from '@/shared/components/ui/Avatar';
import { StatusBadge } from '@/shared/components/ui/Badge';
import { formatRelativeTime } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';
import type { Document } from '@/shared/types';

type SearchScope = 'all' | 'title';

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const fuseRef = useRef<Fuse<Document> | null>(null);

  useEffect(() => {
    fetchAllDocuments();
    const stored = localStorage.getItem('docbrain-recent-searches');
    if (stored) setRecentSearches(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (allDocs.length === 0) return;
    fuseRef.current = new Fuse(allDocs, {
      keys: searchScope === 'title' ? ['title'] : ['title', 'content_text', 'tags'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [allDocs, searchScope]);

  async function fetchAllDocuments() {
    const { data } = await supabase
      .from('documents')
      .select(
        '*, author:profiles!author_id(id,full_name,avatar_url), category:categories!category_id(id,name,color,icon)'
      )
      .eq('status', 'published')
      .order('view_count', { ascending: false });

    setAllDocs((data ?? []) as Document[]);
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (fuseRef.current) {
      const searchResults = fuseRef.current.search(query).map((r) => r.item);
      setResults(searchResults);
    }
  }, [query]);

  function saveSearch(q: string) {
    const recent = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 8);
    setRecentSearches(recent);
    localStorage.setItem('docbrain-recent-searches', JSON.stringify(recent));
  }

  async function handleAiSearch() {
    if (!query.trim() || !isCopilotUiEnabled() || !copilot.isConfigured()) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const { maxDocs, snippetChars } = getCopilotContextFetchLimits();
      const context = allDocs
        .slice(0, maxDocs)
        .map((d) => `[${d.title}]: ${d.content_text?.slice(0, snippetChars) ?? ''}`)
        .join('\n\n');
      const response = await copilot.chat(query, context, []);
      setAiAnswer(response.content);
      saveSearch(query);
    } catch {
      setAiAnswer('No se pudo obtener una respuesta de Copilot.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      saveSearch(query);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] mb-6">Búsqueda</h1>

      <div
        className="flex flex-wrap gap-2 mb-4"
        role="group"
        aria-label="Ámbito de búsqueda"
      >
        <button
          type="button"
          onClick={() => setSearchScope('all')}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            searchScope === 'all'
              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)] font-medium'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
          )}
        >
          Todo el contenido
        </button>
        <button
          type="button"
          onClick={() => setSearchScope('title')}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            searchScope === 'title'
              ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)] font-medium'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
          )}
        >
          Solo título
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className={cn('flex gap-2 mb-6', !isCopilotUiEnabled() && 'flex-col sm:flex-row')}>
        <div className="flex-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar documentos, procedimientos, normativas..."
            leftIcon={<Search className="w-4 h-4" />}
            rightIcon={
              query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpiar">
                  <X className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>
        {isCopilotUiEnabled() && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAiSearch}
          loading={aiLoading}
          title={copilot.isConfigured() ? 'Buscar con IA' : 'Copilot no configurado'}
          disabled={!copilot.isConfigured() || !query.trim()}
        >
          <Bot className="w-4 h-4" />
          Buscar con IA
        </Button>
        )}
      </form>

      {/* AI answer */}
      {isCopilotUiEnabled() && aiAnswer && (
        <div className="mb-6 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Respuesta de Copilot</span>
          </div>
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{aiAnswer}</p>
        </div>
      )}

      {/* Results */}
      {query && (
        <div className="mb-2">
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            {results.length} resultado{results.length !== 1 ? 's' : ''} para "<strong>{query}</strong>"
          </p>
          {results.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No se encontraron documentos.</p>
              <p className="text-xs mt-1">Intenta con otras palabras clave{isCopilotUiEnabled() ? ' o usa la búsqueda con IA.' : '.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((doc) => (
                <SearchResult key={doc.id} doc={doc} query={query} onClick={() => navigate(`/documentos/${doc.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state / suggestions */}
      {!query && (
        <div className="space-y-6">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
                <h2 className="text-sm font-medium text-[var(--foreground)]">Búsquedas recientes</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--muted)] text-[var(--foreground)] border border-transparent hover:border-[var(--border)] hover:bg-[var(--background)] shadow-sm hover:shadow transition-[box-shadow,border-color,background-color]"
                  >
                    <Clock className="w-3 h-3 text-[var(--muted-foreground)]" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[var(--muted-foreground)]" />
              <h2 className="text-sm font-medium text-[var(--foreground)]">Documentos más consultados</h2>
            </div>
            <div className="space-y-2">
              {allDocs.slice(0, 5).map((doc) => (
                <SearchResult key={doc.id} doc={doc} query="" onClick={() => navigate(`/documentos/${doc.id}`)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function highlight(text: string, query: string): string {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function SearchResult({ doc, query, onClick }: { doc: Document; query: string; onClick: () => void }) {
  const snippet = doc.content_text?.slice(0, 120) ?? '';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm hover:border-[var(--accent)]/45 hover:shadow-[var(--shadow-card)] active:scale-[0.995] motion-reduce:active:scale-100 transition-[border-color,box-shadow,transform] duration-200"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: doc.category?.color ? `${doc.category.color}20` : 'var(--muted)' }}
        >
          <FileText className="w-4 h-4" style={{ color: doc.category?.color ?? 'var(--muted-foreground)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p
              className="text-sm font-semibold text-[var(--foreground)]"
              dangerouslySetInnerHTML={{ __html: highlight(doc.title, query) }}
            />
            <StatusBadge status={doc.status} />
          </div>
          {snippet && (
            <p
              className="text-xs text-[var(--muted-foreground)] line-clamp-2 mb-2"
              dangerouslySetInnerHTML={{ __html: `${highlight(snippet, query)}...` }}
            />
          )}
          <div className="flex items-center gap-2">
            {doc.category && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${doc.category.color}20`, color: doc.category.color }}
              >
                {doc.category.name}
              </span>
            )}
            {doc.author && (
              <div className="flex items-center gap-1">
                <Avatar name={doc.author.full_name} size="sm" />
                <span className="text-xs text-[var(--muted-foreground)]">{doc.author.full_name}</span>
              </div>
            )}
            <span className="text-xs text-[var(--muted-foreground)]">{formatRelativeTime(doc.updated_at)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
