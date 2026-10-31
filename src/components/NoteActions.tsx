import { useState, type ReactNode } from 'react';
import { Archive, ArchiveRestore, Copy, Ellipsis, Pin, PinOff, RotateCcw, Star, StarOff, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { nowIso } from '../lib/utils';
import type { Note } from '../types';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Menu, type MenuItem } from './ui/Menu';

interface NoteAction extends MenuItem {
  description: string;
}

function useNoteActions(note: Note, onDuplicated: (id: string) => void) {
  const { updateNote, duplicateNote, deleteNotePermanently } = useWorkspace();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const withUndo = async (patch: Parameters<typeof updateNote>[1], undo: Parameters<typeof updateNote>[1], message: string) => {
    if (await updateNote(note.id, patch)) {
      toast.success(message, { label: 'Undo', onClick: () => void updateNote(note.id, undo) });
    }
  };

  const actions: NoteAction[] = note.deletedAt
    ? [
        {
          label: 'Restore Note',
          description: 'Move this note out of the trash',
          icon: <RotateCcw size={16} />,
          onSelect: () => void updateNote(note.id, { deletedAt: null }, 'Note restored.'),
        },
        {
          label: 'Delete Permanently',
          description: 'Delete this note forever',
          icon: <Trash2 size={16} />,
          danger: true,
          onSelect: () => setConfirmDelete(true),
        },
      ]
    : [
        {
          label: note.isPinned ? 'Unpin Note' : 'Pin Note',
          description: note.isPinned ? 'Stop keeping this note at the top' : 'Keep this note at the top of lists',
          icon: note.isPinned ? <PinOff size={16} /> : <Pin size={16} />,
          active: note.isPinned,
          onSelect: () => void updateNote(note.id, { isPinned: !note.isPinned }, note.isPinned ? 'Note unpinned.' : 'Note pinned.'),
        },
        {
          label: note.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          description: note.isFavorite ? 'Remove this note from Favorites' : 'Show this note in Favorites',
          icon: note.isFavorite ? <StarOff size={16} /> : <Star size={16} />,
          active: note.isFavorite,
          onSelect: () =>
            void updateNote(
              note.id,
              { isFavorite: !note.isFavorite },
              note.isFavorite ? 'Removed from Favorites.' : 'Added to Favorites.',
            ),
        },
        {
          label: 'Duplicate Note',
          description: 'Create a copy of this note',
          icon: <Copy size={16} />,
          onSelect: async () => {
            const copy = await duplicateNote(note.id);
            if (copy) onDuplicated(copy.id);
          },
        },
        note.isArchived
          ? {
              label: 'Restore Note',
              description: 'Move this note back to All Notes',
              icon: <ArchiveRestore size={16} />,
              onSelect: () => void withUndo({ isArchived: false }, { isArchived: true }, 'Note restored to All Notes.'),
            }
          : {
              label: 'Archive Note',
              description: 'Hide this note from All Notes',
              icon: <Archive size={16} />,
              onSelect: () => void withUndo({ isArchived: true }, { isArchived: false }, 'Note archived.'),
            },
        {
          label: 'Delete Note',
          description: 'Move this note to the trash',
          icon: <Trash2 size={16} />,
          danger: true,
          onSelect: () => void withUndo({ deletedAt: nowIso() }, { deletedAt: null }, 'Note moved to Trash.'),
        },
      ];

  const dialog = (
    <ConfirmDialog
      open={confirmDelete}
      title="Delete note permanently"
      icon={<Trash2 size={20} />}
      description={
        <>
          “{note.title || 'Untitled Note'}” will be deleted forever. This action cannot be undone.
        </>
      }
      confirmLabel="Delete Permanently"
      destructive
      onConfirm={() => deleteNotePermanently(note.id)}
      onClose={() => setConfirmDelete(false)}
    />
  );

  return { actions, dialog };
}

interface NoteActionsProps {
  note: Note;
  onDuplicated: (id: string) => void;
}

/** Right-hand actions column (wide screens). */
export function NoteActionsPanel({ note, onDuplicated }: NoteActionsProps) {
  const { actions, dialog } = useNoteActions(note, onDuplicated);
  return (
    <aside className="actions-panel" aria-label="Note actions">
      {actions.map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
      {dialog}
    </aside>
  );
}

function ActionButton({ action }: { action: NoteAction }): ReactNode {
  return (
    <button
      type="button"
      className={action.danger ? 'btn btn-outline btn-action is-danger' : 'btn btn-outline btn-action'}
      onClick={action.onSelect}
      title={action.description}
      aria-pressed={action.active}
    >
      {action.icon}
      <span>{action.label}</span>
    </button>
  );
}

/** Compact menu version for tablet and mobile. */
export function NoteActionsMenu({ note, onDuplicated }: NoteActionsProps) {
  const { actions, dialog } = useNoteActions(note, onDuplicated);
  return (
    <>
      <Menu
        label="Note actions"
        align="end"
        items={actions}
        trigger={(props) => (
          <button type="button" className="icon-btn" aria-label="Note actions" data-tooltip="Note actions" {...props}>
            <Ellipsis size={20} />
          </button>
        )}
      />
      {dialog}
    </>
  );
}
