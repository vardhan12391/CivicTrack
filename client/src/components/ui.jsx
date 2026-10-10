import { Link } from 'react-router-dom';

/** Statistic card for dashboards. */
export function StatCard({ label, value, hint, tone, to }) {
  const body = (
    <div className={`ct-stat ${tone ? `ct-stat--${tone}` : ''}`}>
      <div className="ct-stat__label">{label}</div>
      <div className="ct-stat__value">{value ?? '—'}</div>
      {hint && <div className="ct-stat__hint">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="text-decoration-none">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Card with optional header actions. */
export function Card({ title, actions, children, footer, className = '' }) {
  return (
    <div className={`ct-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="ct-card__header">
          {title && <h2 className="ct-card__title">{title}</h2>}
          {actions && <div className="d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className="ct-card__body">{children}</div>
      {footer && <div className="ct-card__footer">{footer}</div>}
    </div>
  );
}

/** Page header with eyebrow, title, description and right-side actions. */
export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="ct-page-header">
      <div className="ct-row-between">
        <div>
          {eyebrow && <div className="ct-page-header__eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </header>
  );
}

/** Pagination controls. */
export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const items = [];
  const window = 2;
  for (let p = Math.max(1, page - window); p <= Math.min(pages, page + window); p += 1) {
    items.push(p);
  }
  return (
    <nav aria-label="Pagination">
      <ul className="pagination justify-content-center ct-pagination mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page - 1)}>
            Previous
          </button>
        </li>
        {items[0] > 1 && (
          <li className="page-item disabled">
            <span className="page-link">…</span>
          </li>
        )}
        {items.map((p) => (
          <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
            <button type="button" className="page-link" onClick={() => onChange(p)}>
              {p}
            </button>
          </li>
        ))}
        {items[items.length - 1] < pages && (
          <li className="page-item disabled">
            <span className="page-link">…</span>
          </li>
        )}
        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page + 1)}>
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Form field wrapper with label + error display. */
export function FormField({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="mb-3">
      <label htmlFor={htmlFor} className="form-label">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      {children}
      {hint && !error && <div className="form-text">{hint}</div>}
      {error && (
        <div className="invalid-feedback d-block" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
