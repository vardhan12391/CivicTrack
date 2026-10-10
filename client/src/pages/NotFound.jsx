import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="ct-container ct-page ct-container--narrow">
      <div className="ct-card">
        <div className="ct-card__body">
          <div className="ct-state">
            <div className="ct-state__icon" aria-hidden="true">404</div>
            <div className="ct-state__title">Page not found</div>
            <div className="ct-small mb-3">The page you are looking for does not exist or has moved.</div>
            <Link to="/" className="btn btn-ct-primary btn-sm">Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
