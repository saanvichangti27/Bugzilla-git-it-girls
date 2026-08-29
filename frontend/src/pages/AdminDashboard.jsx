import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Shield, Activity, CheckCircle, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ open_bugs: 0, resolved_this_week: 0 });
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, bugsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/bugs?sort=-created_at')
        ]);
        setStats(statsRes.data.data);
        setBugs(bugsRes.data.data.items);
      } catch (err) {
        console.error("Failed to load admin data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Shield color="var(--primary)" size={28} />
        <h1 className="text-gradient" style={{ margin: 0 }}>Admin Overview</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Global system view. You have read-only access to all bugs and activities.
      </p>
      
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading system data...</div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Total Open Bugs</div>
                  <div className="metric-value">{stats.open_bugs}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--danger)' }}>
                  <Activity size={24} />
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Total Bugs</div>
                  <div className="metric-value">{bugs.length}</div>
                </div>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--primary)' }}>
                  <Clock size={24} />
                </div>
              </div>
            </div>
            
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Resolved This Week</div>
                  <div className="metric-value">{stats.resolved_this_week}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--success)' }}>
                  <CheckCircle size={24} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
            <h3 style={{ margin: 0, marginBottom: '1rem' }}>Global Bug Log</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '0.75rem' }}>Title</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Severity</th>
                    <th style={{ padding: '0.75rem' }}>Assignee</th>
                    <th style={{ padding: '0.75rem' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bugs.map(bug => (
                    <tr key={bug.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>{bug.title}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`status-badge status-${bug.status}`}>
                          {bug.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{bug.severity}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                        {bug.assignee ? bug.assignee.name : 'Unassigned'}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {new Date(bug.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {bugs.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No bugs found in the system.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
