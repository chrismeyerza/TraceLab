import { clubColor } from '../lib/clubs';

/**
 * Club filter chips. Clicking a chip toggles its selection. Clicking "ALL"
 * selects every available club. Last selection cannot be deselected.
 */
export default function FilterBar({ clubs, selected, setSelected }) {
  const toggle = (c) => {
    if (selected.includes(c)) {
      if (selected.length > 1) setSelected(selected.filter((x) => x !== c));
    } else {
      setSelected([...selected, c]);
    }
  };
  return (
    <div className="filter-bar">
      <span className="filter-label">CLUBS</span>
      <div className="chip-row">
        <button
          className={`chip ${selected.length === clubs.length ? 'active' : ''}`}
          onClick={() => setSelected(clubs)}
        >
          ALL
        </button>
        {clubs.map((c) => (
          <button
            key={c}
            className={`chip ${selected.includes(c) ? 'active' : ''}`}
            onClick={() => toggle(c)}
            style={
              selected.includes(c)
                ? { background: clubColor(c), borderColor: clubColor(c), color: '#0a0e0c' }
                : {}
            }
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
