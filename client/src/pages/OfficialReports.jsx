import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiData, useApiMutation } from '../hooks/useApiData';
import { listReports, updateReportStatus, updateReportResponse } from '../services/resource';
import { PageHeader, Card, FormField } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AlertBox } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { REPORT_STATUS, REPORT_CATEGORIES } from '../utils/constants';
import { formatDateTime, getErrorMessage } from '../utils/format';

const STATUSES = Object.keys(REPORT_STATUS);

/** Official triage queue for citizen reports. */
export default function OfficialReports() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApiData(() => listReports(status ? { status } : {}), [status]);

  const items = data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Official workspace"
        title="Citizen reports"
        description="Triage incoming reports: assign a department, link a related project, respond, and change status. Every change is audit-logged."
      />

      <div className="d-flex gap-2 flex-wrap mb-3">
        {['', ...STATUSES].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`btn btn-sm ${status === s ? 'btn-ct-primary' : 'btn-ct-outline'}`}
            onClick={() => setStatus(s)}
          >
            {s ? REPORT_STATUS[s].label : 'All'}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {error && <Card><ErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && items.length === 0 && (
        <Card><EmptyState icon="📮" title="No reports in this view" /></Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="row g-3 pb-4">
          {items.map((r) => (
            <div className="col-lg-6" key={r._id}>
              <ReportRow report={r} onChanged={reload} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({ report: r, onChanged }) {
  const [response, setResponse] = useState({ officialResponse: r.officialResponse || '', resolutionNotes: r.resolutionNotes || '' });
  const [statusForm, setStatusForm] = useState({ status: r.status, note: '' });
  const [message, setMessage] = useState(null);

  const statusMutation = useApiMutation((payload) => updateReportStatus(r._id, payload));
  const responseMutation = useApiMutation((payload) => updateReportResponse(r._id, payload));

  const handleStatus = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await statusMutation.run(statusForm);
      setMessage({ tone: 'success', text: 'Status updated.' });
      onChanged();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err) });
    }
  };

  const handleResponse = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await responseMutation.run(response);
      setMessage({ tone: 'success', text: 'Response saved and visible to the citizen.' });
      onChanged();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err) });
    }
  };

  return (
    <div className="ct-card h-100">
      <div className="ct-card__header">
        <span className="ct-badge ct-badge--neutral">{REPORT_CATEGORIES[r.category]}</span>
        <StatusBadge status={r.status} map={REPORT_STATUS} />
      </div>
      <div className="ct-card__body">
        <h2 className="ct-card__title mb-1">{r.title}</h2>
        <div className="ct-small ct-muted mb-2">
          {formatDateTime(r.createdAt)} · {r.location?.address}
          {r.location?.ward ? ` · Ward ${r.location.ward}` : ''}
          {r.roadSegmentId ? (
            <> · 🛣 <span className="ct-mono">{r.roadSegmentId}</span></>
          ) : null}
        </div>
        <p className="ct-small">{r.description}</p>

        {r.images?.length > 0 && (
          <div className="d-flex gap-2 flex-wrap mb-2">
            {r.images.map((img, i) => (
              <a key={i} href={img.url} target="_blank" rel="noreferrer">
                <img src={img.url} alt={`Report attachment ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ct-border)' }} />
              </a>
            ))}
          </div>
        )}

        {message && <div className="mb-2"><AlertBox tone={message.tone} onClose={() => setMessage(null)}>{message.text}</AlertBox></div>}

        <form onSubmit={handleStatus} className="d-flex gap-2 align-items-end flex-wrap mb-2">
          <div style={{ minWidth: 160 }}>
            <FormField label="Status" htmlFor={`st-${r._id}`}>
              <select
                id={`st-${r._id}`}
                className="form-select form-select-sm"
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{REPORT_STATUS[s].label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="flex-grow-1" style={{ minWidth: 180 }}>
            <FormField label="Note to citizen (optional)" htmlFor={`nt-${r._id}`}>
              <input
                id={`nt-${r._id}`}
                className="form-control form-control-sm"
                value={statusForm.note}
                onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
              />
            </FormField>
          </div>
          <button type="submit" className="btn btn-ct-outline btn-sm mb-3" disabled={statusMutation.pending}>
            Update
          </button>
        </form>

        <form onSubmit={handleResponse}>
          <FormField label="Official response" htmlFor={`rp-${r._id}`} hint="Shown to the citizen on their report.">
            <textarea
              id={`rp-${r._id}`}
              className="form-control"
              rows={2}
              value={response.officialResponse}
              onChange={(e) => setResponse({ ...response, officialResponse: e.target.value })}
            />
          </FormField>
          <FormField label="Resolution notes (when resolved)" htmlFor={`rn-${r._id}`}>
            <input
              id={`rn-${r._id}`}
              className="form-control"
              value={response.resolutionNotes}
              onChange={(e) => setResponse({ ...response, resolutionNotes: e.target.value })}
            />
          </FormField>
          <button type="submit" className="btn btn-ct-accent btn-sm" disabled={responseMutation.pending}>
            Save response
          </button>
        </form>

        {r.linkedProject && (
          <div className="ct-small mt-2">
            🔗 Linked project: <Link to={`/projects/${r.linkedProject._id}`}>{r.linkedProject.title}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
