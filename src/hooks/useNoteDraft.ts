import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useWorkspace, type ContentDraft } from '../context/WorkspaceContext';
import { registerFlusher } from '../lib/pendingSaves';
import { errorMessage } from '../lib/utils';
import type { Note, SaveStatus } from '../types';

const AUTOSAVE_DELAY = 900;
const RETRY_DELAY = 5000;

/**
 * Holds the editor's unsaved title/body for one note and autosaves it.
 * Mount once per note (the editor is keyed by note id); pending changes are flushed on unmount.
 */
export function useNoteDraft(note: Note) {
  const { saveContent } = useWorkspace();
  const toast = useToast();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const latest = useRef<ContentDraft>({ title: note.title, content: note.content, contentText: note.contentText });
  const version = useRef(0);
  const savedVersion = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  const save = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (savedVersion.current === version.current) return true;
    const target = version.current;
    setStatus('saving');
    try {
      await saveContent(note.id, latest.current);
      savedVersion.current = Math.max(savedVersion.current, target);
      if (!mounted.current) return true;
      setError(null);
      setStatus(savedVersion.current === version.current ? 'saved' : 'dirty');
      return true;
    } catch (err) {
      if (!mounted.current) return false;
      setError(errorMessage(err, 'Could not save.'));
      setStatus('error');
      timer.current = window.setTimeout(() => void save(), RETRY_DELAY);
      return false;
    }
  }, [note.id, saveContent]);

  const update = useCallback(
    (partial: Partial<ContentDraft>) => {
      latest.current = { ...latest.current, ...partial };
      version.current += 1;
      setStatus((s) => (s === 'saving' ? s : 'dirty'));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), AUTOSAVE_DELAY);
    },
    [save],
  );

  useEffect(() => registerFlusher(save), [save]);

  // Warn before closing the tab while changes are unsaved.
  useEffect(() => {
    if (status === 'saved') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  // Flush pending changes when switching to another note.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      if (savedVersion.current === version.current) return;
      const draft = latest.current;
      const retry = () =>
        saveContent(note.id, draft).then(
          () => toast.success('Changes saved.'),
          (err) => toast.error(`Still couldn't save “${draft.title || 'Untitled Note'}”. ${errorMessage(err)}`, { label: 'Retry', onClick: retry }),
        );
      saveContent(note.id, draft).catch((err) =>
        toast.error(`Couldn't save “${draft.title || 'Untitled Note'}”. ${errorMessage(err)}`, { label: 'Retry', onClick: retry }),
      );
    };
  }, [note.id, saveContent, toast]);

  return { status, error, update, save, initial: latest.current };
}
