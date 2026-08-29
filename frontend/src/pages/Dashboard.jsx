import { useState, useEffect } from 'react';
import { api, authService } from '../api/client';
import { Activity, BugIcon, CheckCircle, PlusCircle, ArrowRight } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import TesterDashboard from './TesterDashboard';

export default function Dashboard() {
  const [stats, setStats] = useState({ open_bugs: 0, assigned_to_me: 0, resolved_this_week: 0 });
  const [loading, setLoading] = useState(true);
  const [userBugs, setUserBugs] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const user = authService.getCurrentUser();
  const role = user?.role || 'reporter';

  const [newBug, setNewBug] = useState({
    title: '',
    description: '',
    priority: 'medium',
    severity: 'minor',
    component: 'frontend',
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const summaryRes = await api.get('/dashboard/summary');
      setStats(summaryRes.data.data);

      if (role === 'reporter') {
        const bugsRes = await api.get(`/bugs?reporter_id=${user.id}`);
        setUserBugs(bugsRes.data.data.items);
      } else if (role === 'developer') {
        const bugsRes = await api.get(`/bugs?assignee_id=${user.id}`);
        setUserBugs(bugsRes.data.data.items);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role, user?.id]);

  const handleCreateBug = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bugs', newBug);
      setShowCreateForm(false);
      setNewBug({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'frontend' });
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to create bug", err);
    }
  };

  const handleStatusChange = async (bugId, newStatus) => {
    try {
      await api.patch(`/bugs/${bugId}`, { status: newStatus });
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const renderCreateForm = () => (
    <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Report New Bug</h3>
      <form onSubmit={handleCreateBug} style={{ display: 'grid', gap: '1rem' }}>
        <input className="input-field" placeholder="Bug Title" value={newBug.title} onChange={e => setNewBug({...newBug, title: e.target.value})} required />
        <textarea className="input-field" placeholder="Description" rows={3} value={newBug.description} onChange={e => setNewBug({...newBug, description: e.target.value})} required />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="input-field" value={newBug.priority} onChange={e => setNewBug({...newBug, priority: e.target.value})} style={{ background: 'var(--bg-card)', color: 'var(--text)' }}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
          <select className="input-field" value={newBug.severity} onChange={e => setNewBug({...newBug, severity: e.target.value})} style={{ background: 'var(--bg-card)', color: 'var(--text)' }}>
            <option value="trivial">Trivial</option><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option><option value="blocker">Blocker</option>
          </select>
          <input className="input-field" placeholder="Component (e.g. frontend)" value={newBug.component} onChange={e => setNewBug({...newBug, component: e.target.value})} required />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary">Submit Bug</button>
          <button type="button" className="btn" onClick={() => setShowCreateForm(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );

  const renderBugList = () => (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>TITLE</th>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
            {role === 'developer' && <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {userBugs.length === 0 ? (
            <tr><td colSpan={role === 'developer' ? 3 : 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No bugs found.</td></tr>
          ) : (
            userBugs.map(bug => (
              <tr key={bug.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{bug.title}</td>
                <td style={{ padding: '1rem' }}><span className={`badge badge-${bug.status}`}>{bug.status.replace(/_/g, ' ')}</span></td>
                {role === 'developer' && (
                  <td style={{ padding: '1rem' }}>
                    {bug.status !== 'ready_for_testing' && bug.status !== 'resolved' && bug.status !== 'closed' && (
                       <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => handleStatusChange(bug.id, 'ready_for_testing')}>
                         <ArrowRight size={14} /> Send to Tester
                       </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'tester') return <TesterDashboard />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient">Dashboard Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Role: <strong style={{textTransform: 'capitalize'}}>{role}</strong></p>
        </div>
        {!showCreateForm && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={18} /> Report New Bug
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {showCreateForm && renderCreateForm()}

          {role === 'reporter' ? (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Bugs I've Reported</h3>
              {renderBugList()}
            </>
          ) : role === 'developer' ? (
            <>
              <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="glass-card">
                  <div className="metric-title">Assigned to Me</div>
                  <div className="metric-value">{stats.assigned_to_me}</div>
                </div>
                <div className="glass-card">
                  <div className="metric-title">Resolved This Week</div>
                  <div className="metric-value">{stats.resolved_this_week}</div>
                </div>
              </div>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>My Assigned Bugs</h3>
              {renderBugList()}
            </>
          ) : (
            <p>Welcome, {role}. (Dashboard under construction)</p>
          )}
        </>
      )}
    </div>
  );
}
