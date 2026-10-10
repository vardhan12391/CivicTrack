import { Link } from 'react-router-dom';

/**
 * Status badge. Pass `status` (a key from constants) and optional `map`
 * (the constant object) to resolve the label + css class.
 */
export default function StatusBadge({ status, map, label, className = '' }) {
  const meta = map?.[status];
  const css = meta?.badge || status || 'neutral';
  const text = label || meta?.label || String(status || '—');
  return (
    <span className={`ct-badge ct-badge--${css} ${className}`.trim()}>{text}</span>
  );
}

/** Small label used inline, e.g. category chips. */
export function Chip({ children, tone = 'neutral' }) {
  return <span className={`ct-badge ct-badge--${tone}`}>{children}</span>;
}

/** Department / category tag linking to filtered directory. */
export function FilterLink({ to, children }) {
  return (
    <Link to={to} className="ct-badge ct-badge--teal">
      {children}
    </Link>
  );
}
