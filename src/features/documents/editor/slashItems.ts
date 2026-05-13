import type { Editor, Range } from '@tiptap/core';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export type SlashItem = {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  command: (opts: { editor: Editor; range: Range }) => void;
};

function match(q: string, item: SlashItem): boolean {
  const s = q.toLowerCase().trim();
  if (!s) return true;
  if (item.title.toLowerCase().includes(s)) return true;
  if (item.subtitle?.toLowerCase().includes(s)) return true;
  if (item.keywords?.some((k) => k.includes(s))) return true;
  return false;
}

export function filterSlashItems(query: string): SlashItem[] {
  return getSlashItems().filter((i) => match(query, i)).slice(0, 15);
}

export function getSlashItems(): SlashItem[] {
  return [
    {
      id: 'h1',
      title: 'Encabezado 1',
      subtitle: '/h1',
      keywords: ['titulo', 'heading'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      title: 'Encabezado 2',
      subtitle: '/h2',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      title: 'Encabezado 3',
      subtitle: '/h3',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
    {
      id: 'h4',
      title: 'Encabezado 4',
      subtitle: '/h4',
      keywords: ['subtitulo', 'seccion'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run(),
    },
    {
      id: 'p',
      title: 'Párrafo',
      subtitle: '/p',
      keywords: ['texto'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      id: 'ul',
      title: 'Lista con viñetas',
      subtitle: '/ul',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: 'ol',
      title: 'Lista numerada',
      subtitle: '/ol',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: 'check',
      title: 'Lista de tareas',
      subtitle: '/check',
      keywords: ['todo', 'checkbox'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      id: 'code',
      title: 'Bloque de código',
      subtitle: '/code',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      id: 'quote',
      title: 'Cita',
      subtitle: '/cita',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: 'hr',
      title: 'Separador',
      subtitle: '/hr',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      id: 'callout-info',
      title: 'Nota informativa',
      subtitle: '/nota info',
      keywords: ['aviso', 'info'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCcmgcCallout('info').run(),
    },
    {
      id: 'callout-warning',
      title: 'Nota advertencia',
      subtitle: '/nota warning',
      keywords: ['atencion'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCcmgcCallout('warning').run(),
    },
    {
      id: 'callout-danger',
      title: 'Nota peligro',
      subtitle: '/nota danger',
      keywords: ['critico'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCcmgcCallout('danger').run(),
    },
    {
      id: 'callout-success',
      title: 'Nota correcto',
      subtitle: '/nota success',
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCcmgcCallout('success').run(),
    },
    {
      id: 'procedure',
      title: 'Paso de procedimiento',
      subtitle: '/paso',
      keywords: ['procedimiento', 'checklist'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCcmgcProcedureStep(1, 'Paso').run(),
    },
    {
      id: 'signature',
      title: 'Bloque firma / aprobación (tabla)',
      subtitle: '/firma',
      keywords: ['tabla', 'aprobacion'],
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 2, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: 'fecha',
      title: 'Fecha de hoy',
      subtitle: '/fecha',
      command: ({ editor, range }) => {
        const t = format(new Date(), "d 'de' MMMM yyyy", { locale: es });
        editor.chain().focus().deleteRange(range).insertContent(t).run();
      },
    },
  ];
}
