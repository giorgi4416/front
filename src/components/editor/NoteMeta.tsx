import { Clock, Folder, Tag } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatDateTime } from '../../lib/utils';
import type { Note } from '../../types';
import { TagPicker } from './TagPicker';

export function NoteMeta({ note, readOnly }: { note: Note; readOnly: boolean }) {
  const { folders, updateNote } = useWorkspace();

  return (
    <dl className="note-meta">
      <div className="meta-row">
        <dt className="meta-label">
          <Tag size={16} aria-hidden /> Tags
        </dt>
        <dd className="meta-value">
          <TagPicker note={note} disabled={readOnly} />
        </dd>
      </div>
      <div className="meta-row">
        <dt className="meta-label">
          <Folder size={16} aria-hidden /> Folder
        </dt>
        <dd className="meta-value">
          <select
            className="meta-select"
            aria-label="Folder"
            value={note.folderId ?? ''}
            disabled={readOnly}
            onChange={(e) => void updateNote(note.id, { folderId: e.target.value || null })}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </dd>
      </div>
      <div className="meta-row">
        <dt className="meta-label">
          <Clock size={16} aria-hidden /> Last edited
        </dt>
        <dd className="meta-value">{formatDateTime(note.updatedAt)}</dd>
      </div>
    </dl>
  );
}
