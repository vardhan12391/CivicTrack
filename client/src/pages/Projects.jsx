import { useSearchParams, Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { listProjects, listDepartments } from '../services/resource';
import { PageHeader, Card, Pagination } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { PROJECT_STATUS, PROJECT_CATEGORIES } from '../utils/constants';
import { formatDate, formatBudget } from '../utils/format';

export default function Projects() {
  const [params, setParams] = useSearchParams();

  const query = {
    search: params.get('search') || '',
    status: params.get('status') || '',
    category: params.get('category') || '',
    departmentId: params.get('departmentId') || '',
    roadSegmentId: params.get('roadSegmentId') || '',
    overdue: params.get('overdue') || '',
    page: params.get('page') || '1',
  };

  const { data, error, loading, reload } = useApiData(
    () => listProjects(query),
    [params.toString()]
  );
  const { data: deptData } = useApiData(listDepartments, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page'); // reset paging on filter change
    setParams(next);
  };

  const items = data?.items || [];
  const hasFilters = Boolean(
    query.search || query.status || query.category || query.departmentId || query.roadSegmentId || query.overdue
  );

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Public directory"
        title="Infrastructure projects"
        description="Every registered public-works project across all departments. Filter by status, category, department, or road segment."
      />

      <div className="ct-filters mb-4">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="f-search">Search</label>
            <input
              id="f-search"
              className="form-control"
              placeholder="Title, description, contractor…"
              defaultValue={query.search}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setParam('search', e.target.value.trim());
              }}
              onBlur={(e) => setParam('search', e.target.value.trim())}
            />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label" htmlFor="f-status">Status</label>
            <select
              id="f-status"
              className="form-select"
              value={query.status}
              onChange={(e) => setParam('status', e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(PROJECT_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label" htmlFor="f-category">Category</label>
            <select
              id="f-category"
              className="form-select"
              value={query.category}
              onChange={(e) => setParam('category', e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(PROJECT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="f-dept">Department</label>
            <select
              id="f-dept"
              className="form-select"
              value={query.departmentId}
              onChange={(e) => setParam('departmentId', e.target.value)}
            >
              <option value="">All departments</option>
              {(deptData?.items || deptData || []).map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-1 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-ct-outline w-100"
              disabled={!hasFilters}
              onClick={() => setParams(new URLSearchParams())}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading && <LoadingState label="Loading projects…" />}
      {error && (
        <Card>
          <ErrorState error={error} onRetry={reload} title="Couldn't load projects" />
          <div className="ct-small text-center text-danger">{getErrorMessage(error)}</div>
        </Card>
      )}
      {!loading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            icon="🔍"
            title={hasFilters ? 'No projects match these filters' : 'No projects registered yet'}
            message={
              hasFilters
                ? 'Try broadening your search or clearing the filters.'
                : 'Projects will appear here once officials create them.'
            }
            action={
              hasFilters ? (
                <button type="button" className="btn btn-ct-outline btn-sm" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </button>
              ) : null
            }
          />
        </Card>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-baseline mb-2">
            <div className="ct-small ct-muted">
              {data.total} project{data.total === 1 ? '' : 's'} found
            </div>
          </div>
          <div className="row g-3">
            {items.map((p) => (
              <div className="col-lg-6" key={p._id}>
                <ProjectCard project={p} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={data.page} pages={data.pages} onChange={(page) => setParam('page', String(page))} />
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCard({ project: p }) {
  return (
    <div className="ct-card h-100">
      <div className="ct-card__body">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <div className="ct-small ct-muted">{p.department?.name || 'Unassigned department'}</div>
            <h2 className="ct-card__title mb-0" style={{ fontSize: '1.02rem' }}>
              <Link to={`/projects/${p._id}`}>{p.title}</Link>
            </h2>
          </div>
          <div className="d-flex gap-1 flex-shrink-0 flex-wrap justify-content-end">
            <StatusBadge status={p.status} map={PROJECT_STATUS} />
            {p.isOverdue && <StatusBadge status="overdue" label="Overdue" />}
          </div>
        </div>

        <p className="ct-small ct-muted mb-2">
          {p.description?.length > 140 ? `${p.description.slice(0, 139)}…` : p.description}
        </p>

        <div className="d-flex flex-wrap gap-x-3 gap-y-1 ct-small ct-muted">
          <span>
            🛣 <span className="ct-mono">{p.roadSegmentId}</span>
          </span>
          <span>📅 {formatDate(p.startDate)} → {formatDate(p.revisedEndDate || p.plannedEndDate)}</span>
          {p.budget ? <span>💰 {formatBudget(p.budget, p.currency)}</span> : null}
        </div>
      </div>
    </div>
  );
}
