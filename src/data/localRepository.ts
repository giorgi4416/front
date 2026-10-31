import type { Folder, Note, NotePatch, Tag } from '../types';
import { isContentPatch, RepositoryError, type Repository, type WorkspaceData } from './repository';

/** Pre-accounts single-user workspace; migrated to the first demo account that registers. */
export const LEGACY_WORKSPACE_KEY = 'notes-app:local-workspace:v1';
export const workspaceStorageKey = (userId: string) => `${LEGACY_WORKSPACE_KEY}:${userId}`;

function emptyData(): WorkspaceData {
  return { notes: [], folders: [], tags: [] };
}

/**
 * Development fallback used when Supabase is not configured.
 * Data lives only in this browser's localStorage, in a separate key per demo account.
 */
export class LocalRepository implements Repository {
  readonly mode = 'local' as const;
  private readonly key: string;

  constructor(userId: string) {
    this.key = workspaceStorageKey(userId);
  }

  private read(): WorkspaceData {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
      return {
        notes: parsed.notes ?? [],
        folders: parsed.folders ?? [],
        tags: parsed.tags ?? [],
      };
    } catch {
      throw new RepositoryError('Local data could not be read. Browser storage may be blocked.');
    }
  }

  private write(data: WorkspaceData) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      throw new RepositoryError('Browser storage is full or unavailable — changes were not saved.');
    }
  }

  private mutate<T>(fn: (data: WorkspaceData) => T): Promise<T> {
    const data = this.read();
    const result = fn(data);
    this.write(data);
    return Promise.resolve(result);
  }

  private assertUniqueName(list: { id: string; name: string }[], name: string, id: string, what: string) {
    const lower = name.trim().toLowerCase();
    if (list.some((item) => item.id !== id && item.name.toLowerCase() === lower)) {
      throw new RepositoryError(`A ${what} named “${name.trim()}” already exists.`, '23505');
    }
  }

  load() {
    return Promise.resolve(this.read());
  }

  upsertNote(note: Note) {
    return this.mutate((data) => {
      const index = data.notes.findIndex((n) => n.id === note.id);
      if (index === -1) data.notes.push(note);
      else data.notes[index] = note;
      return note;
    });
  }

  updateNote(id: string, patch: NotePatch) {
    return this.mutate((data) => {
      const note = data.notes.find((n) => n.id === id);
      if (!note) throw new RepositoryError('This note no longer exists.');
      Object.assign(note, patch);
      if (isContentPatch(patch)) note.updatedAt = new Date().toISOString();
      return { ...note };
    });
  }

  deleteNote(id: string) {
    return this.mutate((data) => {
      data.notes = data.notes.filter((n) => n.id !== id);
    });
  }

  setNoteTags(noteId: string, tagIds: string[]) {
    return this.mutate((data) => {
      const note = data.notes.find((n) => n.id === noteId);
      if (note) note.tagIds = [...tagIds];
    });
  }

  createFolder(folder: Folder) {
    return this.mutate((data) => {
      this.assertUniqueName(data.folders, folder.name, folder.id, 'folder');
      data.folders.push(folder);
    });
  }

  renameFolder(id: string, name: string) {
    return this.mutate((data) => {
      this.assertUniqueName(data.folders, name, id, 'folder');
      const folder = data.folders.find((f) => f.id === id);
      if (folder) folder.name = name;
    });
  }

  deleteFolder(id: string) {
    return this.mutate((data) => {
      data.folders = data.folders.filter((f) => f.id !== id);
      for (const note of data.notes) if (note.folderId === id) note.folderId = null;
    });
  }

  createTag(tag: Tag) {
    return this.mutate((data) => {
      this.assertUniqueName(data.tags, tag.name, tag.id, 'tag');
      data.tags.push(tag);
    });
  }

  renameTag(id: string, name: string) {
    return this.mutate((data) => {
      this.assertUniqueName(data.tags, name, id, 'tag');
      const tag = data.tags.find((t) => t.id === id);
      if (tag) tag.name = name;
    });
  }

  deleteTag(id: string) {
    return this.mutate((data) => {
      data.tags = data.tags.filter((t) => t.id !== id);
      for (const note of data.notes) note.tagIds = note.tagIds.filter((t) => t !== id);
    });
  }
}
