import { useParams, useNavigate } from 'react-router-dom';
import { generateHTML } from '@tiptap/html';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Edit, Star, StarOff, Eye, Clock,
  ChevronLeft, Tag, User, MessageSquare, Paperclip, History,
  Download, BookOpen, Link2, AlignLeft, Minimize2, Maximize2, X,
  Bot, Copy,
} from 'lucide-react';
import { useDocument } from './useDocuments';
import { useAttachments } from './useAttachments';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { attachmentSupportsPreview } from './attachmentPreviewUtils';
import { CommentsPanel } from './CommentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { VersionsPanel } from './VersionsPanel';
import { useAppStore } from '@/app/store';
import { isCopilotUiEnabled } from '@/lib/featureFlags';
import { Button } from '@/shared/components/ui/Button';
import { StatusBadge } from '@/shared/components/ui/Badge';
import { Avatar } from '@/shared/components/ui/Avatar';
import { Skeleton, SkeletonText } from '@/shared/components/ui/Skeleton';
import { formatDate, formatRelativeTime } from '@/shared/utils/format';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { pushRecentDocument } from '@/shared/utils/recentDocuments';
import { getEditorExtensions } from './editor/getEditorExtensions';
import { DocumentHealthStrip } from './DocumentHealthStrip';
import { cn } from '@/shared/utils/cn';
import toast from 'react-hot-toast';

const viewerHtmlExtensions = getEditorExtensions().filter((ext) => ext.name !== 'ccmgcSlashCommands');

/* ── TOC Heading ── */
interface TocHeading { id: string; text: string; level: number; }

function extractHeadings(html: string): TocHeading[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const headings: TocHeading[] = [];
  div.querySelectorAll('h1, h2, h3, h4').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (!text) return;
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    headings.push({ id, text, level: parseInt(el.tagName[1]) });
  });
  return headings;
}

/* Add IDs to headings in rendered HTML and anchor icons */
function processHtmlContent(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const seen = new Map<string, number>();
  div.querySelectorAll('h1, h2, h3, h4').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const count = seen.get(base) ?? 0;
    const id = count === 0 ? base : `${base}-${count}`;
    seen.set(base, count + 1);
    el.id = id;
    el.classList.add('group', 'relative');
    const anchor = document.createElement('a');
    anchor.href = `#${id}`;
    anchor.className = 'heading-anchor';
    anchor.setAttribute('aria-label', `Enlace a: ${text}`);
    anchor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    el.appendChild(anchor);
  });
  return div.innerHTML;
}

