import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { cx } from '../../lib/utils';
import type { Note } from '../../types';

export function TagPicker({ note, disabled }: { note: Note; disabled?: boolean }) {
  const { tags, setNoteTags, createTag } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const assigned = note.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t) => t !== undefined);
  const trimmed = query.trim();
  const available = tags.filter(
    (t) => !note.tagIds.includes(t.id) && t.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactExists = tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const options = [
    ...available.map((t) => ({ key: t.id, label: t.name, tagId: t.id as string | null })),
    ...(trimmed && !exactExists ? [{ key: '__create', label: `Create “${trimmed}”`, tagId: null }] : []),
  ];

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => setHighlight(0), [query]);

  const choose = async (option: (typeof options)[number]) => {
    let tagId = option.tagId;
    if (!tagId) {
      const tag = await createTag(trimmed);
      if (!tag) return;
      tagId = tag.id;
    }
    await setNoteTags(note.id, [...note.tagIds, tagId]);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="tag-picker" ref={rootRef}>
      {assigned.length === 0 && !open && <span className="meta-placeholder">No tags</span>}
      {assigned.map((tag) => (
        <span key={tag.id} className="chip chip-removable">
          {tag.name}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove tag ${tag.name}`}
              onClick={() => setNoteTags(note.id, note.tagIds.filter((id) => id !== tag.id))}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <button
          type="button"
          className="chip chip-add"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={12} aria-hidden /> Add tag
        </button>
      )}
      {open && (
        <div className="popover tag-popover">
          <input
            ref={inputRef}
            className="input input-sm"
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={options[highlight] ? `${listId}-${highlight}` : undefined}
            value={query}
            maxLength={40}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setHighlight((h) => Math.min(options.length - 1, h + 1));
              else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(0, h - 1));
              else if (e.key === 'Enter' && options[highlight]) void choose(options[highlight]);
              else if (e.key === 'Escape') setOpen(false);
              else return;
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          <ul id={listId} role="listbox" className="tag-options" aria-label="Tags">
            {options.length === 0 && <li className="tag-option-empty">{tags.length ? 'No more tags' : 'Type to create a tag'}</li>}
            {options.map((option, index) => (
              <li
                key={option.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                className={cx('tag-option', index === highlight && 'is-highlighted', !option.tagId && 'is-create')}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void choose(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
