import { Fragment, useState, type ReactNode } from 'react';
import {
  Archive,
  ChevronRight,
  Clock,
  Cloud,
  Ellipsis,
  FileText,
  Folder as FolderIcon,
  HardDrive,
  Pencil,
  Plus,
  Star,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { sameView } from '../lib/noteFilters';
import { cx } from '../lib/utils';
import type { Folder, Tag, View } from '../types';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { IconButton } from './ui/IconButton';
import { Menu } from './ui/Menu';
import { PromptDialog } from './ui/PromptDialog';
import { Logo } from './Logo';

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  /** Present when the sidebar is shown as a drawer. */
  onClose?: () => void;
}

const PRIMARY_NAV: { view: View; label: string; icon: ReactNode }[] = [
  { view: { kind: 'all' }, label: 'All Notes', icon: <FileText size={20} /> },
  { view: { kind: 'favorites' }, label: 'Favorites', icon: <Star size={20} /> },
  { view: { kind: 'recent' }, label: 'Recently Opened', icon: <Clock size={20} /> },
  { view: { kind: 'archived' }, label: 'Archived Notes', icon: <Archive size={20} /> },
  { view: { kind: 'trash' }, label: 'Trash', icon: <Trash2 size={20} /> },
];

type Dialog =
  | { type: 'new-folder' }
  | { type: 'rename-folder'; folder: Folder }
  | { type: 'delete-folder'; folder: Folder }
  | { type: 'new-tag' }
  | { type: 'rename-tag'; tag: Tag }
  | { type: 'delete-tag'; tag: Tag }
  | null;