/* ── Floating TOC ── */
function FloatingTOC({ headings, activeId }: { headings: TocHeading[]; activeId: string }) {
  if (headings.length === 0) return null;
  return (
    <nav aria-label="Tabla de contenidos" className="space-y-0.5">
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={cn(
            'block text-xs leading-relaxed transition-colors rounded px-2 py-0.5',
            h.level === 1 ? 'font-semibold' : h.level === 2 ? 'pl-3' : 'pl-5 text-[11px]',
            activeId === h.id
              ? 'text-[var(--accent)] bg-[var(--accent)]/10 font-medium'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}

/* ── Text Selection Toolbar ── */
function SelectionToolbar({ onCopilot }: { onCopilot: (text: string) => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const { copy, copied } = useCopyToClipboard();

  useEffect(() => {
    function handleSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPos(null);
        setSelectedText('');
        return;
      }
      const text = sel.toString().trim();
      setSelectedText(text);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  if (!pos || !selectedText) return null;

  return (
    <div
      className="fixed z-[200] -translate-x-1/2 -translate-y-full animate-[scaleIn_150ms_var(--ease-spring)]"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--glass-light)] dark:bg-[var(--glass-dark)] backdrop-blur-xl shadow-xl px-1 py-1">
        <button
          onClick={() => { copy(selectedText); }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          title="Copiar"
        >
          {copied ? <Star className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
        <div className="w-px h-4 bg-[var(--border)]" />
        {isCopilotUiEnabled() && (
          <>
            <button
              onClick={() => { onCopilot(selectedText); window.getSelection()?.removeAllRanges(); setPos(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              title="Preguntar al Copilot"
            >
              <Bot className="h-3.5 w-3.5 text-violet-500" />
              Copilot
            </button>
            <div className="w-px h-4 bg-[var(--border)]" />
          </>
        )}
        <button
          onClick={() => { window.getSelection()?.removeAllRanges(); setPos(null); }}
          className="p-1 rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
          title="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Arrow */}
      <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[var(--border)]" />
    </div>
  );
}

export function DocumentViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, setCommandPaletteOpen } = useAppStore();
  const { document: doc, loading, isFavorite, toggleFavorite } = useDocument(id!);
  const { attachments } = useAttachments(id ?? '');
  const originalAttachment = attachments.find((a) => a.is_main_file);

  const canEdit = user?.role === 'admin' || user?.role === 'editor' || doc?.author_id === user?.id;
  const [rightPanel, setRightPanel] = useState<'comments' | 'attachments' | 'versions' | null>(null);
  const [originalPreviewOpen, setOriginalPreviewOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [activeHeading, setActiveHeading] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readProgress, setReadProgress] = useState(0);
  const { copy } = useCopyToClipboard();

  const onScrollMain = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setReadProgress(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
    // Update active heading via IntersectionObserver (handled below)
  }, []);

  // Restore scroll position
  useEffect(() => {
    if (!id) return;
    const saved = sessionStorage.getItem(`doc-scroll-${id}`);
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved, 10);
    }
    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem(`doc-scroll-${id}`, String(scrollRef.current.scrollTop));
      }
    };
  }, [id]);

  useEffect(() => {
    if (doc?.id && doc.title) pushRecentDocument(doc.id, doc.title);
  }, [doc?.id, doc?.title]);

  useEffect(() => { onScrollMain(); }, [doc?.id, onScrollMain]);

  const readMinutes = useMemo(() => {
    const len = doc?.content_text?.length ?? 0;
    return Math.max(1, Math.ceil(len / 950));
  }, [doc?.content_text]);

  const rawHtml = useMemo(() => {
    if (!doc?.content) return doc?.content_text ?? '';
    try {
      return generateHTML(doc.content as Parameters<typeof generateHTML>[0], viewerHtmlExtensions);
    } catch { return doc.content_text ?? ''; }
  }, [doc?.content, doc?.content_text]);

  const htmlContent = useMemo(() => processHtmlContent(rawHtml), [rawHtml]);
  const tocHeadings = useMemo(() => extractHeadings(rawHtml), [rawHtml]);

  // IntersectionObserver for active TOC heading
  useEffect(() => {
    if (!scrollRef.current || tocHeadings.length === 0) return;
    const observers: IntersectionObserver[] = [];
    tocHeadings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveHeading(h.id); },
        { root: scrollRef.current, threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [htmlContent, tocHeadings]);

  // Heading anchor copy on click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = (e.target as Element).closest('.heading-anchor');
      if (!target) return;
      e.preventDefault();
      const href = (target as HTMLAnchorElement).href;
      copy(href);
      toast.success('Enlace copiado al portapapeles');
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [copy]);

  function handleCopilot(text: string) {
    setCommandPaletteOpen(true);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-command-palette-input]');
      if (input) { input.value = `> Copilot: ${text.slice(0, 120)}`; input.dispatchEvent(new Event('input', { bubbles: true })); }
    }, 100);
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <SkeletonText lines={6} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">Documento no encontrado</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/documentos')} className="mt-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Reading mode overlay */}
    {readingMode && (
      <div className="fixed inset-0 z-[150] bg-[var(--background)] overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <span className="text-xs text-[var(--muted-foreground)] font-medium">MODO LECTURA</span>
            <Button variant="ghost" size="sm" onClick={() => setReadingMode(false)}>
              <Minimize2 className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] mb-6">{doc.title}</h1>
          <article
            className="doc-view-article"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    )}

    <SelectionToolbar onCopilot={handleCopilot} />

    {originalPreviewOpen && originalAttachment && (
      <AttachmentPreviewModal attachment={originalAttachment} onClose={() => setOriginalPreviewOpen(false)} />
    )}

    <div className="flex h-full overflow-hidden">
      {/* TOC sidebar (xl+) */}
      {tocHeadings.length > 0 && showToc && !rightPanel && (
        <div className="hidden xl:flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Contenido</span>
            <button onClick={() => setShowToc(false)} className="p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-3 py-3">
            <FloatingTOC headings={tocHeadings} activeId={activeHeading} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={scrollRef}
        onScroll={onScrollMain}
        className="relative flex-1 overflow-y-auto scroll-smooth"
      >
        {/* Progress bar */}
        <div
          className="sticky top-0 z-20 h-0.5 w-full bg-[var(--muted)]/50"
          role="progressbar"
          aria-valuenow={readProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de lectura"
        >
          <div
            className="h-full bg-gradient-to-r from-[var(--brand-400)] to-[var(--accent)] transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${readProgress}%` }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-8 py-10">
          {/* Breadcrumb & Actions */}
          <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <button
              onClick={() => navigate('/documentos')}
              className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Documentos
            </button>

            <div className="flex items-center gap-1 flex-wrap">
              {!showToc && tocHeadings.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => setShowToc(true)} title="Mostrar tabla de contenidos" aria-label="Mostrar TOC">
                  <AlignLeft className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setReadingMode(true)} title="Modo lectura" aria-label="Modo lectura">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label={isFavorite ? 'Quitar favorito' : 'Añadir a favoritos'}>
                {isFavorite
                  ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  : <StarOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setRightPanel((p) => p === 'comments' ? null : 'comments')} aria-label="Comentarios" title="Comentarios">
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setRightPanel((p) => p === 'attachments' ? null : 'attachments')} aria-label="Adjuntos" title="Adjuntos">
                <Paperclip className="w-4 h-4" />
              </Button>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => setRightPanel((p) => p === 'versions' ? null : 'versions')} aria-label="Versiones" title="Historial de versiones">
                  <History className="w-4 h-4" />
                </Button>
              )}
              <button
                onClick={() => { copy(window.location.href); toast.success('Enlace copiado'); }}
                className="inline-flex items-center gap-1.5 h-8 px-2 text-xs font-medium rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                title="Copiar enlace"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              {originalAttachment?.url && attachmentSupportsPreview(originalAttachment.mime_type, originalAttachment.file_name) && (
                <button type="button" onClick={() => setOriginalPreviewOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/15 transition-colors shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />Leer original
                </button>
              )}
              {originalAttachment?.url && (
                <a href={originalAttachment.url} target="_blank" rel="noopener noreferrer" download={originalAttachment.file_name} className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors shrink-0">
                  <Download className="w-3.5 h-3.5" />Descargar
                </a>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => navigate(`/documentos/${doc.id}/editar`)}>
                  <Edit className="w-4 h-4" />Editar
                </Button>
              )}
            </div>
          </div>

          {/* Title & Meta */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={doc.status} />
              {doc.category && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${doc.category.color}20`, color: doc.category.color }}>
                  {doc.category.name}
                </span>
              )}
            </div>

            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
              <DocumentHealthStrip title={doc.title} categoryId={doc.category_id ?? ''} summary={doc.summary} status={doc.status} updatedAt={doc.updated_at} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] leading-tight mb-4">
              {doc.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
              {doc.author && (
                <div className="flex items-center gap-1.5">
                  <Avatar name={doc.author.full_name} src={doc.author.avatar_url} size="sm" />
                  <span>{doc.author.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Actualizado {formatRelativeTime(doc.updated_at)}</span>
              </div>
              {doc.published_at && (
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Publicado {formatDate(doc.published_at)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>{doc.view_count} vistas</span>
              </div>
              {/* Reading time prominente */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--muted)] text-[var(--foreground)] font-medium">
                <BookOpen className="w-3.5 h-3.5" aria-hidden />
                <span>~{readMinutes} min</span>
              </div>
            </div>

            {doc.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <Tag className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {doc.summary && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/60 shadow-sm">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1.5">Resumen</p>
                <p className="text-sm text-blue-700 dark:text-blue-200 leading-relaxed">{doc.summary}</p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)] overflow-hidden">
            <article
              className="doc-view-article ProseMirror !px-6 md:!px-10 !pt-8 !pb-12"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>
      </div>

      {/* Sliding panels */}
      {rightPanel === 'comments' && <CommentsPanel documentId={doc.id} onClose={() => setRightPanel(null)} />}
      {rightPanel === 'attachments' && <AttachmentsPanel documentId={doc.id} canEdit={canEdit} onClose={() => setRightPanel(null)} />}
      {rightPanel === 'versions' && canEdit && <VersionsPanel documentId={doc.id} onRestore={() => setRightPanel(null)} onClose={() => setRightPanel(null)} />}

      {/* Right info panel */}
      {!rightPanel && (
        <div className="w-64 border-l border-[var(--border)] bg-[var(--card)] overflow-y-auto shrink-0 hidden xl:block">
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Información</h3>
              <div className="space-y-3 text-sm">
                <InfoRow icon={User} label="Autor" value={doc.author?.full_name ?? '—'} />
                <InfoRow icon={Clock} label="Creado" value={formatDate(doc.created_at)} />
                <InfoRow icon={Clock} label="Modificado" value={formatRelativeTime(doc.updated_at)} />
                <InfoRow icon={Eye} label="Vistas" value={String(doc.view_count)} />
              </div>
            </div>

            {originalAttachment && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Archivo original</h3>
                {originalAttachment.url ? (
                  <a href={originalAttachment.url} target="_blank" rel="noopener noreferrer" download={originalAttachment.file_name} className="flex items-start gap-2 text-sm text-[var(--accent)] hover:underline break-all">
                    <Download className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{originalAttachment.file_name}</span>
                  </a>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">{originalAttachment.file_name}</p>
                )}
              </div>
            )}

            {doc.author && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Autor</h3>
                <div className="flex items-center gap-2">
                  <Avatar name={doc.author.full_name} src={doc.author.avatar_url} size="md" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{doc.author.full_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{doc.author.department}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}
