import { useState } from 'react';
import { useApiData, useApiMutation } from '../hooks/useApiData';
import { listUsers, updateUserRole, updateUser } from '../services/resource';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Card } from '../components/ui';
import { LoadingState, ErrorState, EmptyState, AlertBox } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { ROLES } from '../utils/constants';
import { formatDateTime, initials, getErrorMessage } from '../utils/format';

/** Administrator: manage users and roles. */
export default function AdminUsers() {
  const { user: me } = useAuth();
  const [message, setMessage] = useState(null);
  const { data, error, loading, reload } = useApiData(() => listUsers({}), []);
  const roleMutation = useApiMutation(({ id, payload }) => updateUserRole(id, payload));
  const activeMutation = useApiMutation(({ id, payload }) => updateUser(id, payload));

  const items = data?.items || [];

  const changeRole = async (id, role) => {
    setMessage(null);
    try {
      await roleMutation.run({ id, payload: { role } });
      setMessage({ tone: 'success', text: 'Role updated and written to the audit log.' });
      reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err, 'Could not change the role.') });
    }
  };

  const toggleActive = async (id, isActive) => {
    setMessage(null);
    try {
      await activeMutation.run({ id, payload: { isActive } });
      reload();
    } catch (err) {
      setMessage({ tone: 'danger', text: getErrorMessage(err) });
    }
  };

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Role changes are server-verified and recorded in the append-only audit log."
      />

      {message && <div className="mb-3"><AlertBox tone={message.tone} onClose={() => setMessage(null)}>{message.text}</AlertBox></div>}
      {loading && <LoadingState />}
      {error && <Card><ErrorState error={error} onRetry={reload} /></Card>}
      {!loading && !error && items.length === 0 && <Card><EmptyState title="No users" /></Card>}

      {!loading && !error && items.length > 0 && (
        <div className="ct-card">
          <div className="table-responsive">
            <table className="table ct-table mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="ct-avatar">{initials(u.name)}</span>
                        <div>
                          <div className="fw-semibold">{u.name}{u._id === me?._id && <span className="ct-badge ct-badge--teal ms-2">you</span>}</div>
                          <div className="ct-small ct-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 150 }}
                        value={u.role}
                        onChange={(e) => changeRole(u._id, e.target.value)}
                        disabled={roleMutation.pending}
                        aria-label={`Role for ${u.name}`}
                      >
                        {Object.entries(ROLES).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="ct-small">{u.department?.name || '—'}</td>
                    <td className="ct-small">{formatDateTime(u.createdAt)}</td>
                    <td>
                      <StatusBadge
                        status={u.isActive ? 'active' : 'cancelled'}
                        map={{ active: { label: 'Active', badge: 'completed' }, cancelled: { label: 'Deactivated', badge: 'cancelled' } }}
                      />
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-ct-outline btn-sm"
                        onClick={() => toggleActive(u._id, !u.isActive)}
                        disabled={u._id === me?._id || activeMutation.pending}
                        title={u._id === me?._id ? 'You cannot deactivate your own account' : undefined}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
