import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/react';
import type { Folder, Note, NotePatch, Tag } from '../types';
import { RepositoryError, type Repository, type WorkspaceData } from './repository';

interface NoteRow {
  id: string;
  title: string;
  content: JSONContent;
  content_text: string;
  folder_id: string | null;
  is_pinned: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  note_tags?: { tag_id: string }[];
}

interface NamedRow {
  id: string;
  name: string;
  created_at: string;
}

const NOTE_COLUMNS =
  'id,title,content,content_text,folder_id,is_pinned,is_favorite,is_archived,deleted_at,created_at,updated_at,last_opened_at';

const fromNoteRow = (row: NoteRow, tagIds?: string[]): Note => ({
  id: row.id,
  title: row.title,
  content: row.content,
  contentText: row.content_text,
  folderId: row.folder_id,
  tagIds: tagIds ?? row.note_tags?.map((t) => t.tag_id) ?? [],
  isPinned: row.is_pinned,
  isFavorite: row.is_favorite,
  isArchived: row.is_archived,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at,
});

const PATCH_COLUMNS: Record<keyof NotePatch, keyof NoteRow> = {
  title: 'title',
  content: 'content',
  contentText: 'content_text',
  folderId: 'folder_id',
  isPinned: 'is_pinned',
  isFavorite: 'is_favorite',
  isArchived: 'is_archived',
  deletedAt: 'deleted_at',
  lastOpenedAt: 'last_opened_at',
};

function toRowPatch(patch: NotePatch): Partial<NoteRow> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = PATCH_COLUMNS[key as keyof NotePatch];
    if (column) row[column] = value;
  }
  return row as Partial<NoteRow>;
}

const fromNamedRow = (row: NamedRow) => ({ id: row.id, name: row.name, createdAt: row.created_at });

function check(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === '23505') throw new RepositoryError('That name is already in use.', error.code);
  if (error.code === '42P01' || error.code === 'PGRST205') {
    throw new RepositoryError(
      'Database tables are missing. Run supabase/schema.sql in your Supabase project.',
      error.code,
    );
  }
  throw new RepositoryError(error.message || 'The server rejected the request.', error.code);
}

/** Supabase-backed storage. Authorization is enforced by RLS policies in supabase/schema.sql. */
export class SupabaseRepository implements Repository {
  readonly mode = 'remote' as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async load(): Promise<WorkspaceData> {
    const [notes, folders, tags] = await Promise.all([
      this.client.from('notes').select(`${NOTE_COLUMNS},note_tags(tag_id)`),
      this.client.from('folders').select('id,name,created_at').order('name'),
      this.client.from('tags').select('id,name,created_at').order('name'),
    ]);
    check(notes.error);
    check(folders.error);
    check(tags.error);
    return {
      notes: (notes.data as NoteRow[]).map((row) => fromNoteRow(row)),
      folders: (folders.data as NamedRow[]).map(fromNamedRow),
      tags: (tags.data as NamedRow[]).map(fromNamedRow),
    };
  }

  async upsertNote(note: Note): Promise<Note> {
    const { data, error } = await this.client
      .from('notes')
      .upsert({
        id: note.id,
        user_id: this.userId,
        title: note.title,
        content: note.content,
        content_text: note.contentText,
        folder_id: note.folderId,
        is_pinned: note.isPinned,
        is_favorite: note.isFavorite,
        is_archived: note.isArchived,
        deleted_at: note.deletedAt,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
        last_opened_at: note.lastOpenedAt,
      })
      .select(NOTE_COLUMNS)
      .single();
    check(error);
    if (note.tagIds.length) await this.setNoteTags(note.id, note.tagIds);
    return fromNoteRow(data as NoteRow, note.tagIds);
  }

  async updateNote(id: string, patch: NotePatch): Promise<Note> {
    const { data, error } = await this.client
      .from('notes')
      .update(toRowPatch(patch))
      .eq('id', id)
      .select(`${NOTE_COLUMNS},note_tags(tag_id)`)
      .maybeSingle();
    check(error);
    if (!data) throw new RepositoryError('This note no longer exists or you no longer have access to it.');
    return fromNoteRow(data as NoteRow);
  }

  async deleteNote(id: string) {
    const { error } = await this.client.from('notes').delete().eq('id', id);
    check(error);
  }

  async setNoteTags(noteId: string, tagIds: string[]) {
    let removal = this.client.from('note_tags').delete().eq('note_id', noteId);
    if (tagIds.length) removal = removal.not('tag_id', 'in', `(${tagIds.join(',')})`);
    const { error: deleteError } = await removal;
    check(deleteError);
    if (!tagIds.length) return;
    const { error } = await this.client.from('note_tags').upsert(
      tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId, user_id: this.userId })),
      { onConflict: 'note_id,tag_id', ignoreDuplicates: true },
    );
    check(error);
  }

  async createFolder(folder: Folder) {
    const { error } = await this.client
      .from('folders')
      .upsert({ id: folder.id, user_id: this.userId, name: folder.name, created_at: folder.createdAt });
    check(error);
  }

  async renameFolder(id: string, name: string) {
    const { error } = await this.client.from('folders').update({ name }).eq('id', id);
    check(error);
  }

  async deleteFolder(id: string) {
    const { error } = await this.client.from('folders').delete().eq('id', id);
    check(error);
  }

  async createTag(tag: Tag) {
    const { error } = await this.client
      .from('tags')
      .upsert({ id: tag.id, user_id: this.userId, name: tag.name, created_at: tag.createdAt });
    check(error);
  }

  async renameTag(id: string, name: string) {
    const { error } = await this.client.from('tags').update({ name }).eq('id', id);
    check(error);
  }

  async deleteTag(id: string) {
    const { error } = await this.client.from('tags').delete().eq('id', id);
    check(error);
  }
}
