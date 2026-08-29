import { useState, useEffect } from 'react';
import { api, authService } from '../api/client';
import { ShieldCheck, Bug, CheckCircle, Send, Plus } from 'lucide-react';

export default function TesterDashboard() {
  const user = authService.getCurrentUser();
  const [assignedBugs, setAssignedBugs] = useState([]);
  const [reportedBugs, setReportedBugs] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New bug state
  const [showNewBugForm, setShowNewBugForm] = useState(false);
  const [newBug, setNewBug] = useState({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'frontend' });

  const [selectedComponent, setSelectedComponent] = useState('all');
  const componentsList = ["frontend", "backend", "database", "others"];
  const fetchData = async () => {
    try {
      const [assignedRes, reportedRes, usersRes] = await Promise.all([
        api.get(`/bugs?status=ready_for_testing&sort=-created_at`),
        api.get(`/bugs?reporter_id=${user.id}&sort=-created_at`),
        api.get('/users')
      ]);
      setAssignedBugs(assignedRes.data.data.items);
      setReportedBugs(reportedRes.data.data.items);
      setDevelopers(usersRes.data.data.filter(u => u.role === 'developer'));
    } catch (err) {
      console.error("Failed to load tester data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBug = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bugs', newBug);
      setShowNewBugForm(false);
      setNewBug({ title: '', description: '', priority: 'medium', severity: 'minor', component: 'ui' });
      fetchData(); // reload
    } catch (err) {
      alert(err.response?.data?.error?.message || "Failed to create bug");
    }
  };

  const handleFixed = async (bugId) => {
    try {
      await api.patch(`/bugs/${bugId}`, { status: 'closed' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || "Failed to mark as fixed");
    }
  };

  const handleNotFixed = async (bugId) => {
    try {
      await api.patch(`/bugs/${bugId}`, { status: 'new' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || "Failed to mark as not fixed");
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading tester dashboard...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck color="var(--primary)" size={28} />
          <h1 className="text-gradient" style={{ margin: 0 }}>Tester Dashboard</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewBugForm(!showNewBugForm)}>
          <Plus size={18} /> {showNewBugForm ? "Cancel" : "Report Bug"}
        </button>
      </div>

      {showNewBugForm && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
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
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Priority</label>
                <select className="input-field" value={newBug.priority} onChange={e => setNewBug({...newBug, priority: e.target.value})}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Severity</label>
                <select className="input-field" value={newBug.severity} onChange={e => setNewBug({...newBug, severity: e.target.value})}>
                  <option value="trivial">Trivial</option><option value="minor">Minor</option><option value="major">Major</option><option value="blocker">Blocker</option>
                </select>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Component</label>
                <input type="text" className="input-field" value={newBug.component} onChange={e => setNewBug({...newBug, component: e.target.value})} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Submit Bug</button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Bugs to Test */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <CheckCircle size={20} color="var(--primary)" /> Bugs to Test
            </h3>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.3rem 0.75rem' }}
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
            >
              <option value="all">All Components</option>
              {componentsList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Bugs ready for testing.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {assignedBugs.filter(b => selectedComponent === 'all' || b.component === selectedComponent).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending bugs to test.</div>
            ) : (
              assignedBugs.filter(b => selectedComponent === 'all' || b.component === selectedComponent).map(bug => (
                <div key={bug.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{bug.title}</h4>
                    <span className={`status-badge status-${bug.status}`}>{bug.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{bug.severity}</span>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{bug.component}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-success" onClick={() => handleFixed(bug.id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      <CheckCircle size={14} /> Fixed
                    </button>
                    <button className="btn btn-danger" onClick={() => handleNotFixed(bug.id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                      Not Fixed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Reported Bugs */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
            <Bug size={20} color="var(--danger)" /> Bugs I Reported
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reportedBugs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>You haven't reported any bugs yet.</div>
            ) : (
              reportedBugs.map(bug => (
                <div key={bug.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{bug.title}</h4>
                    <span className={`status-badge status-${bug.status}`}>{bug.status.replace('_', ' ')}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                    Assigned to: {bug.assignee ? bug.assignee.name : 'Unassigned'}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Created: {new Date(bug.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
