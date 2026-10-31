import { useRef, type KeyboardEvent } from 'react';
import { ArrowUpDown, FileText, Pin, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { cx, formatDate } from '../lib/utils';
import type { Note, SortKey, Tag, View } from '../types';
import { Menu } from './ui/Menu';
import { Spinner } from './ui/Spinner';

interface NotesListProps {
  view: View;
  query: string;
  notes: Note[];
  tags: Tag[];
  selectedId: string | null;
  sort: SortKey;
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  creating: boolean;
  onRetryLoad: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSortChange: (sort: SortKey) => void;
  onEmptyTrash: () => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  modified: 'Last modified',
  created: 'Date created',
  title: 'Title (A–Z)',
};

const VIEW_HINTS: Partial<Record<View['kind'], string>> = {
  archived: 'Archived notes are hidden from All Notes. You can restore them anytime.',
  trash: 'Notes in the trash can be restored or permanently deleted.',
  recent: 'Notes you opened most recently.',
  favorites: 'Notes you marked as favorites.',
};

const EMPTY_MESSAGES: Record<View['kind'], string> = {
  all: 'You don’t have any notes yet. Start a new note to capture your thoughts and ideas.',
  favorites: 'No favorites yet. Use “Add to Favorites” on a note to keep it here.',
  recent: 'Notes you open will show up here.',
  archived: 'No notes have been archived yet. Move notes here for safekeeping.',
  trash: 'Trash is empty.',
  folder: 'This folder is empty. Create a note to add it here.',
  tag: 'No notes have this tag yet.',
};

function excerpt(note: Note): string {
  return note.contentText.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function NotesList(props: NotesListProps) {
  const { view, query, notes, tags, selectedId, sort, status, loadError, creating } = props;
  const listRef = useRef<HTMLUListElement>(null);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const canCreate = view.kind !== 'trash';

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.note-card') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, current + 1);
    if (event.key === 'ArrowUp') next = Math.max(0, current - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[next]?.focus();
    buttons[next]?.click();
  };

  const hint = query ? null : view.kind === 'tag' ? `All notes with the “${tagName.get(view.id)}” tag are shown here.` : VIEW_HINTS[view.kind];

  return (
    <section className="notes-column" aria-label="Notes">
      <div className="notes-column-top">
        {canCreate ? (
          <button type="button" className="btn btn-primary btn-block" onClick={props.onCreate} disabled={creating || status !== 'ready'}>
            {creating ? <Spinner size={16} /> : <Plus size={16} />}
            Create New Note
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-block"
            onClick={props.onEmptyTrash}
            disabled={notes.length === 0}
          >
            <Trash2 size={16} />
            Empty Trash
          </button>
        )}

        {hint && <p className="notes-hint">{hint}</p>}

        {view.kind !== 'recent' && (
          <div className="notes-toolbar">
            <span className="notes-count" aria-live="polite">
              {status === 'ready' ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : ' '}
            </span>
            <Menu
              label="Sort notes"
              align="end"
              items={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
                label: SORT_LABELS[key],
                active: key === sort,
                onSelect: () => props.onSortChange(key),
              }))}
              trigger={(triggerProps) => (
                <button type="button" className="sort-trigger" {...triggerProps}>
                  <ArrowUpDown size={14} aria-hidden />
                  <span>{SORT_LABELS[sort]}</span>
                </button>
              )}
            />
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div className="notes-skeleton" aria-busy="true" aria-label="Loading notes">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card">
              <span className="skeleton-line w-70" />
              <span className="skeleton-line w-40" />
              <span className="skeleton-line w-30" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="empty-panel is-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn btn-secondary" onClick={props.onRetryLoad}>
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      )}

      {status === 'ready' && notes.length === 0 && (
        <div className="empty-panel">
          <FileText size={20} aria-hidden className="empty-panel-icon" />
          <p>{query ? `No notes match “${query}”. Try a different search term.` : EMPTY_MESSAGES[view.kind]}</p>
          {!query && canCreate && view.kind !== 'archived' && view.kind !== 'recent' && view.kind !== 'favorites' && (
            <button type="button" className="link-text" onClick={props.onCreate}>
              Create a note
            </button>
          )}
        </div>
      )}

      {status === 'ready' && notes.length > 0 && (
        <ul ref={listRef} className="notes-list" onKeyDown={onListKeyDown}>
          {notes.map((note) => {
            const selected = note.id === selectedId;
            const preview = excerpt(note);
            return (
              <li key={note.id} className="notes-list-item">
                <button
                  type="button"
                  className={cx('note-card', selected && 'is-selected')}
                  aria-current={selected ? 'true' : undefined}
                  tabIndex={selected || (!selectedId && note === notes[0]) ? 0 : -1}
                  onClick={() => props.onSelect(note.id)}
                >
                  <span className="note-card-title">
                    {note.isPinned && <Pin size={13} className="note-card-flag" aria-label="Pinned" />}
                    {note.isFavorite && <Star size={13} className="note-card-flag is-star" aria-label="Favorite" />}
                    <span className={cx('note-card-title-text', !note.title && 'is-untitled')}>{note.title || 'Untitled Note'}</span>
                  </span>
                  {preview && <span className="note-card-excerpt">{preview}</span>}
                  {note.tagIds.length > 0 && (
                    <span className="note-card-tags">
                      {note.tagIds.map((id) => (tagName.has(id) ? <span key={id} className="chip">{tagName.get(id)}</span> : null))}
                    </span>
                  )}
                  <span className="note-card-date">
                    {view.kind === 'recent' && note.lastOpenedAt
                      ? `Opened ${formatDate(note.lastOpenedAt)}`
                      : formatDate(sort === 'created' ? note.createdAt : note.updatedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
