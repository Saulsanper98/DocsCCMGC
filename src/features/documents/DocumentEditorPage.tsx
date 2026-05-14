import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare,
  Code, Quote,
  Undo, Redo, AlignLeft, AlignCenter, AlignRight,
  Save, Send, Bot, ChevronLeft, Eye, EyeOff,
  Highlighter, X, History, MessageSquare, Paperclip,
  Tag, ChevronDown, Globe, FileEdit, ListTree, Focus,
  Minimize2, Square, Maximize2, ChevronsDownUp, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { copilot, type CopilotAction } from '@/lib/copilot';
import { isCopilotUiEnabled } from '@/lib/featureFlags';
import { useAppStore } from '@/app/store';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { VersionsPanel } from './VersionsPanel';
import { CommentsPanel } from './CommentsPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { EditorDocumentOutline, useEditorOutlineItems } from './EditorDocumentOutline';
import { repairImportArtifactsInHtml, postProcessImportedHtml } from './importHtmlPostProcess';
import { getEditorExtensions } from './editor/getEditorExtensions';
import { useVersions } from './useVersions';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useDocumentPresence } from '@/shared/hooks/useDocumentPresence';
import { cn } from '@/shared/utils/cn';
import { markdownToSafeHtml } from '@/lib/markdownToSafeHtml';
import { Avatar } from '@/shared/components/ui/Avatar';
import { DocumentHealthStrip } from './DocumentHealthStrip';
import { CopilotSuggestionCard } from './CopilotSuggestionCard';
import { formatModLabel } from '@/shared/utils/platform';
import { formatDistanceToNow } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Document, Category, DocumentStatus } from '@/shared/types';

const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  published: 'Publicado',
  archived: 'Archivado',
};

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: 'text-slate-500',
  review: 'text-amber-600 dark:text-amber-400',
  published: 'text-emerald-600 dark:text-emerald-400',
  archived: 'text-slate-400',
};

