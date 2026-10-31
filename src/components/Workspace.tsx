import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { notesInView, searchNotes, sortNotes, viewTitle } from '../lib/noteFilters';
import { cx } from '../lib/utils';
import type { SortKey, View } from '../types';
import { AccountDialog, type AccountTab } from './account/AccountDialog';
import { HelpDialog } from './HelpDialog';
import { NoteActionsPanel } from './NoteActions';
import { NotesList } from './NotesList';
import { SettingsDialog } from './SettingsDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NoteEditor } from './editor/NoteEditor';
import { ConfirmDialog } from './ui/ConfirmDialog';

const SORT_KEY = 'notes-app:sort';
const OPEN_DELAY = 800;

function readSort(): SortKey {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    return stored === 'title' || stored === 'created' ? stored : 'modified';
  } catch {
    return 'modified';
  }
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function Workspace() {
  const ws = useWorkspace();
  const { notes, folders, tags, status, createNote, markOpened, emptyTrash } = ws;

  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(readSort);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'list' | 'editor'>('list');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialog, setDialog] = useState<'settings' | 'help' | 'empty-trash' | 'account' | null>(null);
  const [accountTab, setAccountTab] = useState<AccountTab>('profile');
  const [creating, setCreating] = useState(false);
  const [focusTitleFor, setFocusTitleFor] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    if (query.trim()) return sortNotes(searchNotes(notes, query, tags), sort);
    const inView = notesInView(notes, view);
    return view.kind === 'recent' ? inView : sortNotes(inView, sort);
  }, [notes, tags, view, query, sort]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // Keep a valid selection: if the selected note leaves the list (archived, trashed, filtered), pick the first one.
  useEffect(() => {
    if (status !== 'ready') return;
    if (selectedId && visible.some((n) => n.id === selectedId)) return;
    setSelectedId(visible[0]?.id ?? null);
    if (!visible.length) setMobilePane('list');
  }, [status, visible, selectedId]);

  // Record "recently opened" once a note has been on screen briefly (avoids noise while arrowing through the list).
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => markOpened(selectedId), OPEN_DELAY);
    return () => window.clearTimeout(timer);
  }, [selectedId, markOpened]);

  const navigate = useCallback((next: View) => {
    setView(next);
    setQuery('');
    setSelectedId(null);
    setMobilePane('list');
    setDrawerOpen(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (creating || status !== 'ready') return;
    const init =
      view.kind === 'folder'
        ? { folderId: view.id }
        : view.kind === 'tag'
          ? { tagIds: [view.id] }
          : view.kind === 'favorites'
            ? { isFavorite: true }
            : {};
    setCreating(true);
    const note = await createNote(init);
    setCreating(false);
    if (!note) return;
    if (view.kind === 'archived' || view.kind === 'trash') setView({ kind: 'all' });
    setQuery('');
    setSelectedId(note.id);
    setFocusTitleFor(note.id);
    setMobilePane('editor');
  }, [creating, status, view, createNote]);

  const selectNote = (id: string) => {
    setSelectedId(id);
    setFocusTitleFor(null);
    setMobilePane('editor');
  };

  const onDuplicated = (id: string) => {
    if (view.kind === 'archived' || view.kind === 'trash') setView({ kind: 'all' });
    setSelectedId(id);
    setMobilePane('editor');
  };

  const changeSort = (next: SortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* non-essential */
    }
  };

  // Global shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('.dialog-backdrop')) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyN') {
        event.preventDefault();
        void handleCreate();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setDialog('help');
      } else if (event.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCreate, drawerOpen]);

  const trashCount = notes.filter((n) => n.deletedAt).length;

  return (
    <div className={cx('app', `pane-${mobilePane}`, drawerOpen && 'drawer-open')}>
      <div className="sidebar-shell">
        <Sidebar view={view} onNavigate={navigate} onClose={() => setDrawerOpen(false)} />
      </div>
      <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} aria-hidden />

      <div className="main">
        <TopBar
          ref={searchRef}
          title={viewTitle(view, folders, tags)}
          query={query}
          onQueryChange={(q) => {
            setQuery(q);
            if (q) setMobilePane('list');
          }}
          onOpenSettings={() => setDialog('settings')}
          onOpenHelp={() => setDialog('help')}
          onOpenNavigation={() => setDrawerOpen(true)}
          onOpenAccount={(tab) => {
            setAccountTab(tab);
            setDialog('account');
          }}
        />

        <div className="content">
          <NotesList
            view={view}
            query={query.trim()}
            notes={visible}
            tags={tags}
            selectedId={selectedId}
            sort={sort}
            status={status}
            loadError={ws.loadError}
            creating={creating}
            onRetryLoad={ws.reload}
            onSelect={selectNote}
            onCreate={handleCreate}
            onSortChange={changeSort}
            onEmptyTrash={() => setDialog('empty-trash')}
          />

          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              onBack={() => setMobilePane('list')}
              onDuplicated={onDuplicated}
              autoFocusTitle={focusTitleFor === selected.id}
            />
          ) : (
            <section className="editor-column editor-empty" aria-label="Note editor">
              {status === 'ready' && (
                <div className="empty-panel">
                  <FileText size={24} aria-hidden className="empty-panel-icon" />
                  <p>{view.kind === 'trash' ? 'Select a note in the trash to preview it.' : 'Select a note to view it, or create a new one.'}</p>
                  {view.kind !== 'trash' && (
                    <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                      <Plus size={16} /> Create New Note
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="actions-shell">{selected && <NoteActionsPanel note={selected} onDuplicated={onDuplicated} />}</div>
        </div>
      </div>

      <button type="button" className="fab" aria-label="Create new note" onClick={handleCreate} disabled={creating || view.kind === 'trash'}>
        <Plus size={24} />
      </button>

      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} />
      <AccountDialog open={dialog === 'account'} initialTab={accountTab} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === 'empty-trash'}
        title="Empty trash"
        icon={<Trash2 size={20} />}
        description={`Permanently delete ${trashCount} ${trashCount === 1 ? 'note' : 'notes'}? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        destructive
        onConfirm={emptyTrash}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