export function Sidebar({ view, onNavigate, onClose }: SidebarProps) {
  const { folders, tags, notes, createFolder, renameFolder, deleteFolder, createTag, renameTag, deleteTag, mode } =
    useWorkspace();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const trashCount = notes.filter((n) => n.deletedAt).length;

  const navItem = (target: View, label: string, icon: ReactNode, extra?: ReactNode, menu?: ReactNode) => {
    const active = sameView(view, target);
    return (
      <li className={cx('nav-item', active && 'is-active')}>
        <button type="button" className="nav-link" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(target)}>
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
          {extra}
          {active && !menu && <ChevronRight size={16} className="nav-chevron" aria-hidden />}
        </button>
        {menu}
      </li>
    );
  };

  const itemMenu = (name: string, onRename: () => void, onDelete: () => void) => (
    <Menu
      label={`${name} options`}
      align="end"
      items={[
        { label: 'Rename', icon: <Pencil size={14} />, onSelect: onRename },
        { label: 'Delete', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
      ]}
      trigger={(props) => (
        <button type="button" className="nav-item-menu icon-btn" aria-label={`${name} options`} {...props}>
          <Ellipsis size={16} />
        </button>
      )}
    />
  );

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar-header">
        <Logo />
        {onClose && (
          <IconButton label="Close navigation" onClick={onClose}>
            <X size={18} />
          </IconButton>
        )}
      </div>

      <div className="sidebar-scroll">
        <ul className="nav-list">
          {PRIMARY_NAV.map((item) => (
            <Fragment key={item.label}>
              {navItem(
                item.view,
                item.label,
                item.icon,
                item.view.kind === 'trash' && trashCount > 0 ? <span className="nav-count">{trashCount}</span> : undefined,
              )}
            </Fragment>
          ))}
        </ul>

        <hr className="sidebar-divider" />

        <section className="nav-section" aria-labelledby="folders-heading">
          <div className="nav-section-header">
            <h2 id="folders-heading" className="nav-section-title">
              Folders
            </h2>
            <IconButton label="New folder" className="icon-btn-sm" onClick={() => setDialog({ type: 'new-folder' })}>
              <Plus size={16} />
            </IconButton>
          </div>
          {folders.length === 0 ? (
            <button type="button" className="nav-empty" onClick={() => setDialog({ type: 'new-folder' })}>
              No folders yet. <span className="link-text">Create one</span>
            </button>
          ) : (
            <ul className="nav-list">
              {folders.map((folder) => (
                <Fragment key={folder.id}>
                  {navItem(
                    { kind: 'folder', id: folder.id },
                    folder.name,
                    <FolderIcon size={20} />,
                    undefined,
                    itemMenu(
                      folder.name,
                      () => setDialog({ type: 'rename-folder', folder }),
                      () => setDialog({ type: 'delete-folder', folder }),
                    ),
                  )}
                </Fragment>
              ))}
            </ul>
          )}
        </section>

        <section className="nav-section" aria-labelledby="tags-heading">
          <div className="nav-section-header">
            <h2 id="tags-heading" className="nav-section-title">
              Tags
            </h2>
            <IconButton label="New tag" className="icon-btn-sm" onClick={() => setDialog({ type: 'new-tag' })}>
              <Plus size={16} />
            </IconButton>
          </div>
          {tags.length === 0 ? (
            <p className="nav-empty">Tags you add to notes appear here.</p>
          ) : (
            <ul className="nav-list">
              {tags.map((tag) => (
                <Fragment key={tag.id}>
                  {navItem(
                    { kind: 'tag', id: tag.id },
                    tag.name,
                    <TagIcon size={20} />,
                    undefined,
                    itemMenu(
                      tag.name,
                      () => setDialog({ type: 'rename-tag', tag }),
                      () => setDialog({ type: 'delete-tag', tag }),
                    ),
                  )}
                </Fragment>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className={cx('storage-badge', mode === 'local' && 'is-local')} title={mode === 'local' ? 'Supabase is not configured' : undefined}>
        {mode === 'local' ? <HardDrive size={14} aria-hidden /> : <Cloud size={14} aria-hidden />}
        <span>{mode === 'local' ? 'Demo mode · saved in this browser only' : `Synced · ${user?.email}`}</span>
      </div>

      <PromptDialog
        open={dialog?.type === 'new-folder' || dialog?.type === 'rename-folder'}
        title={dialog?.type === 'rename-folder' ? 'Rename folder' : 'New folder'}
        fields={[
          {
            name: 'name',
            label: 'Folder name',
            placeholder: 'e.g. Work',
            required: true,
            maxLength: 80,
            initialValue: dialog?.type === 'rename-folder' ? dialog.folder.name : '',
          },
        ]}
        submitLabel={dialog?.type === 'rename-folder' ? 'Rename' : 'Create folder'}
        onSubmit={async ({ name }) => {
          if (dialog?.type === 'rename-folder') return renameFolder(dialog.folder.id, name);
          const folder = await createFolder(name);
          if (folder) onNavigate({ kind: 'folder', id: folder.id });
          return Boolean(folder);
        }}
        onClose={() => setDialog(null)}
      />

      <PromptDialog
        open={dialog?.type === 'new-tag' || dialog?.type === 'rename-tag'}
        title={dialog?.type === 'rename-tag' ? 'Rename tag' : 'New tag'}
        fields={[
          {
            name: 'name',
            label: 'Tag name',
            placeholder: 'e.g. Ideas',
            required: true,
            maxLength: 40,
            initialValue: dialog?.type === 'rename-tag' ? dialog.tag.name : '',
          },
        ]}
        submitLabel={dialog?.type === 'rename-tag' ? 'Rename' : 'Create tag'}
        onSubmit={async ({ name }) => {
          if (dialog?.type === 'rename-tag') return renameTag(dialog.tag.id, name);
          return Boolean(await createTag(name));
        }}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.type === 'delete-folder'}
        title="Delete folder"
        icon={<Trash2 size={20} />}
        description={
          dialog?.type === 'delete-folder' && (
            <>
              Delete “{dialog.folder.name}”? Notes inside it are kept and remain available in All Notes.
            </>
          )
        }
        confirmLabel="Delete folder"
        destructive
        onConfirm={async () => {
          if (dialog?.type !== 'delete-folder') return;
          const id = dialog.folder.id;
          if ((await deleteFolder(id)) && view.kind === 'folder' && view.id === id) onNavigate({ kind: 'all' });
        }}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.type === 'delete-tag'}
        title="Delete tag"
        icon={<Trash2 size={20} />}
        description={
          dialog?.type === 'delete-tag' && <>Delete the tag “{dialog.tag.name}”? It will be removed from all notes.</>
        }
        confirmLabel="Delete tag"
        destructive
        onConfirm={async () => {
          if (dialog?.type !== 'delete-tag') return;
          const id = dialog.tag.id;
          if ((await deleteTag(id)) && view.kind === 'tag' && view.id === id) onNavigate({ kind: 'all' });
        }}
        onClose={() => setDialog(null)}
      />
    </nav>
  );
}

