import { useParams, Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { getProject, getProjectHistory } from '../services/resource';
import { PageHeader, Card } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { PROJECT_STATUS, PROJECT_CATEGORIES, UPDATE_TYPES } from '../utils/constants';
import { formatDate, formatDateTime, formatBudget, daysBetween, todayUtc } from '../utils/format';

export default function ProjectDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApiData(() => getProject(id), [id]);
  const history = useApiData(() => getProjectHistory(id), [id]);

  if (loading) return <div className="ct-container ct-page"><LoadingState label="Loading project…" /></div>;
  if (error)
    return (
      <div className="ct-container ct-page">
        <Card><ErrorState error={error} onRetry={reload} title="Couldn't load this project" /></Card>
      </div>
    );

  const p = data?.project || data;
  if (!p) return <div className="ct-container ct-page"><EmptyState title="Project not found" /></div>;

  const effectiveEnd = p.revisedEndDate || p.plannedEndDate;
  const remaining = daysBetween(todayUtc(), effectiveEnd);
  const milestones = p.milestones || [];
  const doneMilestones = milestones.filter((m) => m.status === 'completed').length;
  const updates = p.updates || [];

  return (
    <div className="ct-container ct-page">
      <nav aria-label="breadcrumb" className="ct-small mb-2">
        <Link to="/projects">Projects</Link> <span className="ct-muted mx-1">/</span>
        <span className="ct-muted">{p.title}</span>
      </nav>

      <PageHeader
        eyebrow={p.department?.name}
        title={p.title}
        description={p.description}
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <StatusBadge status={p.status} map={PROJECT_STATUS} />
            {p.isOverdue && <StatusBadge status="overdue" label={`Overdue by ${Math.abs(remaining)} days`} />}
          </div>
        }
      />

      {p.status === 'delayed' && p.delayExplanation && (
        <div className="ct-callout ct-callout--warning mb-4">
          <div className="ct-callout__title">Delay explanation from {p.department?.name || 'the department'}</div>
          {p.delayExplanation}
        </div>
      )}

      <div className="row g-4 pb-4">
        <div className="col-lg-8">
          <Card title="Project facts" className="mb-4">
            <div className="row g-3">
              <Fact label="Category" value={PROJECT_CATEGORIES[p.category] || p.category} />
              <Fact label="Road segment" value={<span className="ct-mono">{p.roadSegmentId}</span>} />
              <Fact label="Location" value={p.location?.address || '—'} />
              <Fact label="Ward" value={p.location?.ward || '—'} />
              <Fact label="Department" value={p.department?.name || '—'} />
              <Fact label="Assigned officer" value={p.assignedOfficer?.name || 'Not assigned'} />
              <Fact label="Contractor" value={p.contractorName || '—'} />
              <Fact label="Budget" value={formatBudget(p.budget, p.currency)} />
              <Fact label="Start date" value={formatDate(p.startDate)} />
              <Fact
                label="Planned end date"
                value={
                  <>
                    {formatDate(p.plannedEndDate)}
                    {p.revisedEndDate && (
                      <span className="ct-badge ct-badge--neutral ms-2">original</span>
                    )}
                  </>
                }
              />
              {p.revisedEndDate && (
                <Fact
                  label="Revised end date"
                  value={
                    <>
                      {formatDate(p.revisedEndDate)}{' '}
                      <span className="ct-badge ct-badge--teal">revised</span>
                    </>
                  }
                />
              )}
              <Fact
                label="Time remaining"
                value={
                  p.status === 'completed' || p.status === 'cancelled'
                    ? '—'
                    : remaining !== null
                      ? remaining >= 0
                        ? `${remaining} day${remaining === 1 ? '' : 's'} remaining`
                        : `${Math.abs(remaining)} days overdue`
                      : '—'
                }
              />
            </div>
          </Card>

          <Card
            title="Milestones"
            className="mb-4"
            actions={
              milestones.length > 0 && (
                <span className="ct-small ct-muted">
                  {doneMilestones}/{milestones.length} completed
                </span>
              )
            }
          >
            {milestones.length === 0 ? (
              <EmptyState icon="🏁" title="No milestones yet" message="Milestones break the project into verifiable stages." />
            ) : (
              <ul className="list-group list-group-flush">
                {milestones.map((m) => (
                  <li key={m._id} className="list-group-item px-0 d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="fw-semibold">{m.title}</div>
                      {m.description && <div className="ct-small ct-muted">{m.description}</div>}
                      {m.evidence?.caption && (
                        <div className="ct-small mt-1">
                          📎 {m.evidence.caption}{' '}
                          {m.evidence.verified ? (
                            <span className="ct-badge ct-badge--completed">verified</span>
                          ) : (
                            <span className="ct-badge ct-badge--unreviewed">submitted, not verified</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-end flex-shrink-0">
                      <StatusBadge
                        status={m.status}
                        map={{
                          pending: { label: 'Pending', badge: 'planned' },
                          in_progress: { label: 'In progress', badge: 'in_progress' },
                          completed: { label: 'Completed', badge: 'completed' },
                          skipped: { label: 'Skipped', badge: 'cancelled' },
                        }}
                      />
                      <div className="ct-small ct-muted mt-1">due {formatDate(m.dueDate)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Progress updates" className="mb-4">
            {updates.length === 0 ? (
              <EmptyState icon="📝" title="No updates published" message="Officials publish progress updates here." />
            ) : (
              <div className="ct-timeline">
                {updates.map((u) => (
                  <div className="ct-timeline__item" key={u._id}>
                    <span className="ct-timeline__dot" aria-hidden="true" />
                    <div className="ct-timeline__meta">
                      {formatDateTime(u.createdAt)} · {u.author?.name || 'Official'} ·{' '}
                      {UPDATE_TYPES[u.updateType] || u.updateType}
                    </div>
                    <div className="ct-timeline__text">{u.message}</div>
                    {u.evidence?.length > 0 && (
                      <div className="ct-small ct-muted mt-1">
                        📎 {u.evidence.length} attachment{u.evidence.length === 1 ? '' : 's'} — submitted by the
                        department, not independently verified.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-lg-4">
          <Card title="Accountability timeline" className="mb-4">
            {history.loading && <LoadingState label="Loading history…" />}
            {history.error && <ErrorState error={history.error} onRetry={history.reload} />}
            {!history.loading && !history.error && (history.data?.items || []).length === 0 && (
              <EmptyState icon="🕮" title="No recorded actions yet" />
            )}
            {!history.loading && !history.error && (history.data?.items || []).length > 0 && (
              <div className="ct-timeline">
                {history.data.items.slice(0, 20).map((entry) => (
                  <div className="ct-timeline__item" key={entry._id}>
                    <span className="ct-timeline__dot" aria-hidden="true" />
                    <div className="ct-timeline__meta">
                      {formatDateTime(entry.createdAt)} · {entry.actor?.name || 'System'} ({entry.actorRole})
                    </div>
                    <div className="ct-timeline__text">
                      <strong>{entry.action}</strong>
                      {entry.previousValues && entry.newValues && (
                        <div className="ct-small ct-muted">
                          {Object.keys(entry.previousValues).map((k) => (
                            <div key={k}>
                              {k}: {JSON.stringify(entry.previousValues[k])} → {JSON.stringify(entry.newValues?.[k])}
                            </div>
                          ))}
                        </div>
                      )}
                      {entry.explanation && <div className="ct-small">“{entry.explanation}”</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Simulated data notice">
            <p className="ct-small mb-0">
              This project is fictional demonstration data. CivicTrack is a hackathon prototype and
              is not connected to any government department.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="col-sm-6">
      <div className="ct-small ct-muted">{label}</div>
      <div className="fw-semibold">{value}</div>
    </div>
  );
}
