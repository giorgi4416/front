import type { Folder, Note, NotePatch, Tag } from '../types';

export interface WorkspaceData {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
}

/**
 * Persistence boundary. The UI only talks to this interface, so the Supabase
 * and local-storage backends are interchangeable.
 *
 * IDs are generated on the client, so create calls are idempotent upserts and
 * retrying a failed create can never produce a duplicate.
 */
export interface Repository {
  readonly mode: 'remote' | 'local';
  load(): Promise<WorkspaceData>;

  upsertNote(note: Note): Promise<Note>;
  /** Returns the stored note (with authoritative timestamps). */
  updateNote(id: string, patch: NotePatch): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  setNoteTags(noteId: string, tagIds: string[]): Promise<void>;

  createFolder(folder: Folder): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;

  createTag(tag: Tag): Promise<void>;
  renameTag(id: string, name: string): Promise<void>;
  deleteTag(id: string): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/** Fields whose change counts as "modifying" a note (mirrors the SQL trigger). */
export const CONTENT_FIELDS = ['title', 'content', 'folderId'] as const;

export function isContentPatch(patch: NotePatch): boolean {
  return CONTENT_FIELDS.some((key) => key in patch);
}
