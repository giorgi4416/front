import { modKey } from '../lib/utils';
import { Dialog } from './ui/Dialog';

const alt = modKey === '⌘' ? '⌥' : 'Alt';

const SHORTCUTS: [string, string[]][] = [
  ['Create a new note', [alt, 'N']],
  ['Search notes', [modKey, 'K']],
  ['Save the current note', [modKey, 'S']],
  ['Move between notes in the list', ['↑', '↓']],
  ['Show this help', ['?']],
  ['Bold / Italic / Underline', [modKey, 'B / I / U']],
  ['Strikethrough', [modKey, '⇧', 'S']],
  ['Highlight', [modKey, '⇧', 'H']],
  ['Heading 1–3', [modKey, alt, '1–3']],
  ['Bulleted / numbered / checklist', [modKey, '⇧', '8 / 7 / 9']],
  ['Undo / Redo', [modKey, 'Z / ⇧Z']],
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Help & keyboard shortcuts" size="md">
      <div className="help">
        <section className="settings-section">
          <h3 className="settings-heading">Getting around</h3>
          <ul className="help-list">
            <li>Notes save automatically while you type. The footer shows when everything is saved.</li>
            <li>Pin important notes to keep them at the top of every list.</li>
            <li>Archived notes are hidden from All Notes but stay searchable.</li>
            <li>Deleted notes go to the Trash, where you can restore them or delete them permanently.</li>
            <li>Use folders to group notes and tags to cross-reference them. Markdown shortcuts like <code>#</code>, <code>-</code>, <code>1.</code>, <code>[ ]</code> and <code>&gt;</code> work in the editor.</li>
          </ul>
        </section>
        <section className="settings-section">
          <h3 className="settings-heading">Keyboard shortcuts</h3>
          <table className="shortcut-table">
            <tbody>
              {SHORTCUTS.map(([label, keys]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="shortcut-keys">
                    {keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Dialog>
  );
}
