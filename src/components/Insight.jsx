/**
 * Reusable insight block. `level` is one of '', 'warn', 'bad' and controls the
 * left-border accent colour.
 */
export default function Insight({ level = '', title, children }) {
  return (
    <div className={`insight ${level}`}>
      <div className="insight-title">{title}</div>
      <div className="insight-body">{children}</div>
    </div>
  );
}
