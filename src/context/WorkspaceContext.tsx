import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import { LocalRepository } from '../data/localRepository';
import { isContentPatch, type Repository } from '../data/repository';
import { SupabaseRepository } from '../data/supabaseRepository';
import { supabase } from '../lib/supabase';
import { errorMessage, newId, nowIso } from '../lib/utils';
import type { AppUser, Folder, Note, NotePatch, Tag } from '../types';
import { useToast } from './ToastContext';

type LoadStatus = 'loading' | 'ready' | 'error';

export interface ContentDraft {
  title: string;
  content: JSONContent;
  contentText: string;
}

interface WorkspaceApi {
  mode: Repository['mode'];
  status: LoadStatus;
  loadError: string | null;
  reload: () => void;
  notes: Note[];
  folders: Folder[];
  tags: Tag[];

  createNote: (init?: { folderId?: string | null; tagIds?: string[]; isFavorite?: boolean }) => Promise<Note | null>;
  /** Persists editor content. Throws on failure so the editor can keep the draft dirty. */
  saveContent: (id: string, draft: ContentDraft) => Promise<void>;
  /** Optimistic metadata update; rolls back and shows an error toast on failure. */
  updateNote: (id: string, patch: NotePatch, successMessage?: string) => Promise<boolean>;
  markOpened: (id: string) => void;
  duplicateNote: (id: string) => Promise<Note | null>;
  deleteNotePermanently: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<void>;
  setNoteTags: (id: string, tagIds: string[]) => Promise<void>;

  createFolder: (name: string) => Promise<Folder | null>;
  renameFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  createTag: (name: string) => Promise<Tag | null>;
  renameTag: (id: string, name: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const toast = useToast();
  const repo = useMemo<Repository>(
    () => (supabase ? new SupabaseRepository(supabase, user.id) : new LocalRepository(user.id)),
    [user.id],
  );

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadCount, setLoadCount] = useState(0);

