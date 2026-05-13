import { Node, mergeAttributes, type CommandProps } from '@tiptap/core';

export type CalloutVariant = 'info' | 'warning' | 'danger' | 'success';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    /** Debe coincidir con `name` del nodo en Node.create */
    ccmgcCallout: {
      insertCcmgcCallout: (variant?: CalloutVariant) => ReturnType;
    };
    ccmgcProcedureStep: {
      insertCcmgcProcedureStep: (step?: number, label?: string) => ReturnType;
    };
  }
}

/** Bloque nota/aviso CCMGC (variantes semánticas). */
export const CcmgcCallout = Node.create({
  name: 'ccmgcCallout',
  group: 'block',
  defining: true,
  draggable: true,
  content: 'block+',

  addAttributes() {
    return {
      variant: {
        default: 'info' as CalloutVariant,
        parseHTML: (el) => (el.getAttribute('data-variant') as CalloutVariant) || 'info',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ccmgc-callout"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const v = (node.attrs.variant as CalloutVariant) || 'info';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'ccmgc-callout',
        class: `ccmgc-callout ccmgc-callout--${v}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCcmgcCallout:
        (variant: CalloutVariant = 'info') =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs: { variant },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Título o aviso breve', marks: [{ type: 'bold' }] }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Desarrollo del aviso…' }],
              },
            ],
          }),
    };
  },
});

/** Paso de procedimiento numerado con cuerpo editable. */
export const CcmgcProcedureStep = Node.create({
  name: 'ccmgcProcedureStep',
  group: 'block',
  defining: true,
  draggable: true,
  content: 'block+',

  addAttributes() {
    return {
      step: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute('data-step')) || 1,
        renderHTML: (attrs) => ({ 'data-step': String(attrs.step) }),
      },
      label: {
        default: 'Paso',
        parseHTML: (el) => el.getAttribute('data-label') || 'Paso',
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ccmgc-procedure-step"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'ccmgc-procedure-step',
        'data-step': String(node.attrs.step),
        'data-label': String(node.attrs.label),
        title: String(node.attrs.label),
        class: 'ccmgc-procedure-step',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCcmgcProcedureStep:
        (step = 1, label = 'Paso') =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs: { step, label },
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Responsable: ' },
                  { type: 'text', text: '—', marks: [{ type: 'italic' }] },
                ],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Acciones del paso…' }],
              },
            ],
          }),
    };
  },
});
