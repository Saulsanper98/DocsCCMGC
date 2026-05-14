import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { SlashCommandsList, type SlashCommandsHandle, type SlashCommandsListProps } from './SlashCommandsList';
import { filterSlashItems, type SlashItem } from './slashItems';

export const slashCommandPluginKey = new PluginKey('ccmgcSlash');

export const SlashCommands = Extension.create({
  name: 'ccmgcSlashCommands',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      Suggestion<SlashItem, SlashItem>({
        pluginKey: slashCommandPluginKey,
        editor,
        char: '/',
        startOfLine: true,
        allowSpaces: false,
        command: ({ editor: ed, range, props }) => {
          props.command({ editor: ed, range });
        },
        items: ({ query }) => filterSlashItems(query),
        shouldShow: ({ editor: ed, range }) => {
          const $from = ed.state.doc.resolve(range.from);
          for (let d = $from.depth; d > 0; d--) {
            const n = $from.node(d);
            if (n.type.name === 'codeBlock') return false;
          }
          return ed.isEditable;
        },
        render: () => {
          let component: ReactRenderer<SlashCommandsHandle, SlashCommandsListProps> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandsList, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy(document.body, {
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 320, 24),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                arrow: false,
                theme: 'slash-ccmgc',
                zIndex: 9999,
                offset: [0, 10],
                moveTransition: 'transform 0.12s ease-out',
                duration: [180, 140],
              });
            },
            onUpdate(props) {
              component?.updateProps(props);
              popup?.setProps({
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 320, 24),
              });
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                exitSuggestion(props.view, slashCommandPluginKey);
                return true;
              }
              const handled = component?.ref?.onKeyDown(props.event);
              return Boolean(handled);
            },
            onExit() {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
