import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApiData, useApiMutation } from '../hooks/useApiData';
import { getConflict, updateConflictStatus } from '../services/resource';
import { PageHeader, Card, FormField } from '../components/ui';
import { LoadingState, ErrorState, AlertBox } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { CONFLICT_STATUS, CONFLICT_PRIORITY } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/format';

/**
 * Official conflict review page.
 * Mark under review → optionally change a project's schedule (with reason) →
 * resolve or dismiss with a documented explanation.
 */
export default function ConflictReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiData(() => getConflict(id), [id]);
  const mutate = useApiMutation(updateConflictStatus);

  const [note, setNote] = useState('');
  const [message, setMessage] = useState(null);

  if (loading) return <div className="ct-container ct-page"><LoadingState label="Loading conflict…" /></div>;
  if (error)
    return (
      <div className="ct-container ct-page">
        <Card><ErrorState error={error} onRetry={reload} title="Couldn't load this conflict" /></Card>
      </div>
    );

  const c = data?.conflict || data;
  const open = c.status === 'unreviewed' || c.status === 'under_review';

  const submit = async (payload, successText) => {
    setMessage(null);
    try {
      await mutate.run(id, payload);
      setMessage({ tone: 'success', text: successText });
      reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Update failed.') });
    }
  };

  const handleMarkUnderReview = () => {
    if (!note.trim()) {
      setMessage({ tone: 'warning', text: 'Add a short review note before marking this conflict under review.' });
      return;
    }
    submit({ status: 'under_review', reviewNote: note.trim() }, 'Conflict marked as under review.');
  };

  const handleResolve = () => {
    if (!note.trim()) {
      setMessage({ tone: 'warning', text: 'A resolution note is required.' });
      return;
    }
    submit({ status: 'resolved', resolution: note.trim() }, 'Conflict resolved. The decision is recorded in the audit history.');
  };

  const handleDismiss = () => {
    if (!note.trim()) {
      setMessage({ tone: 'warning', text: 'A documented explanation is required to dismiss a conflict.' });
      return;
    }
    submit({ status: 'dismissed', resolution: note.trim() }, 'Conflict dismissed with explanation.');
  };

  const pA = c.projectIds?.[0];
  const pB = c.projectIds?.[1];

  return (
    <div className="ct-container ct-page ct-container--narrow">
      <nav aria-label="breadcrumb" className="ct-small mb-2">
        <Link to="/roadsync">RoadSync</Link> <span className="ct-muted mx-1">/</span>
        <span className="ct-muted">Review conflict</span>
      </nav>

      <PageHeader
        eyebrow={`Conflict · ${c.roadSegmentId}`}
        title="Review potential conflict"
        actions={
          <div className="d-flex gap-2">
            <StatusBadge status={c.priority} map={CONFLICT_PRIORITY} />
            <StatusBadge status={c.status} map={CONFLICT_STATUS} />
          </div>
        }
      />

      {message && (
        <div className="mb-3">
          <AlertBox tone={message.tone} onClose={() => setMessage(null)}>{message.text}</AlertBox>
        </div>
      )}

      <div className="ct-explain mb-4">
        <strong>Why this was flagged:</strong> {c.explanation}
        <div className="ct-small ct-muted mt-1">
          Overlap window: {formatDate(c.overlapStartDate)} → {formatDate(c.overlapEndDate)}
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[pA, pB].map((p, idx) => (
          <div className="col-md-6" key={idx}>
            <Card title={`Project ${idx === 0 ? 'A' : 'B'}`}>
              {p ? (
                <>
                  <div className="ct-small ct-muted">{p.department?.name}</div>
                  <Link to={`/projects/${p._id}`} className="ct-link-strong">{p.title}</Link>
                  <div className="ct-small mt-1">
                    Start: {formatDate(p.startDate)}
                    <br />
                    Planned end: {formatDate(p.plannedEndDate)}
                    {p.revisedEndDate && (
                      <>
                        <br />
                        Revised end: {formatDate(p.revisedEndDate)}
                      </>
                    )}
                  </div>
                  <Link to={`/official/projects/${p._id}/edit`} className="btn btn-ct-outline btn-sm mt-2">
                    Edit schedule
                  </Link>
                </>
              ) : (
                <span className="ct-muted ct-small">This project has been deleted.</span>
              )}
            </Card>
          </div>
        ))}
      </div>

      {open ? (
        <Card title="Your review">
          <FormField
            label="Review note / resolution"
            htmlFor="note"
            hint="Explain the coordination decision. This is appended to the conflict's review history and the audit log."
            required
          >
            <textarea
              id="note"
              className="form-control"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Water pipeline team will start after the road resurfacing finishes; Roads shifted start by 4 days."
            />
          </FormField>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-ct-outline" onClick={handleMarkUnderReview} disabled={mutate.pending}>
              Mark under review
            </button>
            <button type="button" className="btn btn-ct-accent" onClick={handleResolve} disabled={mutate.pending}>
              Resolve conflict
            </button>
            <button type="button" className="btn btn-ct-outline" onClick={handleDismiss} disabled={mutate.pending}>
              Dismiss (no conflict)
            </button>
            {c.status === 'under_review' && (
              <button
                type="button"
                className="btn btn-ct-primary"
                onClick={() => navigate(`/projects/${pA?._id || ''}`)}
              >
                View project timeline
              </button>
            )}
          </div>
          <div className="form-text mt-2">
            Projects are never rescheduled automatically. Change a project's dates via its edit
            page — the original schedule is preserved in the audit history.
          </div>
        </Card>
      ) : (
        <Card title="Outcome">
          <p className="mb-1">
            <strong>{c.status === 'resolved' ? 'Resolved' : 'Dismissed'}</strong>
            {c.resolvedBy?.name && <> by {c.resolvedBy.name}</>}
            {c.resolvedAt && <> on {formatDate(c.resolvedAt)}</>}
          </p>
          {c.resolution && <p className="mb-0 ct-muted">“{c.resolution}”</p>}
        </Card>
      )}

      {c.reviewNotes?.length > 0 && (
        <Card title="Review history" className="mt-4">
          <div className="ct-timeline">
            {c.reviewNotes.map((n, i) => (
              <div className="ct-timeline__item" key={i}>
                <span className="ct-timeline__dot" aria-hidden="true" />
                <div className="ct-timeline__meta">
                  {formatDate(n.at)} · {n.by?.name || 'Official'} · {CONFLICT_STATUS[n.status]?.label || n.status}
                </div>
                <div className="ct-timeline__text">“{n.note}”</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
