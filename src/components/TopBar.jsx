/**
 * Sticky top navigation bar. Shows brand, view tabs, units toggle, and a few
 * at-a-glance stats. State is owned by App.
 */
export default function TopBar({
  view,
  setView,
  units,
  toggleUnits,
  totalSessions,
  totalShots,
  lastSessionDate,
}) {
  const tabs = [
    ['overview', 'Overview'],
    ['strike', 'Strike'],
    ['flight', 'Flight'],
    ['shape', 'Shape'],
    ['sessions', 'Sessions'],
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"></span>
        <span className="brand-name">Foresight</span>
        <span className="brand-sub">Analytics · v1.1</span>
      </div>
      <nav className="nav">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={`nav-btn ${view === key ? 'active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <button
          className="stat-pill"
          onClick={toggleUnits}
          style={{ cursor: 'pointer', borderColor: 'var(--border-strong)', color: 'var(--text)' }}
          title="Toggle between yards/mph and metres/km-h"
        >
          <span>UNITS</span>
          <span className="stat-pill-val">{units.distance === 'yds' ? 'YD · MPH' : 'M · KM/H'}</span>
        </button>
        <div className="stat-pill">
          <span>SESSIONS</span>
          <span className="stat-pill-val">{totalSessions}</span>
        </div>
        <div className="stat-pill">
          <span>SHOTS</span>
          <span className="stat-pill-val">{totalShots.toLocaleString()}</span>
        </div>
        <div className="stat-pill">
          <span>LATEST</span>
          <span className="stat-pill-val">{lastSessionDate}</span>
        </div>
      </div>
    </header>
  );
}
