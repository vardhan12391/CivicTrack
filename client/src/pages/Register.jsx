import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/format';
import { AlertBox } from '../components/States';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (form.name.trim().length < 2) return 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
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
            <h1 className="h3 mb-1">Create your CivicTrack account</h1>
            <p className="ct-muted ct-small mb-0">
              Report infrastructure issues and track how officials respond.
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
              <label htmlFor="name" className="form-label">Full name</label>
              <input
                id="name"
                name="name"
                className="form-control"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                required
                autoFocus
              />
            </div>
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
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <div className="form-text">At least 8 characters.</div>
            </div>
            <div className="mb-4">
              <label htmlFor="confirm" className="form-label">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                className="form-control"
                value={form.confirm}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-ct-accent w-100" disabled={pending}>
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center ct-small mt-4 mb-0">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>

      <div className="ct-callout mt-4">
        <div className="ct-callout__title">Official accounts</div>
        <div className="ct-small">
          Official and administrator roles are provisioned by an existing administrator — they
          cannot be self-assigned during registration.
        </div>
      </div>
    </div>
  );
}
