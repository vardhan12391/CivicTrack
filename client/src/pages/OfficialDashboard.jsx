import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { getSummary, listOverdueProjects, listConflicts, listReports } from '../services/resource';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Card, StatCard } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { CONFLICT_STATUS, REPORT_STATUS, DEPARTMENT_TYPES } from '../utils/constants';
import { formatDate, formatDateTime } from '../utils/format';

export default function OfficialDashboard() {
  const { user } = useAuth();
  const summary = useApiData(getSummary, []);
  const overdue = useApiData(listOverdueProjects, []);
  const conflicts = useApiData(() => listConflicts({ status: 'unreviewed' }), []);
  const reports = useApiData(() => listReports({ status: 'submitted', limit: 6 }), []);

  if (summary.loading) return <div className="ct-container ct-page"><LoadingState /></div>;
  if (summary.error)
    return (
      <div className="ct-container ct-page">
        <Card><ErrorState error={summary.error} onRetry={summary.reload} /></Card>
      </div>
    );

  const t = summary.data?.totals || {};
  const overdueItems = overdue.data?.items || [];
  const conflictItems = conflicts.data?.items || [];
  const reportItems = reports.data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow={user?.department ? DEPARTMENT_TYPES[user.department.departmentType] || 'Official' : 'Official'}
        title={`Welcome, ${user?.name?.split(' ')[0] || 'official'}`}
        description="Manage projects, publish progress, review citizen reports, and coordinate with other departments through RoadSync."
        actions={
          <>
            <Link to="/official/projects/new" className="btn btn-ct-accent">New project</Link>
            <Link to="/official/projects" className="btn btn-ct-outline">My projects</Link>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Total projects" value={t.projects?.total} to="/official/projects" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Overdue" value={t.projects?.overdue} to="/official/projects" tone="danger" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Unreviewed conflicts" value={t.conflicts?.unreviewed} to="/roadsync" tone="warning" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Open citizen reports" value={t.reports?.open} to="/official/reports" tone="accent" />
        </div>
      </div>

      <div className="row g-4 pb-4">
        <div className="col-lg-6">
          <Card
            title="Conflicts awaiting review"
            actions={<Link to="/roadsync" className="ct-small">RoadSync dashboard</Link>}
          >
            {conflictItems.length === 0 ? (
              <EmptyState icon="✅" title="No unreviewed conflicts" message="RoadSync will flag new overlaps here." />
            ) : (
              <ul className="list-group list-group-flush">
                {conflictItems.slice(0, 5).map((c) => (
                  <li key={c._id} className="list-group-item px-0">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <Link to={`/roadsync/${c._id}`} className="ct-link-strong">
                          {c.roadSegmentId} · {c.projectIds?.[0]?.title} ↔ {c.projectIds?.[1]?.title}
                        </Link>
                        <div className="ct-small ct-muted">
                          Overlap {formatDate(c.overlapStartDate)} → {formatDate(c.overlapEndDate)}
                        </div>
                      </div>
                      <StatusBadge status={c.status} map={CONFLICT_STATUS} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card
            title="Newest citizen reports"
            actions={<Link to="/official/reports" className="ct-small">All reports</Link>}
          >
            {reportItems.length === 0 ? (
              <EmptyState icon="📮" title="No reports waiting" message="New citizen reports appear here for triage." />
            ) : (
              <ul className="list-group list-group-flush">
                {reportItems.map((r) => (
                  <li key={r._id} className="list-group-item px-0">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="fw-semibold">{r.title}</div>
                        <div className="ct-small ct-muted">
                          {formatDateTime(r.createdAt)} · {r.location?.address}
                        </div>
                      </div>
                      <StatusBadge status={r.status} map={REPORT_STATUS} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-12">
          <Card title="Overdue projects (all departments)">
            {overdueItems.length === 0 ? (
              <EmptyState icon="✅" title="No overdue projects" />
            ) : (
              <div className="table-responsive">
                <table className="table ct-table mb-0">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Department</th>
                      <th>Planned end</th>
                      <th>Delay explanation</th>
                      <th className="text-end">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueItems.map((p) => (
                      <tr key={p._id}>
                        <td><Link to={`/projects/${p._id}`} className="ct-link-strong">{p.title}</Link></td>
                        <td className="ct-small">{p.department?.name}</td>
                        <td className="ct-small">{formatDate(p.plannedEndDate)}</td>
                        <td className="ct-small ct-muted">{p.delayExplanation || '— no explanation recorded —'}</td>
                        <td className="text-end"><StatusBadge status="overdue" label={`${p.daysOverdue} d`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
