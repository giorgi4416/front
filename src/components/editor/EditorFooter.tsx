import { CircleAlert, CircleCheck, CircleDot } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { cx, modKey } from '../../lib/utils';
import type { SaveStatus } from '../../types';
import { Spinner } from '../ui/Spinner';

interface EditorFooterProps {
  words: number;
  characters: number;
  status: SaveStatus;
  error: string | null;
  readOnly: boolean;
  onSave: () => void;
}

export function EditorFooter({ words, characters, status, error, readOnly, onSave }: EditorFooterProps) {
  const { mode } = useWorkspace();
  const where = mode === 'local' ? 'in this browser' : 'to the cloud';

  const statusView = {
    saved: { icon: <CircleCheck size={14} />, text: `Saved ${where}` },
    dirty: { icon: <CircleDot size={14} />, text: 'Unsaved changes' },
    saving: { icon: <Spinner size={14} />, text: 'Saving…' },
    error: { icon: <CircleAlert size={14} />, text: `Not saved — ${error ?? 'retrying'}` },
  }[status];

  return (
    <footer className="editor-footer">
      <span className="footer-counts">
        {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        <span aria-hidden> · </span>
        {characters.toLocaleString()} {characters === 1 ? 'character' : 'characters'}
      </span>
      {!readOnly && (
        <>
          <span className={cx('save-status', `is-${status}`)} role="status" aria-live="polite" title={status === 'error' ? error ?? undefined : undefined}>
            {statusView.icon}
            <span className="save-status-text">{statusView.text}</span>
          </span>
          <button
            type="button"
            className="btn btn-primary btn-save"
            onClick={onSave}
            disabled={status === 'saved' || status === 'saving'}
            data-tooltip={`Save now (${modKey}+S)`}
            data-tooltip-side="top"
          >
            {status === 'error' ? 'Retry Save' : 'Save Note'}
          </button>
        </>
      )}
    </footer>
  );
}
