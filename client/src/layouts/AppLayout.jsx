import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { initials } from '../utils/format';

const publicLinks = [
  { to: '/projects', label: 'Projects' },
  { to: '/map', label: 'Map' },
  { to: '/dashboard', label: 'Public Dashboard' },
  { to: '/roadsync', label: 'RoadSync' },
  { to: '/reports/new', label: 'Report an Issue' },
  { to: '/about', label: 'About' },
];

function Navbar() {
  const { user, isAuthenticated, isOfficial, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const close = () => setExpanded(false);

  const handleLogout = async () => {
    close();
    await logout();
    navigate('/');
  };

  return (
    <nav className="ct-navbar navbar navbar-expand-md navbar-dark sticky-top">
      <div className="ct-container d-flex align-items-center">
        <Link to="/" className="navbar-brand" onClick={close}>
          <span className="ct-brand-mark" aria-hidden="true">CT</span>
          CivicTrack
        </Link>
        <button
          className="navbar-toggler ct-navbar-toggler"
          type="button"
          aria-controls="ct-main-nav"
          aria-expanded={expanded}
          aria-label="Toggle navigation"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse ${expanded ? 'show' : ''}`} id="ct-main-nav">
          <ul className="navbar-nav me-auto">
            {publicLinks.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={close}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="navbar-nav align-items-md-center">
            {isOfficial && (
              <li className="nav-item">
                <NavLink
                  to="/official"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={close}
                >
                  Official Dashboard
                </NavLink>
              </li>
            )}
            {isAdmin && (
              <li className="nav-item">
                <NavLink
                  to="/admin"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={close}
                >
                  Admin
                </NavLink>
              </li>
            )}
            {isAuthenticated ? (
              <li className="nav-item dropdown">
                <button
                  className="nav-link d-flex align-items-center gap-2 bg-transparent border-0"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  style={{ color: 'rgba(255,255,255,.85)' }}
                >
                  <span className="ct-avatar" aria-hidden="true">{initials(user.name)}</span>
                  <span className="d-none d-md-inline">{user.name.split(' ')[0]}</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  {isAuthenticated && (
                    <li>
                      <Link to="/reports/mine" className="dropdown-item" onClick={close}>
                        My Reports
                      </Link>
                    </li>
                  )}
                  {isOfficial && (
                    <li>
                      <Link to="/official/projects/new" className="dropdown-item" onClick={close}>
                        New Project
                      </Link>
                    </li>
                  )}
                  {isAdmin && (
                    <>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <Link to="/admin/users" className="dropdown-item" onClick={close}>
                          Manage Users
                        </Link>
                      </li>
                      <li>
                        <Link to="/admin/audit" className="dropdown-item" onClick={close}>
                          Audit Log
                        </Link>
                      </li>
                    </>
                  )}
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={handleLogout}>
                      Sign out
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink
                    to="/login"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={close}
                  >
                    Sign in
                  </NavLink>
                </li>
                <li className="nav-item ms-md-2">
                  <Link to="/register" className="btn btn-ct-accent btn-sm" onClick={close}>
                    Create account
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="ct-footer">
      <div className="ct-container">
        <div className="row g-4">
          <div className="col-md-4">
            <div className="ct-footer__title">
              <span className="ct-brand-mark me-2" aria-hidden="true">CT</span>
              CivicTrack
            </div>
            <p className="mb-2">
              Smart Public Works Transparency and Coordination Platform — one place for
              infrastructure projects, schedules, conflicts, and citizen feedback.
            </p>
          </div>
          <div className="col-6 col-md-3">
            <div className="ct-footer__title">Explore</div>
            <ul className="list-unstyled mb-0">
              <li className="mb-1"><Link to="/projects">Project directory</Link></li>
              <li className="mb-1"><Link to="/map">Infrastructure map</Link></li>
              <li className="mb-1"><Link to="/dashboard">Public dashboard</Link></li>
              <li className="mb-1"><Link to="/roadsync">RoadSync conflicts</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-3">
            <div className="ct-footer__title">Participate</div>
            <ul className="list-unstyled mb-0">
              <li className="mb-1"><Link to="/reports/new">Report an issue</Link></li>
              <li className="mb-1"><Link to="/reports/mine">Track my reports</Link></li>
              <li className="mb-1"><Link to="/about">Methodology</Link></li>
              <li className="mb-1"><Link to="/register">Create an account</Link></li>
            </ul>
          </div>
          <div className="col-md-2">
            <div className="ct-footer__title">Status</div>
            <p className="mb-0 ct-small">
              Demonstration build using fictional data. Not an official government service.
            </p>
          </div>
        </div>
        <div className="ct-footer__note d-flex justify-content-between flex-wrap gap-2">
          <span>© {new Date().getFullYear()} CivicTrack · CivicTech hackathon demonstration project</span>
          <span>Map data © OpenStreetMap contributors</span>
        </div>
      </div>
    </footer>
  );
}

export default function AppLayout({ children }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="ct-main flex-grow-1">{children}</main>
      <Footer />
    </div>
  );
}
