import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApiData, useApiMutation } from '../hooks/useApiData';
import { listConflicts, scanConflicts, getCharts } from '../services/resource';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Card, StatCard } from '../components/ui';
import { StatusDoughnut } from '../components/Charts';
import { LoadingState, ErrorState, EmptyState, AlertBox } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { CONFLICT_STATUS, CONFLICT_PRIORITY } from '../utils/constants';
import { formatDate, getErrorMessage } from '../utils/format';

/**
 * RoadSync dashboard — the signature feature.
 * Lists real conflicts detected by the backend engine, with counts by status.
 */
export default function RoadSyncDashboard() {
  const [params, setParams] = useSearchParams();
  const { isOfficial } = useAuth();
  const status = params.get('status') || '';
  const [scanMsg, setScanMsg] = useState(null);

  const { data, error, loading, reload } = useApiData(
    () => listConflicts(status ? { status } : {}),
    [status]
  );
  const scan = useApiMutation(scanConflicts);
  const charts = useApiData(getCharts, []);

  const handleScan = async () => {
    setScanMsg(null);
    try {
      const result = await scan.run();
      setScanMsg({
        tone: 'success',
        text: `Scan complete — ${result.created ?? 0} new conflict(s) detected, ${result.active ?? 0} active conflict(s) overall.`,
      });
      reload();
    } catch (err) {
      setScanMsg({ tone: 'danger', text: getErrorMessage(err, 'Scan failed.') });
    }
  };

  const summary = data?.summary || { total: 0, unreviewed: 0, under_review: 0, resolved: 0, dismissed: 0 };
  const items = data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Signature feature"
        title="RoadSync — conflict detection"
        description="Potential coordination conflicts between departments: two different departments scheduled to work on the same road segment with overlapping dates. Conflicts are flagged for human review — nothing is rescheduled automatically."
        actions={
          isOfficial ? (
            <button type="button" className="btn btn-ct-primary" onClick={handleScan} disabled={scan.pending}>
              {scan.pending ? 'Scanning…' : 'Run detection scan'}
            </button>
          ) : (
            <Link to="/login" className="btn btn-ct-outline">Sign in as official</Link>
          )
        }
      />

      {scanMsg && (
        <div className="mb-3">
          <AlertBox tone={scanMsg.tone} onClose={() => setScanMsg(null)}>{scanMsg.text}</AlertBox>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="ct-callout ct-callout--teal h-100">
            <div className="ct-callout__title">How detection works</div>
            RoadSync compares every pair of <strong>planned/active</strong> projects from{' '}
            <strong>different departments</strong>. If the <strong>normalised road segment IDs</strong>{' '}
            match and the inclusive date ranges overlap (<code className="ct-mono">startA ≤ endB &amp;&amp; startB ≤ endA</code>),
            it raises a potential conflict with a written explanation. Detection is re-run whenever a
            project's schedule changes.
          </div>
        </div>
        <div className="col-lg-4">
          <Card title="Conflict status">
            {charts.loading && <LoadingState />}
            {charts.error && <ErrorState error={charts.error} onRetry={charts.reload} />}
            {!charts.loading && !charts.error && (
              <StatusDoughnut items={charts.data?.conflictStatus} emptyLabel="No conflicts yet" />
            )}
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Total conflicts" value={summary.total} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Unreviewed" value={summary.unreviewed} tone="warning" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Under review" value={summary.under_review} tone="accent" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Resolved / dismissed" value={summary.resolved + summary.dismissed} />
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap mb-3">
        {['', 'unreviewed', 'under_review', 'resolved', 'dismissed'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`btn btn-sm ${status === s ? 'btn-ct-primary' : 'btn-ct-outline'}`}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (s) next.set('status', s);
              else next.delete('status');
              setParams(next);
            }}
          >
            {s ? CONFLICT_STATUS[s].label : 'All'}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Loading conflicts…" />}
      {error && <Card><ErrorState error={error} onRetry={reload} title="Couldn't load conflicts" /></Card>}
      {!loading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            icon="✅"
            title={status ? `No ${CONFLICT_STATUS[status]?.label.toLowerCase()} conflicts` : 'No conflicts detected'}
            message="When two departments schedule overlapping work on the same road segment, it will appear here."
          />
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="row g-3 pb-4">
          {items.map((c) => (
            <div className="col-12" key={c._id}>
              <ConflictCard conflict={c} isOfficial={isOfficial} onChanged={reload} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictCard({ conflict: c, isOfficial, onChanged }) {
  const pA = c.projectIds?.[0];
  const pB = c.projectIds?.[1];

  return (
    <div className="ct-card">
      <div className="ct-card__header">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <StatusBadge status={c.priority} map={CONFLICT_PRIORITY} />
          <StatusBadge status={c.status} map={CONFLICT_STATUS} />
          <span className="ct-mono">{c.roadSegmentId}</span>
        </div>
        <div className="ct-small ct-muted">
          Overlap: {formatDate(c.overlapStartDate)} → {formatDate(c.overlapEndDate)}
        </div>
      </div>
      <div className="ct-card__body">
        <div className="row g-3">
          <div className="col-md-6">
            <div className="ct-small ct-muted">Project A — {pA?.department?.name || '—'}</div>
            {pA ? (
              <Link to={`/projects/${pA._id}`} className="ct-link-strong">{pA.title}</Link>
            ) : (
              <span className="ct-muted">deleted project</span>
            )}
            {pA && (
              <div className="ct-small ct-muted">
                {formatDate(pA.startDate)} → {formatDate(pA.revisedEndDate || pA.plannedEndDate)}
              </div>
            )}
          </div>
          <div className="col-md-6">
            <div className="ct-small ct-muted">Project B — {pB?.department?.name || '—'}</div>
            {pB ? (
              <Link to={`/projects/${pB._id}`} className="ct-link-strong">{pB.title}</Link>
            ) : (
              <span className="ct-muted">deleted project</span>
            )}
            {pB && (
              <div className="ct-small ct-muted">
                {formatDate(pB.startDate)} → {formatDate(pB.revisedEndDate || pB.plannedEndDate)}
              </div>
            )}
          </div>
        </div>

        <div className="ct-explain mt-3">
          <strong>Why flagged:</strong> {c.explanation}
        </div>

        {c.reviewNotes?.length > 0 && (
          <div className="mt-3 ct-small">
            <strong>Review history:</strong>
            <ul className="mb-0 mt-1">
              {c.reviewNotes.map((n, i) => (
                <li key={i}>
                  {formatDate(n.at)} — {n.status}: “{n.note}” ({n.by?.name || 'official'})
                </li>
              ))}
            </ul>
          </div>
        )}

        {(c.resolution || c.reviewNote) && (
          <div className="ct-callout ct-callout--success mt-3">
            <div className="ct-callout__title">
              {c.status === 'dismissed' ? 'Dismissed' : 'Resolved'} by {c.resolvedBy?.name || c.reviewedBy?.name || 'an official'}
            </div>
            {c.resolution || c.reviewNote}
          </div>
        )}

        {isOfficial && (c.status === 'unreviewed' || c.status === 'under_review') && (
          <div className="mt-3">
            <Link to={`/roadsync/${c._id}`} className="btn btn-ct-accent btn-sm">
              Review this conflict
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
