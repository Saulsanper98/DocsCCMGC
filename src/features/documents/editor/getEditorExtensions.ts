import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import { TableKit } from '@tiptap/extension-table/kit';
import type { Extensions } from '@tiptap/core';
import { CcmgcCallout, CcmgcProcedureStep } from './ccmgcNodes';
import { SlashCommands } from './slashExtension';

/** Extensiones compartidas: editor, vista lectura (HTML) y futuras exportaciones. */
export function getEditorExtensions(): Extensions {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: false }),
    Placeholder.configure({ placeholder: 'Escribe / para comandos…' }),
    Underline,
    Link.configure({ openOnClick: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    CharacterCount,
    TableKit.configure({
      table: { HTMLAttributes: { class: 'ccmgc-editor-table' } },
    }),
    CcmgcCallout,
    CcmgcProcedureStep,
    SlashCommands,
  ];
}
