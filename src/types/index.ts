import type { JSONContent } from '@tiptap/react';

export interface Note {
  id: string;
  title: string;
  content: JSONContent;
  contentText: string;
  folderId: string | null;
  tagIds: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

/** Fields of a note the UI may change. */
export type NotePatch = Partial<
  Pick<
    Note,
    | 'title'
    | 'content'
    | 'contentText'
    | 'folderId'
    | 'isPinned'
    | 'isFavorite'
    | 'isArchived'
    | 'deletedAt'
    | 'lastOpenedAt'
  >
>;

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'archived' }
  | { kind: 'trash' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; id: string };

export type SortKey = 'modified' | 'created' | 'title';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

export type ColorTheme = 'dark' | 'light' | 'system';
export type FontTheme = 'sans' | 'serif' | 'mono';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Email change awaiting confirmation (Supabase only). */
  pendingEmail: string | null;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  createdAt: string;
  userAgent: string;
}
