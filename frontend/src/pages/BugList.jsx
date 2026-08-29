import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function BugList() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBugs = async () => {
      try {
        const res = await api.get('/bugs');
        setBugs(res.data.data.items);
      } catch (err) {
        console.error("Failed to fetch bugs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBugs();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.2rem' }}>Bug Explorer</h1>
          <p style={{ color: 'var(--text-muted)' }}>Browse and filter all system issues.</p>
        </div>
        <button className="btn btn-primary">Report New Bug</button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>TITLE</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>PRIORITY</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>COMPONENT</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>ASSIGNEE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading bugs...</td>
              </tr>
            ) : bugs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No bugs found. System is clean!</td>
              </tr>
            ) : (
              bugs.map(bug => (
                <tr key={bug.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{bug.title}</td>
                  <td style={{ padding: '1rem' }}><span className={`badge badge-${bug.status}`}>{bug.status.replace('_', ' ')}</span></td>
                  <td style={{ padding: '1rem' }}><span className={`badge badge-${bug.priority}`}>{bug.priority}</span></td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{bug.component}</td>
                  <td style={{ padding: '1rem' }}>{bug.assignee?.name || <span style={{color: 'var(--text-muted)'}}>Unassigned</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