  // Mirror of `notes` for reading current values inside async callbacks.
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Writes to the same note run strictly in order, so an older save can never land after a newer one.
  const queues = useRef(new Map<string, Promise<unknown>>());
  const writeSeq = useRef(new Map<string, number>());
  // A note whose create request failed; the next create reuses its id so a retry can't duplicate it.
  const failedCreate = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setLoadError(null);
    repo
      .load()
      .then((data) => {
        if (!active) return;
        setNotes(data.notes);
        setFolders(data.folders);
        setTags(data.tags);
        setStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(errorMessage(error, 'Your notes could not be loaded.'));
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [repo, loadCount]);

  const enqueue = useCallback(<T,>(noteId: string, task: () => Promise<T>): Promise<T> => {
    const previous = queues.current.get(noteId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queues.current.set(noteId, next);
    return next;
  }, []);

  const patchLocal = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  /** Sends a patch through the note's queue and adopts the server's updatedAt if no newer write is pending. */
  const persistPatch = useCallback(
    (id: string, patch: NotePatch) => {
      const seq = (writeSeq.current.get(id) ?? 0) + 1;
      writeSeq.current.set(id, seq);
      return enqueue(id, async () => {
        const stored = await repo.updateNote(id, patch);
        if (writeSeq.current.get(id) === seq) patchLocal(id, { updatedAt: stored.updatedAt });
        return stored;
      });
    },
    [enqueue, repo, patchLocal],
  );

  const createNote = useCallback<WorkspaceApi['createNote']>(
    async (init = {}) => {
      const timestamp = nowIso();
      const note: Note = {
        id: failedCreate.current ?? newId(),
        title: '',
        content: EMPTY_DOC,
        contentText: '',
        folderId: init.folderId ?? null,
        tagIds: init.tagIds ?? [],
        isPinned: false,
        isFavorite: init.isFavorite ?? false,
        isArchived: false,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp,
      };
      try {
        const stored = await repo.upsertNote(note);
        failedCreate.current = null;
        setNotes((list) => [{ ...note, ...stored, tagIds: note.tagIds }, ...list.filter((n) => n.id !== note.id)]);
        return stored;
      } catch (error) {
        failedCreate.current = note.id;
        toast.error(`Couldn't create the note. ${errorMessage(error)}`);
        return null;
      }
    },
    [repo, toast],
  );

  const saveContent = useCallback<WorkspaceApi['saveContent']>(
    async (id, draft) => {
      patchLocal(id, { ...draft, updatedAt: nowIso() });
      await persistPatch(id, draft);
    },
    [patchLocal, persistPatch],
  );

  const updateNote = useCallback<WorkspaceApi['updateNote']>(
    async (id, patch, successMessage) => {
      const before = notesRef.current.find((n) => n.id === id);
      if (!before) return false;
      const previous = Object.fromEntries(
        Object.keys(patch).map((key) => [key, before[key as keyof NotePatch]]),
      ) as NotePatch;
      patchLocal(id, isContentPatch(patch) ? { ...patch, updatedAt: nowIso() } : patch);
      try {
        await persistPatch(id, patch);
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (error) {
        // Roll back only the fields this call changed, and only if nothing newer replaced them.
        setNotes((list) =>
          list.map((n) => {
            if (n.id !== id) return n;
            const restored = { ...n };
            for (const [key, value] of Object.entries(previous)) {
              const k = key as keyof NotePatch;
              if (n[k] === patch[k]) (restored as Record<string, unknown>)[k] = value;
            }
            return restored;
          }),
        );
        toast.error(`Couldn't update the note. ${errorMessage(error)}`);
        return false;
      }
    },
    [patchLocal, persistPatch, toast],
  );

  const markOpened = useCallback(
    (id: string) => {
      const openedAt = nowIso();
      patchLocal(id, { lastOpenedAt: openedAt });
      // Best effort: failing to record "recently opened" shouldn't interrupt the user.
      persistPatch(id, { lastOpenedAt: openedAt }).catch(() => undefined);
    },
    [patchLocal, persistPatch],
  );

  const duplicateNote = useCallback<WorkspaceApi['duplicateNote']>(
    async (id) => {
      const source = notesRef.current.find((n) => n.id === id);
      if (!source) return null;
      const timestamp = nowIso();
      const copy: Note = {
        ...source,
        id: newId(),
        title: source.title ? `${source.title} (copy)` : 'Untitled Note (copy)',
        isPinned: false,
        isFavorite: false,
        isArchived: false,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: timestamp,
      };
      try {
        const stored = await repo.upsertNote(copy);
        setNotes((list) => [{ ...copy, ...stored, tagIds: copy.tagIds }, ...list]);
        toast.success('Note duplicated.');
        return stored;
      } catch (error) {
        toast.error(`Couldn't duplicate the note. ${errorMessage(error)}`);
        return null;
      }
    },
    [repo, toast],
  );

  const deleteNotePermanently = useCallback<WorkspaceApi['deleteNotePermanently']>(
    async (id) => {
      try {
        await enqueue(id, () => repo.deleteNote(id));
        setNotes((list) => list.filter((n) => n.id !== id));
        toast.success('Note permanently deleted.');
        return true;
      } catch (error) {
        toast.error(`Couldn't delete the note. ${errorMessage(error)}`);
        return false;
      }
    },
    [enqueue, repo, toast],
  );

  const emptyTrash = useCallback(async () => {
    const trashed = notesRef.current.filter((n) => n.deletedAt);
    const results = await Promise.allSettled(trashed.map((n) => enqueue(n.id, () => repo.deleteNote(n.id))));
    const deleted = new Set(trashed.filter((_, i) => results[i].status === 'fulfilled').map((n) => n.id));
    setNotes((list) => list.filter((n) => !deleted.has(n.id)));
    const failed = trashed.length - deleted.size;
    if (failed) toast.error(`${failed} note${failed === 1 ? '' : 's'} could not be deleted. Try again.`);
    else toast.success('Trash emptied.');
  }, [enqueue, repo, toast]);

  const setNoteTags = useCallback(
    async (id: string, tagIds: string[]) => {
      const before = notesRef.current.find((n) => n.id === id)?.tagIds ?? [];
      patchLocal(id, { tagIds });
      try {
        await enqueue(id, () => repo.setNoteTags(id, tagIds));
      } catch (error) {
        patchLocal(id, { tagIds: before });
        toast.error(`Couldn't update tags. ${errorMessage(error)}`);
      }
    },
    [enqueue, patchLocal, repo, toast],
  );

  const createFolder = useCallback(
    async (name: string) => {
      const folder: Folder = { id: newId(), name: name.trim(), createdAt: nowIso() };
      try {
        await repo.createFolder(folder);
        setFolders((list) => [...list, folder].sort((a, b) => a.name.localeCompare(b.name)));
        return folder;
      } catch (error) {
        toast.error(`Couldn't create the folder. ${errorMessage(error)}`);
        return null;
      }
    },
    [repo, toast],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      try {
        await repo.renameFolder(id, name.trim());
        setFolders((list) =>
          list.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        return true;
      } catch (error) {
        toast.error(`Couldn't rename the folder. ${errorMessage(error)}`);
        return false;
      }
    },
    [repo, toast],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await repo.deleteFolder(id);
        setFolders((list) => list.filter((f) => f.id !== id));
        setNotes((list) => list.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
        toast.success('Folder deleted. Its notes are still in All Notes.');
        return true;
      } catch (error) {
        toast.error(`Couldn't delete the folder. ${errorMessage(error)}`);
        return false;
      }
    },
    [repo, toast],
  );

  const createTag = useCallback(
    async (name: string) => {
      const existing = tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
      if (existing) return existing;
      const tag: Tag = { id: newId(), name: name.trim(), createdAt: nowIso() };
      try {
        await repo.createTag(tag);
        setTags((list) => [...list, tag].sort((a, b) => a.name.localeCompare(b.name)));
        return tag;
      } catch (error) {
        toast.error(`Couldn't create the tag. ${errorMessage(error)}`);
        return null;
      }
    },
    [repo, tags, toast],
  );

  const renameTag = useCallback(
    async (id: string, name: string) => {
      try {
        await repo.renameTag(id, name.trim());
        setTags((list) =>
          list.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        return true;
      } catch (error) {
        toast.error(`Couldn't rename the tag. ${errorMessage(error)}`);
        return false;
      }
    },
    [repo, toast],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      try {
        await repo.deleteTag(id);
        setTags((list) => list.filter((t) => t.id !== id));
        setNotes((list) => list.map((n) => ({ ...n, tagIds: n.tagIds.filter((t) => t !== id) })));
        toast.success('Tag deleted.');
        return true;
      } catch (error) {
        toast.error(`Couldn't delete the tag. ${errorMessage(error)}`);
        return false;
      }
    },
    [repo, toast],
  );

  const api: WorkspaceApi = {
    mode: repo.mode,
    status,
    loadError,
    reload: () => setLoadCount((c) => c + 1),
    notes,
    folders,
    tags,
    createNote,
    saveContent,
    updateNote,
    markOpened,
    duplicateNote,
    deleteNotePermanently,
    emptyTrash,
    setNoteTags,
    createFolder,
    renameFolder,
    deleteFolder,
    createTag,
    renameTag,
    deleteTag,
  };

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
