import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/format';
import { AlertBox } from '../components/States';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ct-container ct-page ct-container--narrow">
      <div className="ct-card">
        <div className="ct-card__body p-4 p-md-5">
          <div className="text-center mb-4">
            <span className="ct-brand-mark mb-2" style={{ width: 42, height: 42, fontSize: '1.1rem' }} aria-hidden="true">
              CT
            </span>
            <h1 className="h3 mb-1">Sign in to CivicTrack</h1>
            <p className="ct-muted ct-small mb-0">
              Citizens track their reports; officials manage projects and conflicts.
            </p>
          </div>

          {error && (
            <div className="mb-3">
              <AlertBox tone="danger" onClose={() => setError(null)}>
                {error}
              </AlertBox>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-ct-primary w-100" disabled={pending}>
              {pending ? (
                <>
                  <span className="ct-spinner me-2" style={{ borderTopColor: '#fff', width: '0.95rem', height: '0.95rem' }} />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center ct-small mt-4 mb-0">
            No account yet? <Link to="/register">Create a citizen account</Link>
          </p>
        </div>
      </div>

      <div className="ct-callout ct-callout--info mt-4">
        <div className="ct-callout__title">Demo accounts</div>
        <div className="ct-small">
          This build ships with clearly labelled fictional accounts (see the README):
          <br />
          <span className="ct-mono">aisha@civictrack.demo</span> ·{' '}
          <span className="ct-mono">officer.water@civictrack.demo</span> ·{' '}
          <span className="ct-mono">admin@civictrack.demo</span>
          <br />
          Passwords: <span className="ct-mono">DemoCitizen123!</span> ·{' '}
          <span className="ct-mono">DemoOfficial123!</span> ·{' '}
          <span className="ct-mono">DemoAdmin123!</span>
        </div>
      </div>
    </div>
  );
}
