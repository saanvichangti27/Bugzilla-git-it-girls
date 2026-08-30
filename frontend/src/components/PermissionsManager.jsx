import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Save, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';

const ROLES = ['reporter', 'tester', 'developer', 'admin'];
const FIELDS = ['title', 'description', 'status', 'assignee_id', 'priority', 'severity', 'component'];
const STATUSES = ['new', 'in_progress', 'ready_for_testing', 'resolved', 'closed'];

export default function PermissionsManager() {
  const [rolePermissions, setRolePermissions] = useState([]);
  const [statusTransitions, setStatusTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const [rpRes, stRes] = await Promise.all([
        api.get('/admin/role-permissions'),
        api.get('/admin/status-transitions')
      ]);
      setRolePermissions(rpRes.data.data);
      setStatusTransitions(stRes.data.data);
    } catch (err) {
      console.error("Failed to load permissions", err);
      setMessage({ type: 'error', text: 'Failed to load permissions' });
    } finally {
      setLoading(false);
    }
  };

  const handleRolePermissionChange = (role, field, checked) => {
    const updated = [...rolePermissions];
    const existingIdx = updated.findIndex(rp => rp.role === role && rp.field === field);
    if (existingIdx >= 0) {
      updated[existingIdx].editable = checked;
    } else {
      updated.push({ role, field, editable: checked });
    }
    setRolePermissions(updated);
  };

  const handleStatusTransitionChange = (role, from_status, to_status, checked) => {
    let updated = [...statusTransitions];
    if (checked) {
      // Add if not exists
      if (!updated.find(st => st.role === role && st.from_status === from_status && st.to_status === to_status)) {
        updated.push({ role, from_status, to_status });
      }
    } else {
      // Remove
      updated = updated.filter(st => !(st.role === role && st.from_status === from_status && st.to_status === to_status));
    }
    setStatusTransitions(updated);
  };

  const isPermissionChecked = (role, field) => {
    const perm = rolePermissions.find(rp => rp.role === role && rp.field === field);
    return perm ? perm.editable : false;
  };

  const isTransitionChecked = (role, from_status, to_status) => {
    return !!statusTransitions.find(st => st.role === role && st.from_status === from_status && st.to_status === to_status);
  };

  const saveChanges = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/role-permissions', rolePermissions);
      await api.put('/admin/status-transitions', statusTransitions);
      
      // Reload cache
      await api.post('/admin/permissions/reload');
      
      setMessage({ type: 'success', text: 'Permissions successfully updated and applied.' });
    } catch (err) {
      console.error("Failed to save permissions", err);
      setMessage({ type: 'error', text: 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading permissions data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${message.type === 'error' ? 'var(--danger)' : 'var(--success)'}`
        }}>
          {message.text}
        </div>
      )}

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Role Field Permissions</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Check the boxes to allow a role to edit a specific field. Note: Reporter and Tester roles have hardcoded relationship checks (e.g. own bugs only).
        </p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Role \ Field</th>
                {FIELDS.map(f => <th key={f} style={{ padding: '1rem', color: 'var(--text-muted)' }}>{f}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROLES.map(role => (
                <tr key={role} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>{role}</td>
                  {FIELDS.map(field => (
                    <td key={field} style={{ padding: '1rem' }}>
                      <input 
                        type="checkbox"
                        checked={isPermissionChecked(role, field)}
                        onChange={(e) => handleRolePermissionChange(role, field, e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Status Transitions</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Define which status transitions are allowed. A '*' wildcard in 'From' means any status. 
          If a role has NO rules here, they are unrestricted (can set any status they have field permission for).
        </p>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>From Status</th>
                <th style={{ padding: '1rem' }}>To Status</th>
                <th style={{ padding: '1rem', width: '100px' }}>Allowed</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(role => {
                // For simplicity in the UI, let's just show transition to all statuses from '*'
                return STATUSES.map(to_status => (
                  <tr key={`${role}-*-${to_status}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>{role}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>* (Any)</td>
                    <td style={{ padding: '1rem' }}>{to_status}</td>
                    <td style={{ padding: '1rem' }}>
                      <input 
                        type="checkbox"
                        checked={isTransitionChecked(role, '*', to_status)}
                        onChange={(e) => handleStatusTransitionChange(role, '*', to_status, e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <Button variant="secondary" onClick={fetchPermissions} disabled={saving}>
          <RefreshCw size={18} /> Discard Changes
        </Button>
        <Button onClick={saveChanges} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving...' : 'Save & Apply Changes'}
        </Button>
      </div>

    </div>
  );
}
