import { useSearchParams } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { listAuditLogs } from '../services/resource';
import { PageHeader, Card, Pagination } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { formatDateTime } from '../utils/format';

const ENTITY_TYPES = ['', 'project', 'conflict', 'report', 'user', 'department', 'milestone'];

/** Administrator: global append-only audit log. */
export default function AdminAudit() {
  const [params, setParams] = useSearchParams();
  const entityType = params.get('entityType') || '';
  const page = params.get('page') || '1';

  const { data, error, loading, reload } = useApiData(
    () => listAuditLogs({ entityType, page, limit: 25 }),
    [entityType, page]
  );

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const items = data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Append-only record of every consequential action: creations, status changes, schedule revisions, conflict decisions, and role changes. Entries cannot be edited or deleted through the API."
      />

      <div className="d-flex gap-2 flex-wrap mb-3">
        {ENTITY_TYPES.map((t) => (
          <button
            key={t || 'all'}
            type="button"
            className={`btn btn-sm ${entityType === t ? 'btn-ct-primary' : 'btn-ct-outline'}`}
            onClick={() => setFilter('entityType', t)}
          >
            {t ? t[0].toUpperCase() + t.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {error && <Card><ErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && items.length === 0 && <Card><EmptyState icon="🕮" title="No audit entries" /></Card>}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="ct-card">
            <div className="table-responsive">
              <table className="table ct-table mb-0">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Change</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e._id}>
                      <td className="ct-small ct-muted" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.createdAt)}</td>
                      <td className="ct-small">
                        {e.actor?.name || 'System'}
                        <div className="ct-muted">{e.actorRole}</div>
                      </td>
                      <td><span className="ct-mono">{e.action}</span></td>
                      <td className="ct-small">
                        {e.entityType}
                        <div className="ct-muted ct-mono">{String(e.entityId).slice(-6)}</div>
                      </td>
                      <td className="ct-small">
                        {e.previousValues || e.newValues ? (
                          <pre className="mb-0 ct-small" style={{ fontSize: '0.72rem', maxWidth: 260, whiteSpace: 'pre-wrap' }}>
                            {diffText(e.previousValues, e.newValues)}
                          </pre>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="ct-small">{e.explanation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4">
            <Pagination page={Number(page)} pages={data.pages} onChange={(p) => setFilter('page', String(p))} />
          </div>
        </>
      )}
    </div>
  );
}

function diffText(prev, next) {
  if (!prev) return JSON.stringify(next || {}, null, 0);
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next || {})]));
  return keys
    .map((k) => `${k}: ${JSON.stringify(prev[k])} → ${JSON.stringify(next?.[k])}`)
    .join('\n');
}
