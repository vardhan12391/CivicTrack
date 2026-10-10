import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { getSummary, listOverdueProjects, getCharts } from '../services/resource';
import { PageHeader, Card, StatCard } from '../components/ui';
import { StatusDoughnut, DepartmentBars } from '../components/Charts';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../utils/format';

/**
 * Public dashboard: live platform statistics + overdue watchlist.
 * Every number here is computed by the backend from the database.
 */
export default function PublicDashboard() {
  const summary = useApiData(getSummary, []);
  const overdue = useApiData(listOverdueProjects, []);
  const charts = useApiData(getCharts, []);

  if (summary.loading) return <div className="ct-container ct-page"><LoadingState label="Loading public dashboard…" /></div>;
  if (summary.error)
    return (
      <div className="ct-container ct-page">
        <Card><ErrorState error={summary.error} onRetry={summary.reload} title="Dashboard unavailable" /></Card>
      </div>
    );

  const t = summary.data?.totals || {};
  const overdueItems = overdue.data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Live from the database"
        title="Public dashboard"
        description="A snapshot of public works activity across all departments: what is planned, active, late, completed — and where citizens are reporting problems."
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Total projects" value={t.projects?.total} to="/projects" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Active" value={t.projects?.active} to="/projects?status=active" tone="accent" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Overdue" value={t.projects?.overdue} to="/projects?overdue=1" tone="danger" hint="Past planned end date" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Completed" value={t.projects?.completed} to="/projects?status=completed" />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Citizen reports (open)" value={t.reports?.open} tone="warning" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Reports resolved" value={t.reports?.resolved} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Potential conflicts (open)" value={t.conflicts?.open} to="/roadsync" tone="warning" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Conflicts resolved" value={t.conflicts?.resolved} to="/roadsync" />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-5">
          <Card title="Project status distribution" actions={<span className="ct-small ct-muted">Live from the database</span>}>
            {charts.loading && <LoadingState />}
            {charts.error && <ErrorState error={charts.error} onRetry={charts.reload} />}
            {!charts.loading && !charts.error && (
              <StatusDoughnut items={charts.data?.statusDistribution} emptyLabel="No projects yet" />
            )}
          </Card>
        </div>
        <div className="col-md-7">
          <Card title="Projects by department" actions={<span className="ct-small ct-muted">Total vs active</span>}>
            {charts.loading && <LoadingState />}
            {charts.error && <ErrorState error={charts.error} onRetry={charts.reload} />}
            {!charts.loading && !charts.error && (
              <DepartmentBars items={charts.data?.departmentWorkload} />
            )}
          </Card>
        </div>
      </div>

      <div className="row g-4 pb-4">
        <div className="col-lg-7">
          <Card title="Overdue projects watchlist" actions={<Link to="/projects?overdue=1" className="ct-small">View all</Link>}>
            {overdue.loading && <LoadingState />}
            {overdue.error && <ErrorState error={overdue.error} onRetry={overdue.reload} />}
            {!overdue.loading && !overdue.error && overdueItems.length === 0 && (
              <EmptyState icon="✅" title="Nothing is overdue" message="Every project is within its planned end date." />
            )}
            {!overdue.loading && !overdue.error && overdueItems.length > 0 && (
              <div className="table-responsive">
                <table className="table ct-table mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Department</th>
                      <th>Planned end</th>
                      <th className="text-end">Days overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueItems.slice(0, 8).map((p) => (
                      <tr key={p._id}>
                        <td>
                          <Link to={`/projects/${p._id}`} className="ct-link-strong">{p.title}</Link>
                          {p.delayExplanation && (
                            <div className="ct-small ct-muted">“{p.delayExplanation.slice(0, 80)}…”</div>
                          )}
                        </td>
                        <td className="ct-small">{p.department?.name || '—'}</td>
                        <td className="ct-small">
                          {formatDate(p.plannedEndDate)}
                          {p.revisedEndDate && (
                            <div className="ct-small ct-muted">revised: {formatDate(p.revisedEndDate)}</div>
                          )}
                        </td>
                        <td className="text-end">
                          <StatusBadge status="overdue" label={`${p.daysOverdue} d`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-5">
          <Card title="How to use this dashboard">
            <p className="ct-small">
              Looking for a specific street? Use the <Link to="/projects">project directory</Link>{' '}
              or the <Link to="/map">infrastructure map</Link>.
            </p>
            <p className="ct-small">
              Noticed a problem — a damaged road, stalled work, unsafe site?{' '}
              <Link to="/reports/new">Submit a citizen report</Link> and track the official
              response on your <Link to="/reports/mine">reports page</Link>.
            </p>
            <p className="ct-small mb-0">
              Curious why two crews keep digging the same road? See{' '}
              <Link to="/roadsync">RoadSync conflicts</Link> — potential schedule overlaps between
              departments, flagged for review.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
