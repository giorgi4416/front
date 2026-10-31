import type { Folder, Note, SortKey, Tag, View } from '../types';

const RECENT_LIMIT = 30;

export function notesInView(notes: Note[], view: View): Note[] {
  switch (view.kind) {
    case 'all':
      return notes.filter((n) => !n.deletedAt && !n.isArchived);
    case 'favorites':
      return notes.filter((n) => !n.deletedAt && n.isFavorite);
    case 'recent':
      return notes
        .filter((n) => !n.deletedAt && n.lastOpenedAt)
        .sort((a, b) => b.lastOpenedAt!.localeCompare(a.lastOpenedAt!))
        .slice(0, RECENT_LIMIT);
    case 'archived':
      return notes.filter((n) => !n.deletedAt && n.isArchived);
    case 'trash':
      return notes.filter((n) => n.deletedAt);
    case 'folder':
      return notes.filter((n) => !n.deletedAt && !n.isArchived && n.folderId === view.id);
    case 'tag':
      return notes.filter((n) => !n.deletedAt && !n.isArchived && n.tagIds.includes(view.id));
  }
}

/** Global search over every note that isn't in the trash. */
export function searchNotes(notes: Note[], query: string, tags: Tag[]): Note[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tagNames = new Map(tags.map((t) => [t.id, t.name.toLowerCase()]));
  return notes.filter((note) => {
    if (note.deletedAt) return false;
    const haystack = [note.title, note.contentText, ...note.tagIds.map((id) => tagNames.get(id) ?? '')]
      .join('\n')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function sortNotes(notes: Note[], sort: SortKey, pinnedFirst = true): Note[] {
  const compare = (a: Note, b: Note) => {
    if (pinnedFirst && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    switch (sort) {
      case 'title':
        return (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base' });
      case 'created':
        return b.createdAt.localeCompare(a.createdAt);
      case 'modified':
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  };
  return [...notes].sort(compare);
}

export function viewTitle(view: View, folders: Folder[], tags: Tag[]): string {
  switch (view.kind) {
    case 'all':
      return 'All Notes';
    case 'favorites':
      return 'Favorites';
    case 'recent':
      return 'Recently Opened';
    case 'archived':
      return 'Archived Notes';
    case 'trash':
      return 'Trash';
    case 'folder':
      return folders.find((f) => f.id === view.id)?.name ?? 'Folder';
    case 'tag':
      return `Notes tagged: ${tags.find((t) => t.id === view.id)?.name ?? 'Tag'}`;
  }
}

export const sameView = (a: View, b: View): boolean =>
  a.kind === b.kind && ('id' in a ? a.id : null) === ('id' in b ? b.id : null);
