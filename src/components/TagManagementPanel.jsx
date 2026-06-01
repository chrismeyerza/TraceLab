import { useEffect, useRef, useState } from 'react';
import { canonicalTag } from '../lib/tags';

/**
 * Tag management popover. Lists every tag in the data with its usage count
 * and two actions per row: rename (inline edit) and delete (with confirmation).
 *
 * Not a separate page — a popover that anchors to a "Manage" button on the
 * TAGS filter row. This keeps the workflow tight: see tags, manage tags,
 * close panel, see filter row updated. No navigation, no context switch.
 *
 * Editing a tag inline: click ✎ → name becomes editable → Enter to commit
 * (triggers global rename via onRename), Esc to cancel. Empty name is
 * refused with a small inline message.
 *
 * Deleting a tag: click × → confirm dialog → onDelete runs. Confirmation
 * uses the native browser confirm() rather than a custom modal because
 * native is unambiguous and accessibility-correct; a custom one wouldn't
 * add value here.
 */
export default function TagManagementPanel({
  tagsList,    // [{ tag, count }] from collectTags
  onRename,    // (oldTag, newTag) => Promise — caller resolves the actual update
  onDelete,    // (tag) => Promise
  onClose,
}) {
  const ref = useRef();
  const [editingTag, setEditingTag] = useState(null); // canonical of the tag being renamed
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  // Close on outside click / Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => window.addEventListener('mousedown', onClick), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
      clearTimeout(t);
    };
  }, [onClose]);

  const startRename = (tag) => {
    setEditingTag(canonicalTag(tag));
    setDraft(tag);
    setError(null);
  };

  const cancelRename = () => {
    setEditingTag(null);
    setDraft('');
    setError(null);
  };

  const commitRename = async (oldTag) => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Tag cannot be empty');
      return;
    }
    if (canonicalTag(trimmed) === canonicalTag(oldTag)) {
      // No-op (same name with maybe different casing — could still update
      // the casing, but that's beyond scope here)
      cancelRename();
      return;
    }
    // Check if the target tag already exists — if so, warn this is a merge
    const targetCanon = canonicalTag(trimmed);
    const targetExists = tagsList.some((x) => canonicalTag(x.tag) === targetCanon);
    if (targetExists) {
      const existing = tagsList.find((x) => canonicalTag(x.tag) === targetCanon);
      const ok = confirm(
        `"${existing.tag}" already exists with ${existing.count} shot${existing.count === 1 ? '' : 's'}. ` +
        `Renaming will MERGE "${oldTag}" into "${existing.tag}". Continue?`
      );
      if (!ok) return;
    }
    await onRename(oldTag, trimmed);
    cancelRename();
  };

  const requestDelete = async (tag, count) => {
    const ok = confirm(
      `Delete tag "${tag}" from ${count} shot${count === 1 ? '' : 's'}? ` +
      `The shots are kept; only this tag is removed from them.`
    );
    if (!ok) return;
    await onDelete(tag);
  };

  return (
    <div className="tag-management-panel" ref={ref}>
      <div className="settings-header">
        <div className="settings-title">Manage tags</div>
        <button className="settings-close" onClick={onClose}>×</button>
      </div>
      {tagsList.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>
          No tags yet. Tag some shots and they'll appear here.
        </div>
      ) : (
        <div className="tag-management-list">
          {tagsList.map(({ tag, count }) => {
            const isEditing = editingTag === canonicalTag(tag);
            return (
              <div key={tag} className="tag-management-row">
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={draft}
                      autoFocus
                      onChange={(e) => { setDraft(e.target.value); setError(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(tag);
                        else if (e.key === 'Escape') cancelRename();
                      }}
                      style={{ fontSize: 12, padding: '4px 8px' }}
                    />
                    {error && (
                      <div style={{ fontSize: 10, color: 'var(--red)' }}>{error}</div>
                    )}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-primary"
                        onClick={() => commitRename(tag)}
                        style={{ padding: '3px 10px', fontSize: 9 }}
                      >
                        SAVE
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={cancelRename}
                        style={{ padding: '3px 10px', fontSize: 9 }}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tag-management-label">
                      <span className="tag-management-name">{tag}</span>
                      <span className="tag-management-count">{count}</span>
                    </div>
                    <div className="tag-management-actions">
                      <button
                        className="settings-user-action"
                        onClick={() => startRename(tag)}
                        title="Rename this tag globally"
                      >
                        ✎
                      </button>
                      <button
                        className="settings-user-action danger"
                        onClick={() => requestDelete(tag, count)}
                        title="Delete this tag from all shots"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="tag-management-footnote">
        Rename merges tags case-insensitively. Delete removes the tag from every shot — the shots stay.
      </div>
    </div>
  );
}
