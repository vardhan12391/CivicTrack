import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { listMyReports, uploadReportImage } from '../services/resource';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Card } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AlertBox } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { REPORT_STATUS, REPORT_CATEGORIES } from '../utils/constants';
import { formatDateTime } from '../utils/format';

export default function MyReports() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [flash, setFlash] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);
  const { data, error, loading, reload } = useApiData(listMyReports, [], { immediate: isAuthenticated });

  /** Attach a photo to one of the citizen's own reports. */
  const handleUpload = async (reportId, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('That image is larger than 5 MB — please attach a smaller photo.');
      return;
    }
    setUploadError(null);
    setUploadingId(reportId);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await uploadReportImage(reportId, fd);
      reload();
    } catch (err) {
      setUploadError(err?.response?.data?.error?.message || 'Could not upload the photo. Please try a different image.');
    } finally {
      setUploadingId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  useEffect(() => {
    if (location.state?.justSubmitted) {
      setFlash('Your report was submitted. Officials will review it — you will see status changes here.');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  if (!isAuthenticated) {
    return (
      <div className="ct-container ct-page ct-container--narrow">
        <PageHeader eyebrow="Citizen reporting" title="Track your reports" />
        <Card>
          <p>Sign in to see the reports you have submitted and the official responses.</p>
          <Link to="/login" className="btn btn-ct-primary">Sign in</Link>
        </Card>
      </div>
    );
  }

  const items = data?.items || [];

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Citizen reporting"
        title="Your reports"
        description="Every report you have submitted, with its current status and the department's responses."
        actions={
          <Link to="/reports/new" className="btn btn-ct-accent">New report</Link>
        }
      />

      {flash && (
        <div className="mb-3">
          <AlertBox tone="success" onClose={() => setFlash(null)}>{flash}</AlertBox>
        </div>
      )}

      {uploadError && (
        <div className="mb-3">
          <AlertBox tone="danger" onClose={() => setUploadError(null)}>{uploadError}</AlertBox>
        </div>
      )}

      {loading && <LoadingState label="Loading your reports…" />}
      {error && <Card><ErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            icon="📮"
            title="You haven't submitted any reports"
            message="See a damaged road, stalled work, or unsafe construction site? Report it and track the response."
            action={<Link to="/reports/new" className="btn btn-ct-accent btn-sm">Report an issue</Link>}
          />
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="row g-3 pb-4">
          {items.map((r) => (
            <div className="col-lg-6" key={r._id}>
              <div className="ct-card h-100">
                <div className="ct-card__header">
                  <span className="ct-badge ct-badge--neutral">{REPORT_CATEGORIES[r.category]}</span>
                  <StatusBadge status={r.status} map={REPORT_STATUS} />
                </div>
                <div className="ct-card__body">
                  <h2 className="ct-card__title mb-1">{r.title}</h2>
                  <div className="ct-small ct-muted mb-2">
                    Submitted {formatDateTime(r.createdAt)} · {r.location?.address}
                  </div>
                  <p className="ct-small">{r.description}</p>

                  <div className="mb-2">
                      {r.images?.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {r.images.map((img, i) => (
                            <a key={i} href={img.url} target="_blank" rel="noreferrer">
                              <img
                                src={img.url}
                                alt={img.caption || `Report photo ${i + 1}`}
                                style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid #d8dee6' }}
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <label className="ct-small ct-link-strong" style={{ cursor: 'pointer' }}>
                        {uploadingId === r._id ? 'Uploading…' : r.images?.length ? '+ Add another photo' : '+ Attach a photo'}
                        <input
                          ref={uploadingId === r._id ? fileRef : null}
                          type="file"
                          accept="image/*"
                          className="d-none"
                          disabled={uploadingId === r._id}
                          onChange={(e) => handleUpload(r._id, e.target.files?.[0])}
                        />
                    </label>
                  </div>

                  {r.linkedProject && (
                    <div className="ct-small mb-2">
                      🔗 Linked project: <Link to={`/projects/${r.linkedProject._id}`}>{r.linkedProject.title}</Link>
                    </div>
                  )}

                  {r.officialResponse && (
                    <div className="ct-callout ct-callout--info">
                      <div className="ct-callout__title">
                        Official response — {r.assignedDepartment?.name || 'Department'}
                      </div>
                      {r.officialResponse}
                      {r.resolutionNotes && <div className="ct-small mt-1">{r.resolutionNotes}</div>}
                    </div>
                  )}

                  {r.statusHistory?.length > 0 && (
                    <div className="ct-divider" />
                  )}
                  {r.statusHistory?.length > 0 && (
                    <div className="ct-timeline">
                      {r.statusHistory.map((h, i) => (
                        <div className="ct-timeline__item" key={i}>
                          <span className="ct-timeline__dot" aria-hidden="true" />
                          <div className="ct-timeline__meta">{formatDateTime(h.at)}</div>
                          <div className="ct-timeline__text">
                            {REPORT_STATUS[h.status]?.label || h.status}
                            {h.note && <span className="ct-muted"> — {h.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
