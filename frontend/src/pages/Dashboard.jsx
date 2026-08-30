import { useState, useEffect, useMemo } from 'react';
import { api, authService } from '../api/client';
import { PlusCircle, CheckCheck, Layers, FlaskConical } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import TesterDashboard from './TesterDashboard';

// Hardcoded component list — no dedicated components-management endpoint yet
const COMPONENTS = ["frontend", "backend", "database", "others"];

export default function Dashboard() {
  const [stats, setStats] = useState({ open_bugs: 0, assigned_to_me: 0, resolved_this_week: 0 });
  const [loading, setLoading] = useState(true);
  const [userBugs, setUserBugs] = useState([]);         // reporter: bugs they reported
  const [openBugs, setOpenBugs] = useState([]);          // developer: active bugs (new + in_progress + ready_for_testing)
  const [selectedComponent, setSelectedComponent] = useState(null); // null = "All"
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

  const [githubSettings, setGithubSettings] = useState({
    github_token: user?.github_token || '',
    github_username: user?.github_username || '',
    github_repo: user?.github_repo || ''
  });
  const [githubStatus, setGithubStatus] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [savingDiscord, setSavingDiscord] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const summaryRes = await api.get('/dashboard/summary');
      setStats(summaryRes.data.data);

      if (role === 'reporter') {
        const bugsRes = await api.get(`/bugs?reporter_id=${user.id}`);
        setUserBugs(bugsRes.data.data.items);
      } else if (role === 'developer') {
        // Fetch new, in_progress, and ready_for_testing bugs
        const [newRes, inProgressRes, readyRes] = await Promise.all([
          api.get('/bugs?status=new'),
          api.get('/bugs?status=in_progress'),
          api.get('/bugs?status=ready_for_testing'),
        ]);
        const combined = [
          ...(newRes.data.data.items || []),
          ...(inProgressRes.data.data.items || []),
          ...(readyRes.data.data.items || []),
        ];
        setOpenBugs(combined);
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

  // ---------------------------------------------------------------------------
  // Client-side component filter (no server refetch on change)
  // ---------------------------------------------------------------------------
  const displayedBugs = useMemo(() => {
    if (!selectedComponent) return openBugs;
    return openBugs.filter(b => b.component === selectedComponent);
  }, [openBugs, selectedComponent]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
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

  // Sends PATCH /bugs/{id} with status: 'ready_for_testing'.
  // Updates bug status to 'ready_for_testing' optimistically; reverts on API failure.
  const handleMarkResolved = async (bugId) => {
    setOpenBugs(prev => prev.map(b => b.id === bugId ? { ...b, status: 'ready_for_testing' } : b));
    try {
      await api.patch(`/bugs/${bugId}`, { status: 'ready_for_testing' });
      // Update top summary cards
      const summaryRes = await api.get('/dashboard/summary');
      if (summaryRes?.data?.data) {
        setStats(summaryRes.data.data);
      }
    } catch (err) {
      console.error("Failed to mark bug as resolved", err);
      const msg = err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to mark bug as resolved";
      alert(msg);
      fetchDashboardData(); // revert optimistic update
    }
  };

  const handleSaveGithubSettings = async (e) => {
    e.preventDefault();
    setGithubStatus('Saving and configuring webhooks...');
    try {
      await authService.updateGithubSettings(
        githubSettings.github_token,
        githubSettings.github_username,
        githubSettings.github_repo
      );
      setGithubStatus('Settings saved! Webhooks configured successfully on your repo.');
    } catch (err) {
      setGithubStatus('Failed to save settings. Please check your token and repo.');
      console.error(err);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderCreateForm = () => (
    <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Report New Bug</h3>
      <form onSubmit={handleCreateBug} style={{ display: 'grid', gap: '1rem' }}>
        <input className="input-field" placeholder="Bug Title" value={newBug.title} onChange={e => setNewBug({ ...newBug, title: e.target.value })} required />
        <textarea className="input-field" placeholder="Description" rows={3} value={newBug.description} onChange={e => setNewBug({ ...newBug, description: e.target.value })} required />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="input-field" value={newBug.priority} onChange={e => setNewBug({ ...newBug, priority: e.target.value })} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
          <select className="input-field" value={newBug.severity} onChange={e => setNewBug({ ...newBug, severity: e.target.value })} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
            <option value="trivial">Trivial</option><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option><option value="blocker">Blocker</option>
          </select>
          <select className="input-field" value={newBug.component} onChange={e => setNewBug({ ...newBug, component: e.target.value })} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
            {COMPONENTS.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary">Submit Bug</button>
          <button type="button" className="btn btn-outline" onClick={() => setShowCreateForm(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );

  const pillStyle = (active) => ({
    padding: '0.3rem 0.9rem',
    borderRadius: '9999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
    color: active ? '#818cf8' : 'var(--text-muted)',
  });

  const renderComponentFilter = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <Layers size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <button style={pillStyle(selectedComponent === null)} onClick={() => setSelectedComponent(null)}>
        All
      </button>
      {COMPONENTS.map(comp => (
        <button
          key={comp}
          style={pillStyle(selectedComponent === comp)}
          onClick={() => setSelectedComponent(selectedComponent === comp ? null : comp)}
        >
          {comp.charAt(0).toUpperCase() + comp.slice(1)}
        </button>
      ))}
    </div>
  );

  const renderDeveloperBugList = () => (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>TITLE</th>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>COMPONENT</th>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {displayedBugs.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active bugs{selectedComponent ? ` in "${selectedComponent}"` : ''}.
              </td>
            </tr>
          ) : (
            displayedBugs.map(bug => (
              <tr
                key={bug.id}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '1rem', fontWeight: 500 }}>
                  {bug.title}
                  {bug.github_issue_url && (
                    <a href={bug.github_issue_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none' }}>
                      (View on GitHub)
                    </a>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', color: 'var(--text-muted)', textTransform: 'capitalize',
                  }}>
                    {bug.component || '--'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span className={`badge badge-${bug.status}`}>
                    {bug.status === 'ready_for_testing' ? 'being tested' : bug.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {bug.status === 'ready_for_testing' ? (
                    <span
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(6,182,212,0.12)',
                        color: '#22d3ee',
                        border: '1px solid rgba(6,182,212,0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 500,
                      }}
                    >
                      <FlaskConical size={14} /> Being Tested
                    </span>
                  ) : (
                    <button
                      className="btn"
                      style={{
                        padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex',
                        alignItems: 'center', gap: '0.4rem', background: 'rgba(16,185,129,0.12)',
                        color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)',
                      }}
                      onClick={() => handleMarkResolved(bug.id)}
                    >
                      <CheckCheck size={14} /> Mark as Resolved
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReporterBugList = () => (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>TITLE</th>
            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {userBugs.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No bugs found.</td>
            </tr>
          ) : (
            userBugs.map(bug => (
              <tr key={bug.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>
                  {bug.title}
                  {bug.github_issue_url && (
                    <a href={bug.github_issue_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none' }}>
                      (View on GitHub)
                    </a>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span className={`badge badge-${bug.status}`}>{bug.status.replace(/_/g, ' ')}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGithubSettings = () => (
    <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Layers size={20} style={{ color: 'var(--primary)' }} />
        GitHub Integration Settings
      </h3>
      
      <div style={{ background: 'rgba(99,102,241,0.1)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', border: '1px solid rgba(99,102,241,0.2)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <strong>Transparency Notice:</strong> By default, this platform automatically syncs all reported bugs to a global demo repository using a system token. 
          If you want to test the integration with your <em>own</em> repository, enter your details below. When you click Save, we will automatically set up a webhook on your repo so that merging Pull Requests will auto-close bugs here!
        </p>
      </div>

      <form onSubmit={handleSaveGithubSettings} style={{ display: 'grid', gap: '1rem' }}>
        <input className="input-field" placeholder="GitHub Username (e.g. octocat)" value={githubSettings.github_username} onChange={e => setGithubSettings({...githubSettings, github_username: e.target.value})} />
        <input className="input-field" type="password" placeholder="GitHub Personal Access Token (repo scope required)" value={githubSettings.github_token} onChange={e => setGithubSettings({...githubSettings, github_token: e.target.value})} />
        <input className="input-field" placeholder="Target Repository (e.g. octocat/Hello-World)" value={githubSettings.github_repo} onChange={e => setGithubSettings({...githubSettings, github_repo: e.target.value})} />
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary">Save & Configure Webhooks</button>
          {githubStatus && <span style={{ fontSize: '0.85rem', color: githubStatus.includes('Failed') ? '#ef4444' : '#10b981' }}>{githubStatus}</span>}
        </div>
      </form>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Role routing — admin and tester are separate components, untouched
  // ---------------------------------------------------------------------------
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'tester') return <TesterDashboard />;

  const handleSaveDiscord = async () => {
    setSavingDiscord(true);
    try {
      await api.patch('/users/me', { discord_username: discordUsername });
      alert('Discord username linked successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save Discord username.');
    } finally {
      setSavingDiscord(false);
    }
  };

  const renderDiscordIntegration = () => (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#5865F2' }}>Discord</span> Integration
        </h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Join the server and link your username to get pinged on critical bugs!
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input-field"
          placeholder="Username (e.g. siri#1234)"
          value={discordUsername}
          onChange={e => setDiscordUsername(e.target.value)}
          style={{ width: '220px', marginBottom: 0 }}
        />
        <button className="btn btn-primary" onClick={handleSaveDiscord} disabled={savingDiscord}>
          {savingDiscord ? 'Saving...' : 'Link Username'}
        </button>
        <a href="https://discord.gg/C5mfpcTnpV" target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#5865F2', color: '#5865F2' }}>
          Join Server
        </a>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient">Dashboard Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Role: <strong style={{ textTransform: 'capitalize' }}>{role}</strong></p>
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
          {renderDiscordIntegration()}
          {showCreateForm && renderCreateForm()}

          {role === 'reporter' ? (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Bugs I've Reported</h3>
              {renderReporterBugList()}
            </>
          ) : role === 'developer' ? (
            <>
              {/* ── Metric cards ── */}
              <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="glass-card">
                  <div className="metric-title">
                    Active Bugs {selectedComponent
                      ? `(${selectedComponent})`
                      : ''}
                  </div>
                  <div className="metric-value">
                    {displayedBugs.filter(b => b.status === 'new' || b.status === 'in_progress').length}
                  </div>
                </div>
                <div className="glass-card">
                  <div className="metric-title">Being Tested</div>
                  <div className="metric-value" style={{ color: '#22d3ee' }}>
                    {displayedBugs.filter(b => b.status === 'ready_for_testing').length}
                  </div>
                </div>
                <div className="glass-card">
                  <div className="metric-title">Resolved This Week</div>
                  <div className="metric-value">{stats.resolved_this_week}</div>
                </div>
              </div>

              {/* ── Bug list with component filter ── */}
              <h3 style={{ marginBottom: '0.75rem' }}>Active Bugs & Testing Queue</h3>
              {renderComponentFilter()}
              {renderDeveloperBugList()}
            </>
          ) : (
            <p>Welcome, {role}. (Dashboard under construction)</p>
          )}

          {/* Both developers and reporters can set up github settings */}
          {renderGithubSettings()}
        </>
      )}
    </div>
  );
}
