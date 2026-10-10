import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiMutation, useApiData } from '../hooks/useApiData';
import { createReport, listProjects } from '../services/resource';
import { PageHeader, Card, FormField } from '../components/ui';
import { AlertBox } from '../components/States';
import { REPORT_CATEGORIES } from '../utils/constants';
import { getErrorMessage } from '../utils/format';

export default function ReportSubmit() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const mutation = useApiMutation(createReport);
  const [message, setMessage] = useState(null);
  const [image, setImage] = useState(null);

  const projects = useApiData(
    () => listProjects({ limit: 100, status: 'active' }),
    [],
    { immediate: isAuthenticated }
  );

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'damaged_road',
    address: '',
    ward: '',
    roadSegmentId: '',
    projectId: '',
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (form.title.trim().length < 5) return 'Give the report a short descriptive title (min 5 characters).';
    if (form.description.trim().length < 15) return 'Describe the issue in at least 15 characters.';
    if (!form.address.trim()) return 'Tell us where the problem is (address or landmark).';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setMessage({ tone: 'warning', text: problem });
      return;
    }
    setMessage(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        address: form.address.trim(),
        ward: form.ward.trim(),
        roadSegmentId: form.roadSegmentId.trim(),
        projectId: form.projectId || undefined,
      };
      const result = await mutation.run(payload);
      const reportId = result?.report?._id || result?._id;
      navigate('/reports/mine', { state: { justSubmitted: reportId } });
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not submit the report.') });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="ct-container ct-page ct-container--narrow">
        <PageHeader eyebrow="Citizen reporting" title="Report an infrastructure issue" />
        <Card>
          <p>
            Reports are tied to your account so you can track the official response. Please sign in
            or create a free citizen account first.
          </p>
          <div className="d-flex gap-2">
            <Link to="/login" className="btn btn-ct-primary">Sign in</Link>
            <Link to="/register" className="btn btn-ct-outline">Create account</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="ct-container ct-page ct-container--narrow">
      <PageHeader
        eyebrow="Citizen reporting"
        title="Report an infrastructure issue"
        description="Damaged roads, stalled construction, unsafe sites, drainage problems — your report goes to the responsible department and you can track every status change."
      />

      {message && (
        <div className="mb-3">
          <AlertBox tone={message.tone} onClose={() => setMessage(null)}>{message.text}</AlertBox>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Title" htmlFor="title" required hint="e.g. Open excavation left unfilled outside sector 14 market">
            <input id="title" name="title" className="form-control" value={form.title} onChange={handleChange} maxLength={140} />
          </FormField>

          <FormField label="Category" htmlFor="category" required>
            <select id="category" name="category" className="form-select" value={form.category} onChange={handleChange}>
              {Object.entries(REPORT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Description" htmlFor="description" required hint="What happened, when you noticed it, and any safety risk.">
            <textarea id="description" name="description" className="form-control" rows={5} value={form.description} onChange={handleChange} maxLength={2000} />
          </FormField>

          <div className="row g-0">
            <div className="col-md-8 pe-md-2">
              <FormField label="Location / landmark" htmlFor="address" required>
                <input id="address" name="address" className="form-control" value={form.address} onChange={handleChange} maxLength={200} />
              </FormField>
            </div>
            <div className="col-md-4 ps-md-2">
              <FormField label="Ward (optional)" htmlFor="ward">
                <input id="ward" name="ward" className="form-control" value={form.ward} onChange={handleChange} maxLength={40} />
              </FormField>
            </div>
          </div>

          <FormField label="Road segment ID (if you know it)" htmlFor="roadSegmentId" hint="Usually printed on project signboards, e.g. MAIN-ROAD-01.">
            <input id="roadSegmentId" name="roadSegmentId" className="form-control" value={form.roadSegmentId} onChange={handleChange} maxLength={60} />
          </FormField>

          <FormField label="Related project (optional)" htmlFor="projectId" hint="If the issue is at an active construction site, link it so the department sees it in context.">
            <select id="projectId" name="projectId" className="form-select" value={form.projectId} onChange={handleChange}>
              <option value="">No specific project</option>
              {(projects.data?.items || []).map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Photograph (optional)" htmlFor="image" hint="Images help departments assess the issue. Attach one after submitting, from the report page.">
            <input
              id="image"
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
            />
          </FormField>

          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn btn-ct-accent px-4" disabled={mutation.pending}>
              {mutation.pending ? 'Submitting…' : 'Submit report'}
            </button>
            <Link to="/reports/mine" className="btn btn-ct-outline">My reports</Link>
          </div>
          {image && (
            <div className="form-text mt-2">
              “{image.name}” will be uploaded with the report {image.size > 5 * 1024 * 1024 ? '(large file — may take a moment)' : ''}.
            </div>
          )}
        </form>
      </Card>

      <div className="ct-callout mt-4">
        <div className="ct-callout__title">Your privacy</div>
        Your name and contact details are visible only to officials handling your report. Public
        report listings never expose citizen identity.
      </div>
    </div>
  );
}
