import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingState } from './States';

/**
 * Client-side route guard.
 * NOTE: this is UX only — every API it protects is enforced again on the server.
 */
export default function ProtectedRoute({ officialOnly = false, adminOnly = false, children }) {
  const { user, loading, isOfficial, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="ct-container ct-page">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (officialOnly && !isOfficial) {
    return <Navigate to="/" replace />;
  }
  return children;
}
