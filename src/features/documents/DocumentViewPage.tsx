import { useParams, useNavigate } from 'react-router-dom';
import { generateHTML } from '@tiptap/html';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Edit, Star, StarOff, Eye, Clock,
  ChevronLeft, Tag, User, MessageSquare, Paperclip, History,
  Download, BookOpen, Link2, AlignLeft, AlignRight, Minimize2, Maximize2, X,
  Bot, Copy, Mail, MoreHorizontal,
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
import { formatPrivacyEmail } from '@/shared/utils/formatPrivacy';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { useScrollRevealScrollbarClass } from '@/shared/hooks/useScrollRevealScrollbar';
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
  const padForLevel = (level: number) => {
    if (level <= 1) return 'pl-2.5';
    if (level === 2) return 'pl-4';
    return 'pl-6';
  };
  return (
    <nav aria-label="Tabla de contenidos" className="space-y-0.5">
      {headings.map((h) => {
        const active = activeId === h.id;
        return (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={cn(
              'block rounded-lg border border-transparent py-2 pr-2 text-[0.8125rem] leading-snug transition-[color,background-color,border-color,box-shadow] duration-150',
              padForLevel(h.level),
              h.level === 1 && 'font-semibold text-[var(--foreground)]',
              h.level > 1 && 'font-normal text-[var(--muted-foreground)]',
              active
                ? cn(
                    'border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_14%,var(--card))] text-[var(--foreground)] shadow-[inset_3px_0_0_0_var(--accent)]',
                    'dark:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]',
                  )
                : 'hover:border-[var(--border)]/80 hover:bg-[var(--muted)]/35 hover:text-[var(--foreground)]',
            )}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {h.text}
          </a>
        );
      })}
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
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [activeHeading, setActiveHeading] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const tocScrollRef = useRef<HTMLDivElement>(null);
  const readingScrollRef = useRef<HTMLDivElement>(null);
  const infoScrollRef = useRef<HTMLDivElement>(null);
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

  const mainScrollbarClass = useScrollRevealScrollbarClass(scrollRef, doc?.id);
  const tocScrollbarClass = useScrollRevealScrollbarClass(
    tocScrollRef,
    tocHeadings.length > 0 && showToc && !rightPanel ? doc?.id : null,
  );
  const readingScrollbarClass = useScrollRevealScrollbarClass(readingScrollRef, readingMode ? doc?.id : null);
  const infoScrollbarClass = useScrollRevealScrollbarClass(
    infoScrollRef,
    showInfoPanel && !rightPanel ? doc?.id : null,
  );

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
      <div className="app-page-x w-full py-8 space-y-4">
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
      <div
        ref={readingScrollRef}
        className={cn(
          'fixed inset-0 z-[150] overflow-y-auto bg-[var(--background)] doc-view-scrollbar-autohide',
          readingScrollbarClass,
        )}
      >
        <div className="app-page-x mx-auto w-full max-w-[min(42rem,100%)] py-10">
          <div className="mb-8 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">MODO LECTURA</span>
            <Button variant="ghost" size="sm" onClick={() => setReadingMode(false)}>
              <Minimize2 className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
          <h1 className="mb-6 text-balance text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-[2rem] sm:leading-snug">
            {doc.title}
          </h1>
          <article className="doc-view-article doc-view-reading" dangerouslySetInnerHTML={{ __html: htmlContent }} />
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
        <div
          ref={tocScrollRef}
          className={cn(
            'hidden xl:flex h-full min-h-0 w-[15.5rem] shrink-0 flex-col overflow-y-auto rounded-r-2xl',
            'border border-[var(--border)]/70 border-l-0 bg-[var(--card)]/85 backdrop-blur-sm',
            'shadow-[6px_0_28px_-14px_rgba(15,23,42,0.35)] dark:shadow-[8px_0_36px_-12px_rgba(0,0,0,0.55)]',
            'doc-view-scrollbar-autohide',
            tocScrollbarClass,
          )}
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]/70 shrink-0">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-[0.12em]">
              Contenido
            </span>
            <button
              type="button"
              onClick={() => setShowToc(false)}
              className="p-1 rounded-md hover:bg-[var(--muted)]/80 text-[var(--muted-foreground)] transition-colors"
              aria-label="Ocultar tabla de contenidos"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-2 py-4">
            <FloatingTOC headings={tocHeadings} activeId={activeHeading} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={scrollRef}
        onScroll={onScrollMain}
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto scroll-smooth doc-view-scrollbar-autohide',
          mainScrollbarClass,
        )}
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

        <div className="app-page-x w-full max-w-none py-8 lg:py-10">
          {/* Breadcrumb & toolbar (dos filas: utilidades / acciones del documento) */}
          <div className="mb-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={() => navigate('/documentos')}
                className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                Documentos
              </button>

              <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
                <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-[var(--border)]/60 bg-[var(--muted)]/12 p-0.5 shadow-sm">
                  {!showToc && tocHeadings.length > 0 && (
                    <Button variant="ghost" size="icon" onClick={() => setShowToc(true)} title="Mostrar tabla de contenidos" aria-label="Mostrar TOC">
                      <AlignLeft className="w-4 h-4" />
                    </Button>
                  )}
                  {!showInfoPanel && !rightPanel && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowInfoPanel(true)}
                      title="Mostrar panel de información"
                      aria-label="Mostrar panel de información"
                    >
                      <AlignRight className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setReadingMode(true)} title="Modo lectura" aria-label="Modo lectura">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label={isFavorite ? 'Quitar favorito' : 'Añadir a favoritos'}>
                    {isFavorite ? (
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightPanel((p) => (p === 'comments' ? null : 'comments'))}
                    aria-label="Comentarios"
                    title="Comentarios"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRightPanel((p) => (p === 'attachments' ? null : 'attachments'))}
                    aria-label="Adjuntos"
                    title="Adjuntos"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRightPanel((p) => (p === 'versions' ? null : 'versions'))}
                      aria-label="Versiones"
                      title="Historial de versiones"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Más opciones" title="Más opciones">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-[300] min-w-[12rem] rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 shadow-xl"
                      sideOffset={6}
                      align="end"
                    >
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
                        onSelect={() => {
                          copy(window.location.href);
                          toast.success('Enlace copiado');
                        }}
                      >
                        <Link2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        Copiar enlace
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>

            {(originalAttachment?.url || canEdit) && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[var(--border)]/55 bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] dark:bg-[color-mix(in_srgb,var(--card)_55%,transparent)] dark:shadow-none">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)] shrink-0">
                  Acciones del documento
                </span>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {originalAttachment?.url && attachmentSupportsPreview(originalAttachment.mime_type, originalAttachment.file_name) && (
                    <button
                      type="button"
                      onClick={() => setOriginalPreviewOpen(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--accent)]/45 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] transition-colors shrink-0"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Leer original
                    </button>
                  )}
                  {originalAttachment?.url && (
                    <a
                      href={originalAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={originalAttachment.file_name}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </a>
                  )}
                  {canEdit && (
                    <Button size="sm" className="h-9 shrink-0" onClick={() => navigate(`/documentos/${doc.id}/editar`)}>
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title & Meta */}
          <div className="mb-8 max-w-[min(48rem,100%)]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              {doc.category && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${doc.category.color}20`, color: doc.category.color }}>
                  {doc.category.name}
                </span>
              )}
            </div>

            <div className="mb-4 rounded-xl border border-[var(--border)]/40 bg-[var(--muted)]/12 px-3 py-2.5">
              <DocumentHealthStrip title={doc.title} categoryId={doc.category_id ?? ''} summary={doc.summary} status={doc.status} updatedAt={doc.updated_at} />
            </div>

            <h1 className="mb-4 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-[var(--foreground)] sm:text-[2.125rem] sm:leading-tight">
              {doc.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)] sm:text-[0.8125rem]">
              {doc.author && (
                <div
                  className="flex items-center gap-1.5"
                  title={doc.author.email ? `Correo: ${formatPrivacyEmail(doc.author.email)}` : doc.author.full_name}
                >
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
          <div className="w-full overflow-x-auto border border-[var(--border)]/50 bg-gradient-to-b from-[var(--card)]/95 to-[var(--card)]/88 shadow-[0_14px_48px_-22px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04] dark:from-[var(--card)]/90 dark:to-[var(--card)]/75 dark:shadow-[0_18px_56px_-16px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]">
            <article
              className="doc-view-article doc-view-reading ProseMirror !px-5 !pb-14 !pt-9 md:!px-10 md:!pt-10"
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
      {!rightPanel && showInfoPanel && (
        <div
          ref={infoScrollRef}
          className={cn(
            'hidden xl:flex h-full min-h-0 w-64 shrink-0 flex-col overflow-y-auto rounded-l-2xl',
            'border border-[var(--border)]/70 border-r-0 bg-[var(--card)]/85 backdrop-blur-sm',
            'shadow-[-6px_0_28px_-14px_rgba(15,23,42,0.35)] dark:shadow-[-8px_0_36px_-12px_rgba(0,0,0,0.55)]',
            'doc-view-scrollbar-autohide',
            infoScrollbarClass,
          )}
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]/70 shrink-0">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-[0.12em]">
              Información
            </span>
            <button
              type="button"
              onClick={() => setShowInfoPanel(false)}
              className="p-1 rounded-md hover:bg-[var(--muted)]/80 text-[var(--muted-foreground)] transition-colors"
              aria-label="Ocultar panel de información"
              title="Ocultar información"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-6">
            <div>
              <div className="space-y-3 text-sm">
                <InfoRow icon={User} label="Autor" value={doc.author?.full_name ?? '—'} />
                {doc.author?.email ? (
                  <InfoRow
                    icon={Mail}
                    label="Correo (privacidad)"
                    value={formatPrivacyEmail(doc.author.email)}
                    title={doc.author.email}
                  />
                ) : null}
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

function InfoRow({ icon: Icon, label, value, title }: { icon: React.ElementType; label: string; value: string; title?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm text-[var(--foreground)]" title={title}>
          {value}
        </p>
      </div>
    </div>
  );
}