export function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    copilotPanelOpen,
    setCopilotPanelOpen,
    editorReadingWidth,
    setEditorReadingWidth,
    editorZenMode,
    setEditorZenMode,
  } = useAppStore();

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('draft');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [copilotResult, setCopilotResult] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotBusyAction, setCopilotBusyAction] = useState<CopilotAction | null>(null);
  const [copilotPanelError, setCopilotPanelError] = useState<string | null>(null);
  const [copilotRetryAction, setCopilotRetryAction] = useState<CopilotAction | null>(null);
  const [copilotLoadSeconds, setCopilotLoadSeconds] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [rightPanel, setRightPanel] = useState<'versions' | 'comments' | 'attachments' | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const contentLoadedRef = useRef(false);
  const quickNoteSeedRef = useRef(false);
  const editorBodyScrollRef = useRef<HTMLDivElement>(null);
  const [outlineSheetOpen, setOutlineSheetOpen] = useState(false);
  const [zenMetadatosOpen, setZenMetadatosOpen] = useState(false);
  const [zenWideLayout, setZenWideLayout] = useState(false);

  const docId = id ?? doc?.id;
  const { peers } = useDocumentPresence(
    docId,
    user ? { id: user.id, full_name: user.full_name } : null,
  );
  const { saveVersion } = useVersions(docId ?? '');

  const editorExtensions = useMemo(() => getEditorExtensions(), []);

  const editor = useEditor({
    extensions: editorExtensions,
    content: '',
    editable: !previewMode,
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words() ?? 0);
      setIsDirty(true);
    },
  });

  const outlineItems = useEditorOutlineItems(editor);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!copilotLoading) {
      setCopilotLoadSeconds(0);
      return;
    }
    setCopilotLoadSeconds(0);
    const id = window.setInterval(() => {
      setCopilotLoadSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [copilotLoading]);

  useEffect(() => {
    if (editorZenMode) setZenMetadatosOpen(false);
    else setZenWideLayout(false);
  }, [editorZenMode]);

  // Load categories
  useEffect(() => {
    supabase.from('categories').select('*').order('order_index').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  // Load document content into editor once both are ready
  useEffect(() => {
    if (!editor || !doc || contentLoadedRef.current) return;
    contentLoadedRef.current = true;

    // If imported from file, load the HTML from metadata
    const importHtml = doc.metadata?.import_html as string | undefined;
    if (importHtml) {
      const staged = postProcessImportedHtml(importHtml);
      editor.commands.setContent(staged);
      // Clear the import_html from metadata after loading
      supabase.from('documents').update({
        content: editor.getJSON(),
        content_text: editor.getText(),
        metadata: { ...doc.metadata, import_html: undefined },
      }).eq('id', doc.id);
    } else if (doc.content && Object.keys(doc.content).length > 0) {
      editor.commands.setContent(doc.content as Record<string, unknown>);
    }
    // Índice PDF a veces quedó en un solo párrafo; partir en varios <p class="import-toc-line">
    const beforeRepair = editor.getHTML();
    const afterRepair = repairImportArtifactsInHtml(beforeRepair);
    if (afterRepair !== beforeRepair) {
      editor.commands.setContent(afterRepair);
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
    setWordCount(editor.storage.characterCount?.words() ?? 0);
  }, [editor, doc]);

  useEffect(() => {
    if (editor) editor.setEditable(!previewMode);
  }, [previewMode, editor]);

  useEffect(() => {
    if (id) fetchDocument();
  }, [id]);

  useEffect(() => {
    if (!editor || id) return;
    const st = location.state as { quickNoteTitle?: string; quickNoteText?: string } | undefined;
    if (!st?.quickNoteTitle && !st?.quickNoteText) {
      quickNoteSeedRef.current = false;
      return;
    }
    if (quickNoteSeedRef.current) return;
    quickNoteSeedRef.current = true;
    if (st.quickNoteTitle) setTitle(st.quickNoteTitle);
    if (st.quickNoteText) {
      const esc = st.quickNoteText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      editor.commands.setContent(`<p>${esc}</p>`);
      setIsDirty(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [editor, id, location.pathname, location.state, navigate]);

  const autoSave = useCallback(async () => {
    if (!editor) return;
    const text = editor.getText().trim();
    if (!title.trim() && !text) return;
    setSaving(true);
    try {
      const content = editor.getJSON();
      const contentText = text;
      const payload = {
        title: title.trim() || 'Sin título',
        content,
        content_text: contentText,
        category_id: categoryId || null,
        tags,
        updated_at: new Date().toISOString(),
      };

      const currentId = id ?? doc?.id;
      if (currentId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', currentId);
        if (error) throw error;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const authorId = user?.id ?? authData.user?.id;
        if (!authorId) {
          toast.error('Debes iniciar sesión para guardar el documento.');
          return;
        }
        const { data, error } = await supabase
          .from('documents')
          .insert({ ...payload, author_id: authorId, status })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setDoc(data as Document);
          navigate(`/documentos/${(data as Document).id}/editar`, { replace: true });
        }
      }
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(`Error al guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [title, editor, id, doc, user, categoryId, tags, status, navigate]);

  // Autosave every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty && (title || editor?.getText())) autoSave();
    }, 30000);
    return () => clearInterval(interval);
  }, [isDirty, title, editor, autoSave]);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const keyboardShortcuts = useMemo(
    () => [
      { key: 's', ctrl: true, action: () => autoSave(), description: 'Guardar' },
      { key: 'e', ctrl: true, action: () => setPreviewMode((p) => !p), description: 'Alternar vista previa' },
      ...(isCopilotUiEnabled()
        ? [
            {
              key: 'c',
              ctrl: true,
              shift: true,
              action: () => {
                const { copilotPanelOpen: open, setCopilotPanelOpen: setOpen } = useAppStore.getState();
                setOpen(!open);
              },
              description: 'Copilot',
            },
          ]
        : []),
    ],
    [autoSave],
  );

  useKeyboardShortcuts(keyboardShortcuts);

  async function fetchDocument() {
    const { data } = await supabase
      .from('documents')
      .select('*, category:categories!category_id(id,name,color)')
      .eq('id', id)
      .single();
    if (data) {
      const d = data as Document;
      setDoc(d);
      setTitle(d.title);
      setCategoryId(d.category_id ?? '');
      setTags(d.tags ?? []);
      setStatus(d.status);
    }
    setLoading(false);
  }

  async function saveAndPublish() {
    await autoSave();
    const currentId = id ?? doc?.id;
    if (!currentId || !editor) return;
    try {
      await saveVersion(editor.getJSON() as Record<string, unknown>, editor.getText(), 'Publicación', true);
      const { error } = await supabase.from('documents').update({
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', currentId);
      if (error) throw error;
      setStatus('published');
      setIsDirty(false);
      toast.success('Documento publicado');
      navigate(`/documentos/${currentId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(`Error al publicar: ${msg}`);
    }
  }

  function togglePanel(panel: 'versions' | 'comments' | 'attachments') {
    setRightPanel((prev) => (prev === panel ? null : panel));
    if (copilotPanelOpen) setCopilotPanelOpen(false);
  }

  async function handleCopilotAction(action: CopilotAction) {
    if (!isCopilotUiEnabled() || !editor) return;
    setCopilotPanelError(null);
    setCopilotResult(null);
    setCopilotRetryAction(action);
    setCopilotBusyAction(action);
    setCopilotLoading(true);
    const content = editor.getText();
    if (!content.trim()) {
      const msg = 'El documento no tiene texto. Escribe contenido en el editor antes de usar el asistente.';
      setCopilotPanelError(msg);
      setCopilotLoading(false);
      setCopilotBusyAction(null);
      toast.error(msg);
      return;
    }
    try {
      const result = await copilot.transform(action, content);
      setCopilotResult(result);
      setCopilotRetryAction(null);
      toast.success('Sugerencia lista: revisa el recuadro violeta sobre el editor.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al contactar con el asistente.';
      setCopilotPanelError(msg);
      toast.error('No se pudo generar la sugerencia.');
    } finally {
      setCopilotLoading(false);
      setCopilotBusyAction(null);
    }
  }

  function acceptCopilotResult() {
    if (!copilotResult || !editor) return;
    const html = markdownToSafeHtml(copilotResult);
    editor.commands.setContent(html);
    setCopilotResult(null);
    setIsDirty(true);
    toast.success('Sugerencia aplicada al documento');
  }

  function addTag(value: string) {
    const t = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      setIsDirty(true);
    }
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
    setIsDirty(true);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  async function changeStatus(s: DocumentStatus) {
    setStatus(s);
    setIsDirty(true);
    setShowStatusMenu(false);
    if (docId) {
      await supabase.from('documents').update({ status: s }).eq('id', docId);
      toast.success(`Estado: ${STATUS_LABELS[s]}`);
    }
  }

  if (loading) {
    return (
      <div className="p-6 app-page-x w-full max-w-none space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        {editorZenMode ? (
          <div className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)]/50 bg-[var(--background)]/90 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/75">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditorZenMode(false)} title="Salir del modo enfoque">
                <Focus className="h-4 w-4" />
                Salir
              </Button>
              <Button
                variant={zenMetadatosOpen ? 'secondary' : 'ghost'}
                size="sm"
                type="button"
                onClick={() => setZenMetadatosOpen((v) => !v)}
                title="Mostrar u ocultar categoría, estado y etiquetas"
              >
                <ChevronsDownUp className="h-4 w-4" />
                <span className="hidden sm:inline">Metadatos</span>
              </Button>
              <Button
                variant={zenWideLayout ? 'secondary' : 'ghost'}
                size="sm"
                type="button"
                onClick={() => setZenWideLayout((v) => !v)}
                title="Vista de lectura más ancha"
              >
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Amplio</span>
              </Button>
              <span className="hidden text-xs tabular-nums text-[var(--muted-foreground)] sm:inline">{wordCount} palabras</span>
              {docId && peers.length > 0 && (
                <div className="ml-1 flex items-center gap-0.5 border-l border-[var(--border)] pl-2">
                  <span className="text-[10px] text-[var(--muted-foreground)]">Viendo:</span>
                  <div className="flex -space-x-1.5">
                    {peers.slice(0, 5).map((p) => (
                      <Avatar key={p.userId} name={p.name} size="sm" className="ring-2 ring-[var(--card)]" />
                    ))}
                  </div>
                  {peers.length > 5 && (
                    <span className="text-[10px] text-[var(--muted-foreground)]">+{peers.length - 5}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => autoSave()} loading={saving} title={`Guardar (${formatModLabel()}+S)`}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={saveAndPublish}>
                <Send className="h-4 w-4" />
                Publicar
              </Button>
            </div>
          </div>
        ) : (
        <div className="sticky top-0 z-30 flex items-center gap-1 px-4 py-2 border-b border-[var(--border)]/50 bg-[var(--background)]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/75 flex-wrap shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-[var(--border)] mx-1" />

          <ToolbarBtn icon={Bold} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} label="Negrita" />
          <ToolbarBtn icon={Italic} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} label="Cursiva" />
          <ToolbarBtn icon={UnderlineIcon} active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} label="Subrayado" />
          <ToolbarBtn icon={Strikethrough} active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} label="Tachado" />
          <ToolbarBtn icon={Highlighter} active={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight().run()} label="Resaltar" />

          <div className="w-px h-5 bg-[var(--border)] mx-1" />

          <ToolbarBtn icon={Heading1} active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} label="H1" />
          <ToolbarBtn icon={Heading2} active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" />
          <ToolbarBtn icon={Heading3} active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" />
          <ToolbarBtn icon={Heading4} active={editor?.isActive('heading', { level: 4 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} label="H4" />

          <div className="w-px h-5 bg-[var(--border)] mx-1" />

          <ToolbarBtn icon={List} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} label="Lista" />
          <ToolbarBtn icon={ListOrdered} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} label="Lista numerada" />
          <ToolbarBtn icon={CheckSquare} active={editor?.isActive('taskList')} onClick={() => editor?.chain().focus().toggleTaskList().run()} label="Checklist" />
          <ToolbarBtn icon={Quote} active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()} label="Cita" />
          <ToolbarBtn icon={Code} active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} label="Código" />

          <div className="w-px h-5 bg-[var(--border)] mx-1" />

          <ToolbarBtn icon={AlignLeft} active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} label="Izquierda" />
          <ToolbarBtn icon={AlignCenter} active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} label="Centro" />
          <ToolbarBtn icon={AlignRight} active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} label="Derecha" />

          <div className="w-px h-5 bg-[var(--border)] mx-1" />

          <ToolbarBtn icon={Undo} onClick={() => editor?.chain().focus().undo().run()} label="Deshacer" disabled={!editor?.can().undo()} />
          <ToolbarBtn icon={Redo} onClick={() => editor?.chain().focus().redo().run()} label="Rehacer" disabled={!editor?.can().redo()} />

          <div className="ml-auto flex items-center gap-2 min-w-0">
            <span className="max-w-[200px] shrink-0 truncate text-right text-xs tabular-nums sm:max-w-none">
              {saving ? (
                <span className="text-[var(--muted-foreground)]">Guardando…</span>
              ) : isDirty ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">Sin guardar</span>
              ) : lastSaved ? (
                <span className="text-[var(--muted-foreground)]" title={lastSaved.toLocaleString('es-ES')}>
                  Guardado {formatDistanceToNow(lastSaved, { locale: esLocale, addSuffix: true })}
                </span>
              ) : (
                <span className="text-[var(--muted-foreground)]">—</span>
              )}
            </span>

            {docId && peers.length > 0 && (
              <div className="hidden items-center gap-1 border-l border-[var(--border)] pl-2 md:flex" title="Presencia en tiempo real">
                <div className="flex -space-x-1">
                  {peers.slice(0, 4).map((p) => (
                    <Avatar key={p.userId} name={p.name} size="sm" className="ring-2 ring-[var(--card)]" />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--muted-foreground)]">{peers.length}</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-0.5 border border-[var(--border)] rounded-lg p-0.5 bg-[var(--muted)]/30" role="group" aria-label="Ancho de lectura">
              <Button
                variant={editorReadingWidth === 'narrow' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditorReadingWidth('narrow')}
                title="Ancho estrecho"
                aria-label="Ancho estrecho"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={editorReadingWidth === 'medium' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditorReadingWidth('medium')}
                title="Ancho medio"
                aria-label="Ancho medio"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={editorReadingWidth === 'wide' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditorReadingWidth('wide')}
                title="Ancho amplio"
                aria-label="Ancho amplio"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Button
              variant={editorZenMode ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setEditorZenMode(!editorZenMode)}
              title="Modo enfoque (menos distracciones)"
              aria-label="Modo enfoque"
              aria-pressed={editorZenMode}
            >
              <Focus className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOutlineSheetOpen(true)}
              aria-label="Abrir índice del documento"
              title={outlineItems.length > 0 ? 'Índice' : 'Índice (añade encabezados)'}
            >
              <ListTree className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setPreviewMode(!previewMode)} title={`Vista previa (${formatModLabel()}+E)`}>
              {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>

            {docId && (
              <>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => { togglePanel('versions'); setCopilotPanelOpen(false); }}
                  title="Historial de versiones"
                  className={cn(rightPanel === 'versions' && 'bg-[var(--muted)]')}
                >
                  <History className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => { togglePanel('comments'); setCopilotPanelOpen(false); }}
                  title="Comentarios"
                  className={cn(rightPanel === 'comments' && 'bg-[var(--muted)]')}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => { togglePanel('attachments'); setCopilotPanelOpen(false); }}
                  title="Adjuntos"
                  className={cn(rightPanel === 'attachments' && 'bg-[var(--muted)]')}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </>
            )}

            <Button variant="ghost" size="sm" onClick={() => autoSave()} loading={saving} title={`Guardar (${formatModLabel()}+S)`}>
              <Save className="w-4 h-4" />
              Guardar
            </Button>

            {isCopilotUiEnabled() && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setCopilotPanelOpen(!copilotPanelOpen); setRightPanel(null); }}
              className="text-violet-600 dark:text-violet-400"
              title="Asistente IA (Ctrl+Mayús+C)"
            >
              <Bot className="w-4 h-4" />
              IA
            </Button>
            )}

            <Button size="sm" onClick={saveAndPublish}>
              <Send className="w-4 h-4" />
              Publicar
            </Button>
          </div>
        </div>
        )}

        {/* Sugerencia IA (Markdown) */}
        {isCopilotUiEnabled() && copilotResult && (
          <CopilotSuggestionCard
            markdown={copilotResult}
            onAccept={acceptCopilotResult}
            onReject={() => setCopilotResult(null)}
          />
        )}

        {/* Content area: navegación interna (lg+) + editor */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {!editorZenMode && (
            <EditorDocumentOutline
              editor={editor}
              items={outlineItems}
              scrollRootRef={editorBodyScrollRef}
              outlineSheetOpen={outlineSheetOpen}
              onOutlineSheetClose={() => setOutlineSheetOpen(false)}
            />
          )}
          <div ref={editorBodyScrollRef} className="flex-1 overflow-y-auto min-w-0 bg-[var(--background)]">
          <div
            className={cn(
              'w-full max-w-none px-4 py-6 sm:px-6 lg:px-8',
              editorZenMode && zenWideLayout
                ? 'py-10'
                : cn(
                    editorReadingWidth === 'narrow' && 'max-w-4xl mx-auto',
                    editorReadingWidth === 'medium' && 'max-w-6xl mx-auto',
                    editorReadingWidth === 'wide' && 'max-w-none',
                  ),
            )}
          >
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
              placeholder="Título del documento"
              className="w-full text-3xl font-bold text-[var(--foreground)] bg-transparent outline-none placeholder:text-[var(--muted-foreground)]/40 mb-3"
            />

            {/* Metadata bar: category + tags + status */}
            {(!editorZenMode || zenMetadatosOpen) && (
            <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-4">
              {/* Category */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryMenu((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {categories.find((c) => c.id === categoryId)?.name ?? 'Sin categoría'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showCategoryMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCategoryMenu(false)} />
                    <div className="absolute left-0 top-6 z-20 w-56 bg-[var(--popover)] rounded-lg border border-[var(--border)] shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                      <button
                        onClick={() => { setCategoryId(''); setShowCategoryMenu(false); setIsDirty(true); }}
                        className={cn('w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]', !categoryId && 'font-semibold text-[var(--foreground)]')}
                      >
                        Sin categoría
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setCategoryId(c.id); setShowCategoryMenu(false); setIsDirty(true); }}
                          className={cn('w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)] transition-colors flex items-center gap-2', categoryId === c.id ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-foreground)]')}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <span className="text-[var(--border)]">·</span>

              {/* Status */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium transition-colors',
                    STATUS_COLORS[status]
                  )}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  {STATUS_LABELS[status]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute left-0 top-6 z-20 w-40 bg-[var(--popover)] rounded-lg border border-[var(--border)] shadow-lg overflow-hidden">
                      {(['draft', 'review', 'published', 'archived'] as DocumentStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => changeStatus(s)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)] transition-colors',
                            status === s ? 'font-semibold' : '',
                            STATUS_COLORS[s]
                          )}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <span className="text-[var(--border)]">·</span>

              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                {tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--foreground)]"
                  >
                    {t}
                    <button
                      onClick={() => removeTag(t)}
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] leading-none"
                      aria-label={`Quitar etiqueta ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? 'Añadir etiqueta...' : '+'}
                  className="min-w-0 w-28 bg-transparent text-xs text-[var(--muted-foreground)] outline-none placeholder:text-[var(--muted-foreground)]/50"
                />
              </div>

              <div className="w-full border-t border-[var(--border)] pt-3 mt-1">
                <DocumentHealthStrip
                  title={title}
                  categoryId={categoryId}
                  summary={doc?.summary}
                  status={status}
                  updatedAt={doc?.updated_at}
                />
              </div>
            </div>
            )}

            {/* Editor */}
            <div data-docbrain-preview={previewMode ? 'true' : undefined}>
              <EditorContent
                editor={editor}
                className={cn(
                  'min-h-[60vh] doc-view-article prose-editor-toc',
                  previewMode && 'ring-1 ring-[var(--accent)]/20 rounded-xl bg-[var(--muted)]/20 px-2 py-3 -mx-2'
                )}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Bottom bar */}
        {!editorZenMode && (
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border)]/40 bg-[var(--background)]/80 text-xs text-[var(--muted-foreground)] backdrop-blur-[2px]">
          <span>{wordCount} palabras</span>
          <span className={cn(STATUS_COLORS[status])}>{STATUS_LABELS[status]}</span>
        </div>
        )}
      </div>

      {/* Copilot panel */}
      {isCopilotUiEnabled() && copilotPanelOpen && (
        <CopilotPanel
          onAction={handleCopilotAction}
          loading={copilotLoading}
          loadingActionLabel={
            copilotBusyAction ? copilotActions.find((a) => a.action === copilotBusyAction)?.label ?? null : null
          }
          loadElapsedSec={copilotLoadSeconds}
          error={copilotPanelError}
          onDismissError={() => setCopilotPanelError(null)}
          onRetry={() => {
            if (copilotRetryAction) void handleCopilotAction(copilotRetryAction);
          }}
          canRetry={!!copilotRetryAction && !copilotLoading}
          onClose={() => setCopilotPanelOpen(false)}
        />
      )}

      {/* Versions panel */}
      {rightPanel === 'versions' && docId && (
        <VersionsPanel
          documentId={docId}
          onRestore={(content) => { editor?.commands.setContent(content); setIsDirty(true); }}
          onClose={() => setRightPanel(null)}
        />
      )}

      {/* Comments panel */}
      {rightPanel === 'comments' && docId && (
        <CommentsPanel
          documentId={docId}
          onClose={() => setRightPanel(null)}
        />
      )}

      {/* Attachments panel */}
      {rightPanel === 'attachments' && docId && (
        <AttachmentsPanel
          documentId={docId}
          canEdit={user?.role === 'admin' || user?.role === 'editor' || user?.role === 'operator'}
          onClose={() => setRightPanel(null)}
        />
      )}
    </div>
  );
}

function ToolbarBtn({
  icon: Icon, active, onClick, label, disabled,
}: {
  icon: React.ElementType;
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'w-7 h-7 rounded flex items-center justify-center transition-colors',
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

const copilotActions: Array<{ action: CopilotAction; label: string; icon: string }> = [
  { action: 'improve_writing', label: 'Mejorar redacción', icon: '✍️' },
  { action: 'summarize', label: 'Resumir documento', icon: '📋' },
  { action: 'generate_toc', label: 'Generar índice', icon: '📑' },
  { action: 'continue_writing', label: 'Continuar escribiendo', icon: '➡️' },
  { action: 'extract_key_points', label: 'Extraer puntos clave', icon: '🔑' },
  { action: 'check_consistency', label: 'Verificar consistencia', icon: '✅' },
  { action: 'generate_checklist', label: 'Generar checklist', icon: '☑️' },
  { action: 'translate', label: 'Traducir al inglés', icon: '🌍' },
  { action: 'change_tone', label: 'Cambiar tono', icon: '🎯' },
  { action: 'generate_template', label: 'Generar plantilla', icon: '📄' },
];

function CopilotPanel({
  onAction,
  loading,
  loadingActionLabel,
  loadElapsedSec,
  error,
  onDismissError,
  onRetry,
  canRetry,
  onClose,
}: {
  onAction: (action: CopilotAction) => void;
  loading: boolean;
  loadingActionLabel: string | null;
  loadElapsedSec: number;
  error: string | null;
  onDismissError: () => void;
  onRetry: () => void;
  canRetry: boolean;
  onClose: () => void;
}) {
  return (
    <div className="w-72 border-l border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-500" aria-hidden />
          <span className="text-sm font-semibold text-[var(--foreground)]">Asistente IA</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar panel del asistente">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {error ? (
          <div className="shrink-0 border-b border-[var(--border)] bg-amber-500/10 p-3 dark:bg-amber-500/15">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-100">No se pudo completar</p>
                <p className="mt-1 max-h-28 overflow-y-auto break-words text-xs text-amber-950/90 dark:text-amber-50/90">
                  {error}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {canRetry ? (
                    <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={onRetry}>
                      Reintentar
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismissError}>
                    Cerrar aviso
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div
              className="flex min-h-[12rem] flex-col items-stretch justify-center px-1 py-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent"
                  aria-hidden
                />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {loadingActionLabel ? `Generando: ${loadingActionLabel}` : 'Generando respuesta…'}
                  </p>
                  <p className="text-xs tabular-nums">{loadElapsedSec}s</p>
                  <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-[var(--muted-foreground)]">
                    El modelo local puede tardar varios segundos. Si sube mucho el tiempo, revisa que Ollama esté en
                    marcha y con RAM/VRAM libre.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="mb-3 text-xs text-[var(--muted-foreground)]">¿En qué puedo ayudarte?</p>
              {copilotActions.map(({ action, label, icon }) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onAction(action)}
                  disabled={loading}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:pointer-events-none disabled:opacity-40"
                >
                  <span aria-hidden>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
