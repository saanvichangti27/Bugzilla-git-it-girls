import { useState, useEffect } from 'react';
import { api, bugService } from '../api/client';
import { Paperclip, Plus, UserPlus, UserCheck } from 'lucide-react';
import AddBugModal from '../components/AddBugModal';

export default function BugList() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://127.0.0.1:8000';

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bugs');
      setBugs(res.data.data.items || []);
    } catch (err) {
      console.error("Failed to fetch bugs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const handleToggleFollow = async (bugId, isFollowing) => {
    try {
      if (isFollowing) {
        await bugService.unfollowBug(bugId);
      } else {
        await bugService.followBug(bugId);
      }
      fetchBugs();
    } catch (err) {
      console.error("Failed to update follow status", err);
    }
  };

  return (
    <div>
      <AddBugModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onBugCreated={() => fetchBugs()}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.2rem' }}>Bug Explorer</h1>
          <p style={{ color: 'var(--text-muted)' }}>Browse, follow issues, and inspect attachments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={18} /> Report New Bug
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>TITLE & ATTACHMENTS</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>STATUS</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>PRIORITY</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>COMPONENT</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>ASSIGNEE</th>
              <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading bugs...</td>
              </tr>
            ) : bugs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No bugs found. System is clean!</td>
              </tr>
            ) : (
              bugs.map(bug => (
                <tr key={bug.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>
                    <div>{bug.title}</div>
                    {/* Render Attachments */}
                    {bug.attachments && bug.attachments.length > 0 && (
                      <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {bug.attachments.map(att => {
                          const url = att.file_url.startsWith('http') ? att.file_url : `${API_BASE}${att.file_url}`;
                          return (
                            <a
                              key={att.id}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: '0.2rem 0.5rem', background: 'rgba(99,102,241,0.15)',
                                border: '1px solid rgba(99,102,241,0.3)', borderRadius: '4px',
                                fontSize: '0.75rem', color: '#818cf8', display: 'inline-flex',
                                alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600
                              }}
                            >
                              <Paperclip size={12} /> {att.file_name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}><span className={`badge badge-${bug.status}`}>{bug.status.replace('_', ' ')}</span></td>
                  <td style={{ padding: '1rem' }}><span className={`badge badge-${bug.priority}`}>{bug.priority}</span></td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{bug.component}</td>
                  <td style={{ padding: '1rem' }}>{bug.assignee?.name || <span style={{color: 'var(--text-muted)'}}>Unassigned</span>}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(bug.id, bug.is_following)}
                      style={{
                        padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px',
                        fontWeight: 600, border: '1px solid', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        borderColor: bug.is_following ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                        background: bug.is_following ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: bug.is_following ? '#f87171' : '#818cf8',
                      }}
                    >
                      {bug.is_following ? <><UserCheck size={14} /> Stop following</> : <><UserPlus size={14} /> Follow bug</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
