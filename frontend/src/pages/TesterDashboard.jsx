import { useState, useEffect } from 'react';
import { api, authService, aiService } from '../api/client';
import { ShieldCheck, Bug, CheckCircle, Plus, FlaskConical, RotateCcw, CheckCircle2, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

export default function TesterDashboard() {
  const user = authService.getCurrentUser();
  const [readyBugs, setReadyBugs] = useState([]);       // all bugs with status=ready_for_testing
  const [resolvedBugs, setResolvedBugs] = useState([]); // all bugs with status=resolved
  const [reportedBugs, setReportedBugs] = useState([]);
  const [loading, setLoading] = useState(true);

  // New bug state
  const [showNewBugForm, setShowNewBugForm] = useState(false);
  const [newBug, setNewBug] = useState({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'frontend' });

  // AI state
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState({}); // { [bugId]: { title, reason, bug_id } }
  const [summarizingId, setSummarizingId] = useState(null);
  const [summaries, setSummaries] = useState({});

  const fetchData = async () => {
    try {
      const [readyRes, resolvedRes, reportedRes] = await Promise.all([
        api.get('/bugs?status=ready_for_testing&sort=-updated_at'),
        api.get('/bugs?status=resolved&sort=-updated_at'),
        api.get(`/bugs?reporter_id=${user.id}&sort=-created_at`)
      ]);
      setReadyBugs(readyRes.data.data.items || []);
      setResolvedBugs(resolvedRes.data.data.items || []);
      setReportedBugs(reportedRes.data.data.items || []);
    } catch (err) {
      console.error("Failed to load tester data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      setShowNewBugForm(false);
      setNewBug({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'frontend' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to create bug");
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
      alert('AI summarization failed. Please try again.');
    } finally {
      setSummarizingId(null);
    }
  };

  // Mark a bug as resolved (passed testing)
  const handleMarkFixed = async (bugId) => {
    const target = readyBugs.find(b => b.id === bugId);
    // Optimistic update
    setReadyBugs(prev => prev.filter(b => b.id !== bugId));
    if (target) {
      setResolvedBugs(prev => [{ ...target, status: 'resolved', updated_at: new Date().toISOString() }, ...prev]);
    }
    try {
      await api.patch(`/bugs/${bugId}`, { status: 'resolved' });
      fetchData();
    } catch (err) {
      console.error("Failed to mark as fixed", err);
      alert(err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to mark as fixed");
      fetchData(); // revert
    }
  };

  // Send bug back to developer (failed testing)
  const handleSendBack = async (bugId) => {
    setReadyBugs(prev => prev.filter(b => b.id !== bugId));
    try {
      await api.patch(`/bugs/${bugId}`, { status: 'in_progress' });
      fetchData();
    } catch (err) {
      console.error("Failed to send back", err);
      alert(err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to send back");
      fetchData();
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading tester dashboard...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck color="var(--primary)" size={28} />
          <h1 className="text-gradient" style={{ margin: 0 }}>Tester Dashboard</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewBugForm(!showNewBugForm)}>
          <Plus size={18} /> {showNewBugForm ? "Cancel" : "Report Bug"}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-card">
          <div className="metric-title">Being Tested</div>
          <div className="metric-value" style={{ color: '#22d3ee' }}>{readyBugs.length}</div>
        </div>
        <div className="glass-card">
          <div className="metric-title">Verified & Resolved</div>
          <div className="metric-value" style={{ color: '#34d399' }}>{resolvedBugs.length}</div>
        </div>
        <div className="glass-card">
          <div className="metric-title">Reported by Me</div>
          <div className="metric-value">{reportedBugs.length}</div>
        </div>
      </div>

      {/* New bug form */}
      {showNewBugForm && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
          <h3>Report a New Bug</h3>
          <form onSubmit={handleCreateBug} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label>Title</label>
              <input type="text" className="input-field" value={newBug.title} onChange={e => setNewBug({...newBug, title: e.target.value})} required />
            </div>
            <div className="input-group">
              <label>Description</label>
              <textarea className="input-field" rows="3" value={newBug.description} onChange={e => setNewBug({...newBug, description: e.target.value})} required />
            </div>

            {/* AI Auto-suggest button */}
            <button
              type="button"
              onClick={handleAutoSuggest}
              disabled={aiSuggesting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
                border: '1px solid rgba(139,92,246,0.4)', borderRadius: 'var(--radius-sm)',
                color: '#a78bfa', cursor: aiSuggesting ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
                width: 'fit-content', transition: 'all 0.2s',
              }}
            >
              {aiSuggesting
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Asking Gemini...</>
                : <><Sparkles size={14} /> Auto-fill with AI ✨</>}
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Priority</label>
                <select className="input-field" value={newBug.priority} onChange={e => setNewBug({...newBug, priority: e.target.value})} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Severity</label>
                <select className="input-field" value={newBug.severity} onChange={e => setNewBug({...newBug, severity: e.target.value})} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
                  <option value="trivial">Trivial</option><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option><option value="blocker">Blocker</option>
                </select>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Component</label>
                <select className="input-field" value={newBug.component} onChange={e => setNewBug({...newBug, component: e.target.value})} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="database">Database</option>
                  <option value="others">Others</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Submit Bug</button>
          </form>
        </div>
      )}

      {/* New bug form */}

      {/* ── Being Tested queue ── */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
          <FlaskConical size={20} color="#22d3ee" />
          <span style={{ color: '#22d3ee' }}>Being Tested</span>
          <span style={{
            marginLeft: '0.5rem', background: 'rgba(6,182,212,0.2)', color: '#22d3ee',
            borderRadius: '9999px', padding: '0.1rem 0.6rem', fontSize: '0.8rem', fontWeight: 700
          }}>{readyBugs.length}</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Bugs marked as resolved by developers — awaiting your verification.
        </p>

        {readyBugs.length === 0 ? (
          <div style={{
            color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center',
            padding: '2rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)'
          }}>
            No bugs in the testing queue right now. 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {readyBugs.map(bug => (
              <div key={bug.id} style={{
                background: 'rgba(6,182,212,0.05)', padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)', border: '1px solid rgba(6,182,212,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
              }}>
                {/* Bug info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{bug.title}</span>
                    <span className="badge badge-ready_for_testing">being tested</span>
                    {(bug.possible_duplicate || duplicateWarnings[bug.id]) && (
                      <span style={{
                        padding: '0.15rem 0.5rem', background: 'rgba(245,158,11,0.15)',
                        border: '1px solid rgba(245,158,11,0.35)', borderRadius: '4px',
                        color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                        <AlertTriangle size={11} /> Similar to: "{(bug.possible_duplicate || duplicateWarnings[bug.id]).title || 'existing bug'}"
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.component}</span>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.severity}</span>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.priority} priority</span>
                  </div>
                  {/* AI summary inline */}
                  {summaries[bug.id]?.text && (
                    <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(139,92,246,0.08)', borderRadius: '6px', borderLeft: '2px solid #a78bfa' }}>
                      <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600, marginBottom: '0.2rem' }}>✨ AI Summary</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>{summaries[bug.id].text}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* AI Summarize */}
                  <button
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex',
                      alignItems: 'center', gap: '0.4rem',
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.15))',
                      color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)',
                      cursor: summarizingId === bug.id ? 'wait' : 'pointer',
                    }}
                    onClick={() => handleSummarizeBug(bug.id)}
                    disabled={summarizingId === bug.id}
                  >
                    {summarizingId === bug.id
                      ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                      : <><Sparkles size={13} /> Summarize ✨</>}
                  </button>

                  {/* Pass testing */}
                  <button
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex',
                      alignItems: 'center', gap: '0.4rem', background: 'rgba(16,185,129,0.15)',
                      color: '#34d399', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 'var(--radius-sm)',
                    }}
                    onClick={() => handleMarkFixed(bug.id)}
                  >
                    <CheckCircle size={14} /> Mark Fixed
                  </button>

                  {/* Fail testing — send back */}
                  <button
                    className="btn"
                    style={{
                      padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex',
                      alignItems: 'center', gap: '0.4rem', background: 'rgba(239,68,68,0.1)',
                      color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
                    }}
                    onClick={() => handleSendBack(bug.id)}
                  >
                    <RotateCcw size={14} /> Send Back
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Verified & Resolved bugs ── */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
          <CheckCircle2 size={20} color="#34d399" />
          <span style={{ color: '#34d399' }}>Resolved Bugs</span>
          <span style={{
            marginLeft: '0.5rem', background: 'rgba(16,185,129,0.2)', color: '#34d399',
            borderRadius: '9999px', padding: '0.1rem 0.6rem', fontSize: '0.8rem', fontWeight: 700
          }}>{resolvedBugs.length}</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Issues that have passed testing and have been marked as resolved.
        </p>

        {resolvedBugs.length === 0 ? (
          <div style={{
            color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center',
            padding: '2rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)'
          }}>
            No resolved bugs recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {resolvedBugs.map(bug => (
              <div key={bug.id} style={{
                background: 'rgba(16,185,129,0.04)', padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{bug.title}</span>
                    <span className="badge badge-resolved">resolved</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.component}</span>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.severity}</span>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{bug.priority} priority</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Resolved: {new Date(bug.updated_at || bug.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reported bugs (read-only) ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
          <Bug size={20} color="var(--danger)" /> Bugs I Reported
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reportedBugs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>You haven't reported any bugs yet.</div>
          ) : (
            reportedBugs.map(bug => (
              <div key={bug.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{bug.title}</h4>
                    {(bug.possible_duplicate || duplicateWarnings[bug.id]) && (
                      <div style={{
                        marginTop: '0.3rem', padding: '0.2rem 0.5rem',
                        background: 'rgba(245,158,11,0.12)', borderLeft: '3px solid #fbbf24',
                        borderRadius: '4px', fontSize: '0.75rem', color: '#fbbf24',
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                        <span>
                          Similar to: <strong>"{(bug.possible_duplicate || duplicateWarnings[bug.id]).title || 'an existing bug'}"</strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge badge-${bug.status}`}>{bug.status === 'ready_for_testing' ? 'being tested' : bug.status.replace(/_/g, ' ')}</span>
                    {bug.ai_summary || summaries[bug.id]?.text ? (
                      <button
                        onClick={() => setSummaries(prev => ({ ...prev, [bug.id]: prev[bug.id] ? null : { text: bug.ai_summary } }))}
                        style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <Sparkles size={11} /> {summaries[bug.id] ? 'Hide' : 'View'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSummarizeBug(bug.id)}
                        disabled={summarizingId === bug.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.2rem 0.5rem', background: 'rgba(139,92,246,0.12)',
                          border: '1px solid rgba(139,92,246,0.25)', borderRadius: '4px',
                          color: '#a78bfa', cursor: summarizingId === bug.id ? 'wait' : 'pointer',
                          fontSize: '0.7rem', fontWeight: 600,
                        }}
                      >
                        {summarizingId === bug.id
                          ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> ...</>
                          : <><Sparkles size={10} /> Summarize ✨</>}
                      </button>
                    )}
                  </div>
                </div>
                {summaries[bug.id]?.text && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(139,92,246,0.06)', borderRadius: '6px', borderLeft: '2px solid #a78bfa', fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {summaries[bug.id].text}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  Created: {new Date(bug.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
