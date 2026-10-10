import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { getSummary } from '../services/resource';
import { StatCard } from '../components/ui';
import { LoadingState, ErrorState } from '../components/States';

const highlights = [
  {
    icon: '🗂',
    title: 'One project directory',
    text: 'Every road, drain, and pipeline project in one public place — purpose, department, contractor, budget, and dates.',
    to: '/projects',
  },
  {
    icon: '🧭',
    title: 'RoadSync conflict detection',
    text: 'A deterministic engine that flags two departments scheduled to dig up the same road at the same time.',
    to: '/roadsync',
  },
  {
    icon: '📣',
    title: 'Citizen reporting',
    text: 'Report damage, stalls, or unsafe work — and track the official response on your own reports.',
    to: '/reports/new',
  },
  {
    icon: '🗓',
    title: 'Delays explained',
    text: 'Overdue projects show days overdue, the revised deadline, and the department’s stated reason.',
    to: '/dashboard',
  },
];

export default function Landing() {
  const { data, error, loading, reload } = useApiData(getSummary, []);

  const stats = data?.totals;

  return (
    <>
      <section className="ct-hero">
        <div className="ct-container">
          <span className="ct-hero__eyebrow">CivicTech · Public Works Transparency</span>
          <h1>Know what is being built on your street — and who is responsible.</h1>
          <p className="mt-3 mb-4">
            CivicTrack centralises public infrastructure projects so residents, engineers, and
            administrators share one picture: what is planned, what is active, what is late, and
            where two departments are about to dig up the same road.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/projects" className="btn btn-ct-accent btn-lg px-4">
              Browse projects
            </Link>
            <Link to="/reports/new" className="btn btn-outline-light btn-lg px-4">
              Report an issue
            </Link>
          </div>
        </div>
      </section>

      <section className="ct-page">
        <div className="ct-container">
          {loading && <LoadingState label="Loading platform statistics…" />}
          {error && (
            <div className="ct-card">
              <ErrorState
                error={error}
                onRetry={reload}
                title="Live statistics unavailable"
              />
            </div>
          )}
          {!loading && !error && stats && (
            <div className="row g-3">
              <div className="col-6 col-lg-3">
                <StatCard label="Public projects" value={stats.projects.total} to="/projects" hint="All departments" />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Active now" value={stats.projects.active} to="/projects?status=active" tone="accent" />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Overdue" value={stats.projects.overdue} to="/projects?overdue=1" tone="danger" hint="Past planned end date" />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Potential conflicts" value={stats.conflicts.open} to="/roadsync" tone="warning" hint="Awaiting coordination review" />
              </div>
            </div>
          )}

          <div className="row g-4 mt-2">
            {highlights.map((item) => (
              <div className="col-md-6" key={item.title}>
                <Link to={item.to} className="text-decoration-none">
                  <div className="ct-card h-100">
                    <div className="ct-card__body">
                      <div className="d-flex gap-3 align-items-start">
                        <div className="ct-state__icon m-0 flex-shrink-0" aria-hidden="true">
                          {item.icon}
                        </div>
                        <div>
                          <h3 className="ct-card__title mb-1">{item.title}</h3>
                          <p className="ct-muted ct-small mb-0">{item.text}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <div className="ct-callout ct-callout--teal mt-4">
            <div className="ct-callout__title">RoadSync — the coordination engine</div>
            Different departments often plan work on the same road segment within days of each
            other. RoadSync compares <em>normalised road segment IDs</em> and{' '}
            <em>inclusive date ranges</em> across departments and flags potential overlaps for
            human review — before the road is dug up twice.
            <div className="mt-2">
              <Link to="/roadsync" className="btn btn-ct-outline btn-sm">
                See detected conflicts
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
