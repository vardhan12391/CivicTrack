import { getErrorMessage } from '../utils/format';

/** Full-area loading spinner with an optional label. */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="ct-state" role="status" aria-live="polite">
      <div className="ct-spinner mx-auto mb-2" style={{ width: '1.8rem', height: '1.8rem' }} />
      <div className="ct-small ct-muted">{label}</div>
    </div>
  );
}

/** Inline card-sized spinner used inside tables and panels. */
export function InlineSpinner({ label = 'Loading…' }) {
  return (
    <div className="d-flex align-items-center gap-2 py-3 justify-content-center ct-small ct-muted" role="status">
      <span className="ct-spinner" /> {label}
    </div>
  );
}

/** Friendly empty state. */
export function EmptyState({ icon = '∅', title = 'Nothing here yet', message, action }) {
  return (
    <div className="ct-state">
      <div className="ct-state__icon" aria-hidden="true">{icon}</div>
      <div className="ct-state__title">{title}</div>
      {message && <div className="ct-small">{message}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error state with retry button. */
export function ErrorState({ error, onRetry, title = "Couldn't load data" }) {
  return (
    <div className="ct-state ct-state--error" role="alert">
      <div className="ct-state__icon" aria-hidden="true">!</div>
      <div className="ct-state__title">{title}</div>
      <div className="ct-small">{getErrorMessage(error)}</div>
      {onRetry && (
        <button type="button" className="btn btn-ct-outline btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline alert box (success / danger / warning / info / teal). */
export function AlertBox({ tone = 'info', title, children, onClose }) {
  return (
    <div className={`ct-callout ct-callout--${tone} d-flex justify-content-between align-items-start gap-2`} role="alert">
      <div>
        {title && <div className="ct-callout__title">{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          className="btn-close btn-sm"
          aria-label="Close"
          onClick={onClose}
          style={{ marginTop: '0.15rem' }}
        />
      )}
    </div>
  );
}

/** Page-level loading/error/empty router: renders the right state or children. */
export function AsyncBoundary({ loading, error, empty, onRetry, emptyProps, children, label }) {
  if (loading) return <LoadingState label={label} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (empty) return <EmptyState {...emptyProps} />;
  return children;
}
