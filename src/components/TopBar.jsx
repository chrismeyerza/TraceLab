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
  activeUser,
  onOpenSettings,
  settingsOpen,
}) {
  const tabs = [
    ['sessions', 'Sessions'],
    ['shots', 'Shots'],
    ['overview', 'Overview'],
    ['strike', 'Strike'],
    ['flight', 'Flight'],
    ['distance', 'Distance'],
    ['shape', 'Shape'],
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"></span>
        <span className="brand-name">TraceLab</span>
        <span className="brand-sub">v1.3</span>
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
        {activeUser && (
          <span className="gear-active-name" title={`Active user: ${activeUser.name}`}>
            {activeUser.name}
          </span>
        )}
        <button
          className={`gear-btn ${settingsOpen ? 'active' : ''}`}
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          {/* Inline SVG gear — avoids a font-icon dependency */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
