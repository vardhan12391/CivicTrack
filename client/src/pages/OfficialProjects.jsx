import { Link, useSearchParams } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { listProjects } from '../services/resource';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Card, Pagination } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { PROJECT_STATUS } from '../utils/constants';
import { formatDate } from '../utils/format';

export default function OfficialProjects() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = params.get('page') || '1';

  const { data, error, loading, reload } = useApiData(
    () => listProjects({ status, page, limit: 10, departmentId: user?.department?._id || '' }),
    [status, page]
  );

  const items = data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Official workspace"
        title="Manage projects"
        description={user?.department ? `Projects of the ${user.department.name}.` : 'All projects you can manage.'}
        actions={<Link to="/official/projects/new" className="btn btn-ct-accent">New project</Link>}
      />

      <div className="d-flex gap-2 flex-wrap mb-3">
        {['', ...Object.keys(PROJECT_STATUS)].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`btn btn-sm ${status === s ? 'btn-ct-primary' : 'btn-ct-outline'}`}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (s) next.set('status', s);
              else next.delete('status');
              next.delete('page');
              setParams(next);
            }}
          >
            {s ? PROJECT_STATUS[s].label : 'All'}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {error && <Card><ErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            icon="🏗"
            title="No projects yet"
            message="Create your first project to make it visible to the public and to RoadSync."
            action={<Link to="/official/projects/new" className="btn btn-ct-accent btn-sm">New project</Link>}
          />
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="ct-card">
            <div className="table-responsive">
              <table className="table ct-table mb-0">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Road segment</th>
                    <th>Schedule</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/projects/${p._id}`} className="ct-link-strong">{p.title}</Link>
                        <div className="ct-small ct-muted">{p.department?.name}</div>
                      </td>
                      <td>
                        <StatusBadge status={p.status} map={PROJECT_STATUS} />
                        {p.isOverdue && <StatusBadge status="overdue" label="Overdue" className="ms-1" />}
                      </td>
                      <td><span className="ct-mono">{p.roadSegmentId}</span></td>
                      <td className="ct-small">
                        {formatDate(p.startDate)} → {formatDate(p.revisedEndDate || p.plannedEndDate)}
                      </td>
                      <td className="text-end">
                        <Link to={`/official/projects/${p._id}/edit`} className="btn btn-ct-outline btn-sm">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4">
            <Pagination
              page={Number(page)}
              pages={data.pages}
              onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
