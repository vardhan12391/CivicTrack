import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApiData, useApiMutation } from '../hooks/useApiData';
import {
  getProject,
  createProject,
  updateProject,
  updateProjectStatus,
  updateProjectSchedule,
  createMilestone,
  createProjectUpdate,
  listDepartments,
} from '../services/resource';
import { PageHeader, Card, FormField } from '../components/ui';
import { LoadingState, ErrorState, AlertBox } from '../components/States';
import { PROJECT_STATUS, PROJECT_CATEGORIES, UPDATE_TYPES } from '../utils/constants';
import { getErrorMessage } from '../utils/format';

const emptyForm = {
  title: '',
  description: '',
  category: 'road',
  roadSegmentId: '',
  address: '',
  ward: '',
  lat: '',
  lng: '',
  departmentId: '',
  contractorName: '',
  budget: '',
  startDate: '',
  plannedEndDate: '',
  revisedEndDate: '',
  status: 'planned',
  delayExplanation: '',
};

/**
 * Official project form: create and edit.
 * Editing schedules requires a reason → the backend writes it to the audit log.
 */
export default function ProjectForm() {
  const { id } = useParams(); // present when editing
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useApiData(() => getProject(id), [id], { immediate: isEdit });
  const departments = useApiData(listDepartments, []);

  const mutation = useApiMutation(isEdit ? (payload) => updateProject(id, payload) : createProject);
  const statusMutation = useApiMutation((payload) => updateProjectStatus(id, payload));
  const scheduleMutation = useApiMutation((payload) => updateProjectSchedule(id, payload));
  const milestoneMutation = useApiMutation((payload) => createMilestone(id, payload));
  const updateMutation = useApiMutation((payload) => createProjectUpdate(id, payload));

  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'planned', explanation: '' });
  const [scheduleForm, setScheduleForm] = useState({ revisedEndDate: '', reason: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', dueDate: '' });
  const [updateForm, setUpdateForm] = useState({ updateType: 'progress', message: '' });

  const project = existing.data?.project || existing.data;

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title || '',
        description: project.description || '',
        category: project.category || 'road',
        roadSegmentId: project.roadSegmentId || '',
        address: project.location?.address || '',
        ward: project.location?.ward || '',
        lat: project.location?.point?.coordinates?.[1] ?? '',
        lng: project.location?.point?.coordinates?.[0] ?? '',
        departmentId: project.department?._id || project.department || '',
        contractorName: project.contractorName || '',
        budget: project.budget ?? '',
        startDate: (project.startDate || '').slice(0, 10),
        plannedEndDate: (project.plannedEndDate || '').slice(0, 10),
        revisedEndDate: (project.revisedEndDate || '').slice(0, 10),
        status: project.status || 'planned',
        delayExplanation: project.delayExplanation || '',
      });
      setStatusForm({ status: project.status || 'planned', explanation: project.delayExplanation || '' });
      setScheduleForm({ revisedEndDate: (project.revisedEndDate || '').slice(0, 10), reason: '' });
    }
  }, [project?._id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validateMain = () => {
    if (form.title.trim().length < 5) return 'Title must be at least 5 characters.';
    if (form.description.trim().length < 20) return 'Description must be at least 20 characters.';
    if (!form.roadSegmentId.trim()) return 'Road segment ID is required (RoadSync keys on it).';
    if (!form.departmentId) return 'Select the responsible department.';
    if (!form.startDate || !form.plannedEndDate) return 'Start and planned end dates are required.';
    if (form.plannedEndDate < form.startDate) return 'Planned end date cannot be before the start date.';
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const problem = validateMain();
    if (problem) {
      setMessage({ tone: 'warning', text: problem });
      return;
    }
    setMessage(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      roadSegmentId: form.roadSegmentId.trim(),
      location: {
        address: form.address.trim(),
        ward: form.ward.trim(),
        point:
          form.lat !== '' && form.lng !== ''
            ? { type: 'Point', coordinates: [Number(form.lng), Number(form.lat)] }
            : undefined,
      },
      departmentId: form.departmentId,
      contractorName: form.contractorName.trim(),
      budget: form.budget === '' ? undefined : Number(form.budget),
      startDate: form.startDate,
      plannedEndDate: form.plannedEndDate,
      revisedEndDate: form.revisedEndDate || undefined,
      delayExplanation: form.delayExplanation.trim() || undefined,
    };
    try {
      const result = await mutation.run(payload);
      const newId = result?.project?._id || result?._id || id;
      setMessage({ tone: 'success', text: isEdit ? 'Project updated. RoadSync re-checked for conflicts.' : 'Project created.' });
      if (!isEdit) navigate(`/official/projects/${newId}/edit`);
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not save the project.') });
    }
  };

  const handleStatus = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await statusMutation.run(statusForm);
      setMessage({ tone: 'success', text: 'Status updated and recorded in the audit history.' });
      existing.reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not update status.') });
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      await scheduleMutation.run(scheduleForm);
      setMessage({ tone: 'success', text: 'Schedule revised. The original deadline is preserved in the audit history, and RoadSync re-checked conflicts.' });
      existing.reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not revise the schedule.') });
    }
  };

  const handleMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.title.trim() || !milestoneForm.dueDate) return;
    try {
      await milestoneMutation.run(milestoneForm);
      setMilestoneForm({ title: '', dueDate: '' });
      existing.reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not add milestone.') });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateForm.message.trim()) return;
    try {
      await updateMutation.run({ ...updateForm, message: updateForm.message.trim() });
      setUpdateForm({ updateType: 'progress', message: '' });
      existing.reload();
      setMessage({ tone: 'success', text: 'Progress update published.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not publish update.') });
    }
  };

  if (isEdit && existing.loading) return <div className="ct-container ct-page"><LoadingState /></div>;
  if (isEdit && existing.error)
    return (
      <div className="ct-container ct-page">
        <Card><ErrorState error={existing.error} onRetry={existing.reload} /></Card>
      </div>
    );

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Official workspace"
        title={isEdit ? `Edit: ${project?.title || ''}` : 'Create a project'}
        description={
          isEdit
            ? 'Update details, revise the schedule (reason required), publish progress, and manage milestones.'
            : 'New projects become public immediately and are checked by RoadSync for schedule conflicts.'
        }
      />

      {message && (
        <div className="mb-3">
          <AlertBox tone={message.tone} onClose={() => setMessage(null)}>{message.text}</AlertBox>
        </div>
      )}

      <div className="row g-4 pb-4">
        <div className="col-lg-7">
          <Card title="Project details" className="mb-4">
            <form onSubmit={handleSave} noValidate>
              <FormField label="Title" htmlFor="f-title" required>
                <input id="f-title" name="title" className="form-control" value={form.title} onChange={handleChange} maxLength={160} />
              </FormField>
              <FormField label="Description" htmlFor="f-desc" required hint="Purpose, scope, and impact on residents (min 20 chars).">
                <textarea id="f-desc" name="description" className="form-control" rows={4} value={form.description} onChange={handleChange} />
              </FormField>
              <div className="row g-0">
                <div className="col-md-4 pe-md-2">
                  <FormField label="Category" htmlFor="f-cat">
                    <select id="f-cat" name="category" className="form-select" value={form.category} onChange={handleChange}>
                      {Object.entries(PROJECT_CATEGORIES).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-4 px-md-2">
                  <FormField label="Road segment ID" htmlFor="f-seg" required hint="e.g. MAIN-ROAD-01">
                    <input id="f-seg" name="roadSegmentId" className="form-control" value={form.roadSegmentId} onChange={handleChange} maxLength={60} />
                  </FormField>
                </div>
                <div className="col-md-4 ps-md-2">
                  <FormField label="Department" htmlFor="f-dept" required>
                    <select id="f-dept" name="departmentId" className="form-select" value={form.departmentId} onChange={handleChange}>
                      <option value="">Select…</option>
                      {(departments.data?.items || departments.data || []).map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>
              <FormField label="Location / address" htmlFor="f-addr">
                <input id="f-addr" name="address" className="form-control" value={form.address} onChange={handleChange} maxLength={200} />
              </FormField>
              <div className="row g-0">
                <div className="col-md-3 pe-md-2">
                  <FormField label="Ward" htmlFor="f-ward">
                    <input id="f-ward" name="ward" className="form-control" value={form.ward} onChange={handleChange} maxLength={40} />
                  </FormField>
                </div>
                <div className="col-md-3 px-md-2">
                  <FormField label="Latitude" htmlFor="f-lat" hint="e.g. 19.0760">
                    <input id="f-lat" name="lat" className="form-control" value={form.lat} onChange={handleChange} inputMode="decimal" />
                  </FormField>
                </div>
                <div className="col-md-3 px-md-2">
                  <FormField label="Longitude" htmlFor="f-lng" hint="e.g. 72.8777">
                    <input id="f-lng" name="lng" className="form-control" value={form.lng} onChange={handleChange} inputMode="decimal" />
                  </FormField>
                </div>
                <div className="col-md-3 ps-md-2">
                  <FormField label="Contractor" htmlFor="f-contractor">
                    <input id="f-contractor" name="contractorName" className="form-control" value={form.contractorName} onChange={handleChange} maxLength={120} />
                  </FormField>
                </div>
              </div>
              <FormField label="Budget (₹)" htmlFor="f-budget">
                <input id="f-budget" name="budget" className="form-control" value={form.budget} onChange={handleChange} inputMode="numeric" />
              </FormField>
              <div className="row g-0">
                <div className="col-md-4 pe-md-2">
                  <FormField label="Start date" htmlFor="f-start" required>
                    <input id="f-start" name="startDate" type="date" className="form-control" value={form.startDate} onChange={handleChange} />
                  </FormField>
                </div>
                <div className="col-md-4 px-md-2">
                  <FormField label="Planned end date" htmlFor="f-end" required hint="Original public deadline.">
                    <input id="f-end" name="plannedEndDate" type="date" className="form-control" value={form.plannedEndDate} onChange={handleChange} />
                  </FormField>
                </div>
                <div className="col-md-4 ps-md-2">
                  <FormField label="Revised end date" htmlFor="f-rev" hint="Only with a reason (see below).">
                    <input id="f-rev" name="revisedEndDate" type="date" className="form-control" value={form.revisedEndDate} onChange={handleChange} />
                  </FormField>
                </div>
              </div>
              <FormField label="Delay explanation" htmlFor="f-delay" hint="Required when the project is delayed or a revised date is set.">
                <textarea id="f-delay" name="delayExplanation" className="form-control" rows={2} value={form.delayExplanation} onChange={handleChange} />
              </FormField>
              <button type="submit" className="btn btn-ct-accent" disabled={mutation.pending}>
                {mutation.pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
              </button>
              {isEdit && (
                <Link to={`/projects/${id}`} className="btn btn-ct-outline ms-2">View public page</Link>
              )}
            </form>
          </Card>
        </div>

        <div className="col-lg-5">
          {isEdit && (
            <>
              <Card title="Change status" className="mb-4">
                <form onSubmit={handleStatus}>
                  <FormField label="Status" htmlFor="s-status">
                    <select
                      id="s-status"
                      className="form-select"
                      value={statusForm.status}
                      onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    >
                      {Object.entries(PROJECT_STATUS).map(([v, m]) => (
                        <option key={v} value={v}>{m.label}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Explanation" htmlFor="s-exp" hint="Required for 'Delayed'. Published publicly.">
                    <textarea
                      id="s-exp"
                      className="form-control"
                      rows={2}
                      value={statusForm.explanation}
                      onChange={(e) => setStatusForm({ ...statusForm, explanation: e.target.value })}
                    />
                  </FormField>
                  <button type="submit" className="btn btn-ct-outline btn-sm" disabled={statusMutation.pending}>
                    Update status
                  </button>
                </form>
              </Card>

              <Card title="Revise schedule" className="mb-4">
                <form onSubmit={handleSchedule}>
                  <FormField label="Revised end date" htmlFor="sc-date" required>
                    <input
                      id="sc-date"
                      type="date"
                      className="form-control"
                      value={scheduleForm.revisedEndDate}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, revisedEndDate: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Reason for revision" htmlFor="sc-reason" required hint="Stored in the audit history — the original deadline is never overwritten.">
                    <textarea
                      id="sc-reason"
                      className="form-control"
                      rows={2}
                      value={scheduleForm.reason}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                    />
                  </FormField>
                  <button type="submit" className="btn btn-ct-outline btn-sm" disabled={scheduleMutation.pending}>
                    Apply revision
                  </button>
                </form>
              </Card>

              <Card title="Add milestone" className="mb-4">
                <form onSubmit={handleMilestone}>
                  <FormField label="Milestone" htmlFor="m-title" required>
                    <input
                      id="m-title"
                      className="form-control"
                      value={milestoneForm.title}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                      maxLength={140}
                    />
                  </FormField>
                  <FormField label="Due date" htmlFor="m-date" required>
                    <input
                      id="m-date"
                      type="date"
                      className="form-control"
                      value={milestoneForm.dueDate}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
                    />
                  </FormField>
                  <button type="submit" className="btn btn-ct-outline btn-sm" disabled={milestoneMutation.pending}>
                    Add milestone
                  </button>
                </form>
              </Card>

              <Card title="Publish progress update">
                <form onSubmit={handleUpdate}>
                  <FormField label="Type" htmlFor="u-type">
                    <select
                      id="u-type"
                      className="form-select"
                      value={updateForm.updateType}
                      onChange={(e) => setUpdateForm({ ...updateForm, updateType: e.target.value })}
                    >
                      {Object.entries(UPDATE_TYPES).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Message" htmlFor="u-msg" required hint="Visible to the public on the project page.">
                    <textarea
                      id="u-msg"
                      className="form-control"
                      rows={3}
                      value={updateForm.message}
                      onChange={(e) => setUpdateForm({ ...updateForm, message: e.target.value })}
                    />
                  </FormField>
                  <button type="submit" className="btn btn-ct-accent btn-sm" disabled={updateMutation.pending}>
                    Publish update
                  </button>
                </form>
              </Card>
            </>
          )}
          {!isEdit && (
            <Card title="After creating">
              <p className="ct-small mb-0">
                You can add milestones, revise the schedule with a reason, and publish progress
                updates from the edit page. RoadSync runs automatically on creation and whenever
                dates change.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
