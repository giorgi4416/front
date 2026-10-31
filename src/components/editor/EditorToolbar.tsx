import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react';
import { modKey } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { PromptDialog } from '../ui/PromptDialog';

const shift = '⇧';
const alt = modKey === '⌘' ? '⌥' : 'Alt';
const kb = (...keys: string[]) => [modKey, ...keys].join(modKey === '⌘' ? '' : '+');

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      heading: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      linkHref: (e.getAttributes('link').href as string | undefined) ?? '',
      table: e.isActive('table'),
    }),
  });

  const chain = () => editor.chain().focus();
  const blockLabel = state.heading ? `Heading ${state.heading}` : 'Paragraph';

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <div className="toolbar-group">
        <IconButton label="Undo" shortcut={kb('Z')} disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo" shortcut={kb(shift, 'Z')} disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Redo2 size={16} />
        </IconButton>
      </div>

      <div className="toolbar-group">
        <Menu
          label="Text style"
          items={[
            { label: 'Paragraph', active: !state.heading, shortcut: kb(alt, '0'), onSelect: () => chain().setParagraph().run() },
            ...([1, 2, 3] as const).map((level) => ({
              label: `Heading ${level}`,
              active: state.heading === level,
              shortcut: kb(alt, String(level)),
              onSelect: () => chain().setHeading({ level }).run(),
            })),
          ]}
          trigger={(props) => (
            <button type="button" className="toolbar-select" aria-label={`Text style: ${blockLabel}`} {...props}>
              <span>{blockLabel}</span>
              <ChevronDown size={14} aria-hidden />
            </button>
          )}
        />
      </div>

      <div className="toolbar-group">
        <IconButton label="Bold" shortcut={kb('B')} active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold size={16} />
        </IconButton>
        <IconButton label="Italic" shortcut={kb('I')} active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic size={16} />
        </IconButton>
        <IconButton label="Underline" shortcut={kb('U')} active={state.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline size={16} />
        </IconButton>
        <IconButton label="Strikethrough" shortcut={kb(shift, 'S')} active={state.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough size={16} />
        </IconButton>
        <IconButton label="Highlight" shortcut={kb(shift, 'H')} active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
          <Highlighter size={16} />
        </IconButton>
        <IconButton label="Inline code" shortcut={kb('E')} active={state.code} onClick={() => chain().toggleCode().run()}>
          <Code size={16} />
        </IconButton>
      </div>

      <div className="toolbar-group">
        <IconButton label="Bulleted list" shortcut={kb(shift, '8')} active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <List size={16} />
        </IconButton>
        <IconButton label="Numbered list" shortcut={kb(shift, '7')} active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </IconButton>
        <IconButton label="Checklist" shortcut={kb(shift, '9')} active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
          <ListChecks size={16} />
        </IconButton>
        <IconButton label="Quote" shortcut={kb(shift, 'B')} active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
          <Quote size={16} />
        </IconButton>
        <IconButton label="Code block" shortcut={kb(alt, 'C')} active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
          <SquareCode size={16} />
        </IconButton>
      </div>

      <div className="toolbar-group">
        {state.link ? (
          <IconButton label="Remove link" active onClick={() => chain().extendMarkRange('link').unsetLink().run()}>
            <Unlink size={16} />
          </IconButton>
        ) : (
          <IconButton label="Add link" onClick={() => setDialog('link')}>
            <LinkIcon size={16} />
          </IconButton>
        )}
        <IconButton label="Insert image" onClick={() => setDialog('image')}>
          <ImageIcon size={16} />
        </IconButton>
        <Menu
          label="Table"
          align="end"
          items={
            state.table
              ? [
                  { label: 'Add row below', onSelect: () => chain().addRowAfter().run() },
                  { label: 'Add column right', onSelect: () => chain().addColumnAfter().run() },
                  { label: 'Toggle header row', onSelect: () => chain().toggleHeaderRow().run() },
                  'separator',
                  { label: 'Delete row', onSelect: () => chain().deleteRow().run() },
                  { label: 'Delete column', onSelect: () => chain().deleteColumn().run() },
                  { label: 'Delete table', danger: true, onSelect: () => chain().deleteTable().run() },
                ]
              : [
                  {
                    label: 'Insert 3 × 3 table',
                    onSelect: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
                  },
                  {
                    label: 'Insert 2 × 2 table',
                    onSelect: () => chain().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run(),
                  },
                ]
          }
          trigger={(props) => (
            <button
              type="button"
              className={state.table ? 'icon-btn is-active' : 'icon-btn'}
              aria-label="Table"
              data-tooltip="Table"
              data-tooltip-side="bottom"
              {...props}
            >
              <TableIcon size={16} />
            </button>
          )}
        />
      </div>

      <PromptDialog
        open={dialog === 'link'}
        title="Add link"
        description="Select text first to turn it into a link, or insert the URL as new text."
        fields={[{ name: 'href', label: 'URL', type: 'url', placeholder: 'https://example.com', required: true, initialValue: state.linkHref }]}
        submitLabel="Add link"
        onSubmit={({ href }) => {
          if (editor.state.selection.empty) {
            chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
          } else {
            chain().extendMarkRange('link').setLink({ href }).run();
          }
        }}
        onClose={() => setDialog(null)}
      />

      <PromptDialog
        open={dialog === 'image'}
        title="Insert image"
        description="Paste a link to an image hosted online."
        fields={[
          { name: 'src', label: 'Image URL', type: 'url', placeholder: 'https://…/photo.jpg', required: true },
          { name: 'alt', label: 'Description (alt text)', placeholder: 'Describe the image for screen readers' },
        ]}
        submitLabel="Insert image"
        onSubmit={({ src, alt: altText }) => {
          chain().setImage({ src, alt: altText || undefined }).run();
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
