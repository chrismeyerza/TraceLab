import { useEffect, useRef, useState } from 'react';
import { addTag, removeTag, suggestTags, normaliseTag, canonicalTag } from '../lib/tags';

/**
 * Inline tag editor: shows current tags as removable chips and provides a
 * text input with autocomplete from existing tags. Used both as a per-shot
 * inline editor in the Shots view and as a bulk-apply control.
 *
 * Props:
 *   value          — current array of tag strings (the shot's tags, or empty
 *                    for bulk-apply starting fresh)
 *   onChange       — callback when tags change (full new array)
 *   suggestionPool — array of { tag, count } across all shots, used to power
 *                    the autocomplete dropdown
 *   placeholder    — input placeholder text
 *   compact        — render in a tighter layout (used inline in table cells)
 *
 * Interaction:
 *   - Type a tag, hit Enter → adds (or selects from suggestions if Enter
 *     pressed while a suggestion is highlighted via arrow keys)
 *   - Click a suggestion → adds
 *   - Click × on a chip → removes
 *   - Click outside → keeps current state and closes suggestions
 */
export default function TagEditor({
  value, onChange, suggestionPool, placeholder = 'Add tag…', compact = false,
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef();
  const inputRef = useRef();

  // Close suggestions on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  // Suggestions exclude tags already on this shot
  const currentCanons = new Set((value || []).map(canonicalTag));
  const suggestions = suggestTags(draft, suggestionPool || [])
    .filter((s) => !currentCanons.has(canonicalTag(s.tag)));

  const commit = (tag) => {
    const norm = normaliseTag(tag);
    if (!norm) return;
    onChange(addTag(value, norm));
    setDraft('');
    setHighlight(-1);
    // Keep input focused so the user can keep adding
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        commit(suggestions[highlight].tag);
      } else if (draft.trim()) {
        commit(draft);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && draft === '' && value?.length) {
      // Backspace on empty input removes the last chip — common pattern
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div ref={ref} className={`tag-editor ${compact ? 'compact' : ''}`}>
      <div className="tag-chips">
        {(value || []).map((t) => (
          <span key={t} className="tag-chip">
            {t}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => onChange(removeTag(value, t))}
              title={`Remove tag "${t}"`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          // Stop the cell-click handler from firing when typing in the input
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              className={`tag-suggestion ${i === highlight ? 'highlight' : ''}`}
              onClick={(e) => { e.stopPropagation(); commit(s.tag); }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span>{s.tag}</span>
              <span className="tag-suggestion-count">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
