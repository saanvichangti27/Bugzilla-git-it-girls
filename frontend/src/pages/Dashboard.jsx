import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Activity, BugIcon, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ open_bugs: 0, assigned_to_me: 0, resolved_this_week: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        setStats(res.data.data);
      } catch (err) {
        console.error("Failed to load dashboard summary", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div>
      <h1 className="text-gradient">Dashboard Overview</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Welcome back! Here is what is happening right now.</p>
      
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading metrics...</div>
      ) : (
        <div className="dashboard-grid">
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="metric-title">Open Bugs</div>
                <div className="metric-value">{stats.open_bugs}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--danger)' }}>
                <Activity size={24} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Total active issues globally</p>
          </div>
          
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="metric-title">Assigned to Me</div>
                <div className="metric-value">{stats.assigned_to_me}</div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--primary)' }}>
                <BugIcon size={24} />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Bugs requiring your attention</p>
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
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Great job closing these out!</p>
          </div>
        </div>
      )}
      
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <h3 style={{ margin: 0 }}>Recent Activity Placeholder</h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          This section will contain the Notification Center in Phase 2.
        </p>
      </div>
    </div>
  );
}
