import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Archive, ChevronLeft, RotateCcw, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useNoteDraft } from '../../hooks/useNoteDraft';
import type { Note } from '../../types';
import { NoteActionsMenu } from '../NoteActions';
import { EditorFooter } from './EditorFooter';
import { EditorToolbar } from './EditorToolbar';
import { NoteMeta } from './NoteMeta';

interface NoteEditorProps {
  note: Note;
  onBack: () => void;
  onDuplicated: (id: string) => void;
  autoFocusTitle: boolean;
}

/** Mount with `key={note.id}` so each note gets a fresh editor and undo history. */
export function NoteEditor({ note, onBack, onDuplicated, autoFocusTitle }: NoteEditorProps) {
  const { updateNote } = useWorkspace();
  const readOnly = Boolean(note.deletedAt);
  const draft = useNoteDraft(note);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: 'Start typing your note here…' }),
      CharacterCount,
    ],
    content: draft.initial.content,
    editable: !readOnly,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'prose', 'aria-label': 'Note content', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => draft.update({ content: e.getJSON(), contentText: e.getText({ blockSeparator: '\n' }) }),
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      words: e?.storage.characterCount.words() ?? 0,
      characters: e?.storage.characterCount.characters() ?? 0,
    }),
  });

  // Grow the title field to fit wrapped text.
  const resizeTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(resizeTitle, []);

  useEffect(() => {
    if (autoFocusTitle && !readOnly) titleRef.current?.focus();
  }, [autoFocusTitle, readOnly]);

  return (
    <section
      className="editor-column"
      aria-label="Note editor"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          void draft.save();
        }
      }}
    >
      <div className="editor-scroll">
        <div className="editor-topline">
          <button type="button" className="back-btn" onClick={onBack}>
            <ChevronLeft size={18} aria-hidden /> Go Back
          </button>
          <div className="editor-topline-actions">
            <NoteActionsMenu note={note} onDuplicated={onDuplicated} />
          </div>
        </div>

        {note.deletedAt && (
          <div className="note-banner" role="status">
            <Trash2 size={16} aria-hidden />
            <span>This note is in the trash. Restore it to make changes.</span>
            <button type="button" className="link-text" onClick={() => void updateNote(note.id, { deletedAt: null }, 'Note restored.')}>
              <RotateCcw size={14} aria-hidden /> Restore
            </button>
          </div>
        )}
        {!note.deletedAt && note.isArchived && (
          <div className="note-banner" role="status">
            <Archive size={16} aria-hidden />
            <span>This note is archived and hidden from All Notes.</span>
            <button type="button" className="link-text" onClick={() => void updateNote(note.id, { isArchived: false }, 'Note restored to All Notes.')}>
              Restore
            </button>
          </div>
        )}

        <textarea
          ref={titleRef}
          className="note-title-input"
          aria-label="Note title"
          placeholder="Enter a title…"
          defaultValue={draft.initial.title}
          readOnly={readOnly}
          rows={1}
          maxLength={300}
          onChange={(e) => {
            resizeTitle();
            draft.update({ title: e.target.value.replace(/\n/g, ' ') });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
              e.preventDefault();
              if (!editor) return;
              // Move DOM focus synchronously so the very next keystroke lands in the body,
              // then let Tiptap place the cursor at the start.
              editor.view.dom.focus();
              editor.commands.focus('start');
            }
          }}
        />

        <NoteMeta note={note} readOnly={readOnly} />

        {editor && !readOnly && <EditorToolbar editor={editor} />}

        <EditorContent editor={editor} className="editor-content" />
      </div>

      <EditorFooter
        words={counts?.words ?? 0}
        characters={counts?.characters ?? 0}
        status={draft.status}
        error={draft.error}
        readOnly={readOnly}
        onSave={() => void draft.save()}
      />
    </section>
  );
}
