import { useState, useEffect, useMemo } from 'react';
import { api, authService, aiService } from '../api/client';
import { PlusCircle, CheckCheck, Layers, FlaskConical, Sparkles, Loader2, AlertTriangle, Paperclip, Users } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import TesterDashboard from './TesterDashboard';
import AddBugModal from '../components/AddBugModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../contexts/ToastContext';

// Hardcoded component list — no dedicated components-management endpoint yet
const COMPONENTS = ["frontend", "backend", "database", "others"];

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState({ open_bugs: 0, assigned_to_me: 0, resolved_this_week: 0 });
  const [loading, setLoading] = useState(true);
  const [userBugs, setUserBugs] = useState([]);         // reporter: bugs they reported
  const [openBugs, setOpenBugs] = useState([]);          // developer: active bugs (new + in_progress + ready_for_testing)
  const [selectedComponent, setSelectedComponent] = useState(null); // null = "All"
  const [showCreateForm, setShowCreateForm] = useState(false);

  // AI state
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState({}); // { [bugId]: { title, reason, bug_id } }
  const [summarizingId, setSummarizingId] = useState(null);
  const [summaries, setSummaries] = useState({}); // { [bugId]: { text, generatedAt } }

  const user = authService.getCurrentUser();
  const role = user?.role || 'reporter';
  const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://127.0.0.1:8000';

  const [newBug, setNewBug] = useState({
    title: '',
    description: '',
    priority: 'medium',
    severity: 'minor',
    component: 'frontend',
  });

  const [githubSettings, setGithubSettings] = useState({
    github_token: user?.github_token || '',
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
  const handleAutoSuggest = async () => {
    if (!newBug.title || !newBug.description) {
      alert('Please enter a title and description first.');
      return;
    }
    setAiSuggesting(true);
    try {
      const res = await aiService.suggestFields(newBug.title, newBug.description);
      if (res?.data) {
        setNewBug(prev => ({
          ...prev,
          component: res.data.component || prev.component,
          priority: res.data.priority || prev.priority,
          severity: res.data.severity || prev.severity,
        }));
      }
    } catch (err) {
      console.error('AI suggest failed', err);
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleCreateBug = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/bugs', newBug);
      const bugData = res.data?.data;
      if (bugData?.possible_duplicate && bugData?.id) {
        setDuplicateWarnings(prev => ({
          ...prev,
          [bugData.id]: bugData.possible_duplicate
        }));
      }
      setShowCreateForm(false);
      setNewBug({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'frontend' });
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to create bug", err);
    }
  };

  const handleSummarizeBug = async (bugId) => {
    setSummarizingId(bugId);
    try {
      const res = await aiService.summarizeBug(bugId);
      if (res?.data) {
        setSummaries(prev => ({ ...prev, [bugId]: { text: res.data.ai_summary, generatedAt: res.data.generated_at } }));
      }
    } catch (err) {
      console.error('AI summarize failed', err);
      toast('AI summarization failed. Please try again.', 'error');
    } finally {
      setSummarizingId(null);
    }
  };

  const handleSaveDiscord = async (e) => {
    e.preventDefault();
    setSavingDiscord(true);
    try {
      await api.patch('/users/me/discord', { discord_username: discordUsername });
      toast('Discord username saved!', 'success');
    } catch (err) {
      toast('Failed to save Discord username', 'error');
    } finally {
      setSavingDiscord(false);
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
      toast(msg, 'error');
      fetchDashboardData(); // revert optimistic update
    }
  };

  const handleSaveGithubSettings = async (e) => {
    e.preventDefault();
    setGithubStatus('Saving and configuring webhooks...');
    try {
      await authService.updateGithubSettings(
        githubSettings.github_token,
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
    <AddBugModal
      isOpen={showCreateForm}
      onClose={() => setShowCreateForm(false)}
      onBugCreated={() => fetchDashboardData()}
    />
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

  const devBugColumns = [
    {
      header: 'TITLE & ATTACHMENTS',
      render: (bug) => (
        <div style={{ fontWeight: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{bug.title}</span>
            {bug.github_issue_url && (
              <a href={bug.github_issue_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-400)', textDecoration: 'none' }}>
                (View on GitHub)
              </a>
            )}
          </div>
          {bug.attachments && bug.attachments.length > 0 && (
            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {bug.attachments.map(att => {
                const url = att.file_url.startsWith('http') ? att.file_url : `${API_BASE}${att.file_url}`;
                return (
                  <a key={att.id} href={url} target="_blank" rel="noreferrer"
                    style={{
                      padding: '0.2rem 0.5rem', background: 'var(--primary-bg-subtle)',
                      border: '1px solid var(--primary-border-subtle)', borderRadius: 'var(--radius-xs)',
                      fontSize: 'var(--text-xs)', color: 'var(--primary-400)', display: 'inline-flex',
                      alignItems: 'center', gap: '0.3rem', textDecoration: 'none', fontWeight: 600,
                    }}>
                    <Paperclip size={12} /> {att.file_name}
                  </a>
                );
              })}
            </div>
          )}
          {bug.possible_duplicate && (
            <div style={{
              marginTop: '0.35rem', padding: '0.25rem 0.55rem',
              background: 'var(--warning-bg-subtle)', borderLeft: '3px solid var(--warning-400)',
              borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-xs)', color: 'var(--warning-400)',
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              Our AI flagged this after you searched — want to check again? <strong>"{bug.possible_duplicate.title || 'an existing bug'}"</strong>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'COMPONENT',
      render: (bug) => (
        <Badge type="custom" value={bug.component || '--'}
          style={{ background: 'var(--primary-bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--primary-border-subtle)', textTransform: 'capitalize' }} />
      ),
    },
    {
      header: 'STATUS',
      render: (bug) => <Badge type="status" value={bug.status} />,
    },
    {
      header: 'ACTIONS',
      render: (bug) => bug.status === 'ready_for_testing' ? (
        <Badge type="status" value="ready_for_testing" icon={<FlaskConical size={13} />} />
      ) : (
        <Button size="sm" variant="success" icon={<CheckCheck size={14} />} onClick={() => handleMarkResolved(bug.id)}>
          Mark as Resolved
        </Button>
      ),
    },
  ];

  const renderDeveloperBugList = () => (
    <>
      <Table
        columns={devBugColumns}
        data={displayedBugs}
        emptyMessage={`No active bugs${selectedComponent ? ` in "${selectedComponent}"` : ''}.`}
      />
    </>
  );

  const reporterBugColumns = [
    {
      header: 'TITLE',
      render: (bug) => (
        <div style={{ fontWeight: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>{bug.title}</span>
            {bug.github_issue_url && (
              <a href={bug.github_issue_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-400)', textDecoration: 'none' }}>
                (View on GitHub)
              </a>
            )}
          </div>
          {bug.possible_duplicate && (
            <div style={{
              marginTop: '0.35rem', padding: '0.25rem 0.55rem',
              background: 'var(--warning-bg-subtle)', borderLeft: '3px solid var(--warning-400)',
              borderRadius: 'var(--radius-xs)', fontSize: 'var(--text-xs)', color: 'var(--warning-400)',
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              Our AI flagged this after you searched — want to check again? <strong>"{bug.possible_duplicate.title || 'an existing bug'}"</strong>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'STATUS',
      render: (bug) => <Badge type="status" value={bug.status} />,
    },
    {
      header: 'AI SUMMARY',
      render: (bug) => bug.ai_summary || summaries[bug.id]?.text ? (
        <Button
          size="sm" variant="ghost"
          icon={<Sparkles size={12} />}
          onClick={() => setSummaries(prev => ({ ...prev, [bug.id]: prev[bug.id] ? null : { text: bug.ai_summary, generatedAt: bug.ai_summary_generated_at } }))}
          style={{ color: '#a78bfa' }}
        >
          {summaries[bug.id] ? 'Hide' : 'View'} Summary
        </Button>
      ) : (
        <Button
          size="sm" variant="ghost"
          icon={summarizingId === bug.id ? undefined : <Sparkles size={12} />}
          loading={summarizingId === bug.id}
          onClick={() => handleSummarizeBug(bug.id)}
          style={{ color: '#a78bfa', background: 'var(--primary-bg-subtle)', border: '1px solid var(--primary-border-subtle)' }}
        >
          {summarizingId === bug.id ? 'Generating...' : 'Summarize ✨'}
        </Button>
      ),
    },
  ];

  const renderReporterBugList = () => (
    <>
      <Table
        columns={reporterBugColumns}
        data={userBugs}
        emptyMessage="No bugs found."
      />
      {/* AI Summary expansion rows */}
      {userBugs.filter(bug => summaries[bug.id]?.text).map(bug => (
        <div key={`${bug.id}-summary`} style={{
          marginTop: '0.25rem', padding: '0.75rem 1rem',
          background: 'rgba(139,92,246,0.04)', borderRadius: 'var(--radius-xs)',
          border: '1px solid rgba(139,92,246,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <Sparkles size={14} style={{ color: '#a78bfa', marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#a78bfa', fontWeight: 600, marginBottom: '0.25rem' }}>
                AI Summary — {bug.title}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-main)', lineHeight: 1.5 }}>
                {summaries[bug.id].text}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const renderGithubSettings = () => (
    <Card style={{ marginTop: '2rem' }}>
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
        <input className="input-field" type="password" placeholder="GitHub Personal Access Token (repo scope required)" value={githubSettings.github_token} onChange={e => setGithubSettings({...githubSettings, github_token: e.target.value})} />
        <input className="input-field" placeholder="Target Repository (e.g. octocat/Hello-World)" value={githubSettings.github_repo} onChange={e => setGithubSettings({...githubSettings, github_repo: e.target.value})} />
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <Button type="submit" variant="primary">Save & Configure Webhooks</Button>
          {githubStatus && <span style={{ fontSize: '0.85rem', color: githubStatus.includes('Failed') ? '#ef4444' : '#10b981' }}>{githubStatus}</span>}
        </div>
      </form>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Role routing — admin and tester are separate components, untouched
  // ---------------------------------------------------------------------------
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'tester') return <TesterDashboard />;

  const renderDiscordIntegration = () => (
    <Card style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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
          <Button variant="primary" onClick={handleSaveDiscord} disabled={savingDiscord}>
            {savingDiscord ? 'Saving...' : 'Link Username'}
          </Button>
          <a href="https://discord.gg/C5mfpcTnpV" target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: '#5865F2', color: '#5865F2' }}>
            Join Server
          </a>
        </div>
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient">Dashboard Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Role: <strong style={{ textTransform: 'capitalize' }}>{role}</strong></p>
        </div>
        {!showCreateForm && (
          <Button variant="primary" onClick={() => setShowCreateForm(true)} icon={<PlusCircle size={18} />}>
            Report New Bug
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="dashboard-grid">
            <Skeleton height="100px" />
            <Skeleton height="100px" />
            <Skeleton height="100px" />
          </div>
          <Skeleton height="300px" />
          <Skeleton height="300px" />
        </div>
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
                <Card>
                  <div className="metric-title">
                    Active Bugs {selectedComponent
                      ? `(${selectedComponent})`
                      : ''}
                  </div>
                  <div className="metric-value">
                    {displayedBugs.filter(b => b.status === 'new' || b.status === 'in_progress').length}
                  </div>
                </Card>
                <Card>
                  <div className="metric-title">Being Tested</div>
                  <div className="metric-value" style={{ color: '#22d3ee' }}>
                    {displayedBugs.filter(b => b.status === 'ready_for_testing').length}
                  </div>
                </Card>
                <Card>
                  <div className="metric-title">Resolved This Week</div>
                  <div className="metric-value">{stats.resolved_this_week}</div>
                </Card>
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
