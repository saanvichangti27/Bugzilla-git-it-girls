import { useState } from 'react';
import { bugService, aiService, api } from '../api/client';
import { Search, Upload, X, FileText, Image as ImageIcon, Sparkles, Loader2, CheckCircle2, UserCheck, UserPlus, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AddBugModal({ isOpen, onClose, onBugCreated }) {
  const [step, setStep] = useState(1);
  const [summaryQuery, setSummaryQuery] = useState('');
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [similarBugs, setSimilarBugs] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [followingMap, setFollowingMap] = useState({});

  // Bug Details
  const [bugForm, setBugForm] = useState({
    title: '',
    stepsToReproduce: '',
    whatHappened: '',
    whatShouldHappen: '',
    priority: 'medium',
    severity: 'minor',
    component: 'frontend',
  });

  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Step 1: Search similar bugs
  const handleSearchSimilar = async (e) => {
    if (e) e.preventDefault();
    if (!summaryQuery.trim()) return;
    
    setSearchingSimilar(true);
    setHasSearched(true);
    try {
      const res = await bugService.searchSimilar(summaryQuery);
      const items = res?.data || [];
      setSimilarBugs(items);
      
      const initialFollowing = {};
      items.forEach(b => {
        initialFollowing[b.id] = b.is_following;
      });
      setFollowingMap(initialFollowing);
    } catch (err) {
      console.error("Failed to search similar bugs", err);
    } finally {
      setSearchingSimilar(false);
    }
  };

  // Follow / Unfollow bug
  const handleToggleFollow = async (bugId) => {
    const isFollowing = followingMap[bugId];
    try {
      if (isFollowing) {
        await bugService.unfollowBug(bugId);
        setFollowingMap(prev => ({ ...prev, [bugId]: false }));
      } else {
        await bugService.followBug(bugId);
        setFollowingMap(prev => ({ ...prev, [bugId]: true }));
      }
    } catch (err) {
      console.error("Failed to update follow status", err);
      alert("Failed to update follow status.");
    }
  };

  // Proceed to Step 2
  const handleProceedToReport = () => {
    setBugForm(prev => ({
      ...prev,
      title: summaryQuery
    }));
    setStep(2);
  };

  // File Attachment Upload
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const res = await bugService.uploadAttachment(files[i]);
        if (res?.data) {
          setAttachments(prev => [...prev, res.data]);
        }
      }
    } catch (err) {
      console.error("File upload failed", err);
      alert("File upload failed. Please try again.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // AI Auto-suggest
  const handleAutoSuggest = async () => {
    const desc = `${bugForm.stepsToReproduce}\n${bugForm.whatHappened}\n${bugForm.whatShouldHappen}`.trim();
    if (!bugForm.title) {
      alert('Please enter a summary first.');
      return;
    }
    setAiSuggesting(true);
    try {
      const res = await aiService.suggestFields(bugForm.title, desc || bugForm.title);
      if (res?.data) {
        setBugForm(prev => ({
          ...prev,
          component: res.data.component || prev.component,
          priority: res.data.priority || prev.priority,
          severity: res.data.severity || prev.severity,
        }));
      }
    } catch (err) {
      console.error("AI suggest failed", err);
    } finally {
      setAiSuggesting(false);
    }
  };

  // Final Submit Bug
  const handleSubmitBug = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Build combined description matching Bugzilla standard
    let fullDescription = "";
    if (bugForm.stepsToReproduce) {
      fullDescription += `### Steps to reproduce:\n${bugForm.stepsToReproduce}\n\n`;
    }
    if (bugForm.whatHappened) {
      fullDescription += `### What happened:\n${bugForm.whatHappened}\n\n`;
    }
    if (bugForm.whatShouldHappen) {
      fullDescription += `### Expected result:\n${bugForm.whatShouldHappen}\n\n`;
    }
    if (!fullDescription.trim()) {
      fullDescription = bugForm.title;
    }

    const payload = {
      title: bugForm.title,
      description: fullDescription.trim(),
      priority: bugForm.priority,
      severity: bugForm.severity,
      component: bugForm.component,
      attachments: attachments
    };

    try {
      const res = await api.post('/bugs', payload);
      if (onBugCreated) onBugCreated(res.data?.data);
      onClose();
      // Reset state
      setStep(1);
      setSummaryQuery('');
      setSimilarBugs([]);
      setHasSearched(false);
      setAttachments([]);
    } catch (err) {
      console.error("Failed to submit bug", err);
      alert(err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to create bug.");
    } finally {
      setSubmitting(false);
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://127.0.0.1:8000';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto',
        borderRadius: '16px', padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', background: '#121624', color: '#f3f4f6'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Bugzilla Bug Reporter
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {step === 1 ? 'Step 1: Check for similar existing issues' : 'Step 2: Enter detailed issue description & attachments'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: FIND SIMILAR ISSUES */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', margin: '1rem 0 2rem 0' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e5e7eb', marginBottom: '1rem' }}>
                Summarize your issue or request in one sentence:
              </h3>
              <form onSubmit={handleSearchSimilar} style={{ display: 'flex', gap: '0.5rem', maxWidth: '650px', margin: '0 auto' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. login page issue or dropdown unresponsive..."
                  value={summaryQuery}
                  onChange={(e) => setSummaryQuery(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={searchingSimilar} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                  {searchingSimilar ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                  Find similar issues
                </button>
              </form>
            </div>

            {/* Results Table */}
            {hasSearched && (
              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#9ca3af' }}>
                    {similarBugs.length > 0 ? `Found ${similarBugs.length} similar issue(s):` : 'No similar issues found.'}
                  </h4>
                </div>

                {similarBugs.length > 0 ? (
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Bug ID</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Summary</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {similarBugs.map(bug => (
                          <tr key={bug.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#818cf8' }}>
                              #{bug.id.slice(0, 7)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{bug.title}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#9ca3af' }}>{bug.component}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className={`badge badge-${bug.status}`}>
                                {bug.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleFollow(bug.id)}
                                style={{
                                  padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '6px',
                                  fontWeight: 600, border: '1px solid', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  borderColor: followingMap[bug.id] ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                                  background: followingMap[bug.id] ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                  color: followingMap[bug.id] ? '#f87171' : '#818cf8',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {followingMap[bug.id] ? (
                                  <><UserCheck size={14} /> Stop following</>
                                ) : (
                                  <><UserPlus size={14} /> Follow bug</>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" onClick={handleProceedToReport} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Proceed to report bug <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: FULL BUG DETAILS & FILE ATTACHMENTS */}
        {step === 2 && (
          <form onSubmit={handleSubmitBug} style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Title / Summary */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: '#d1d5db' }}>
                Summary *
              </label>
              <input
                className="input-field"
                value={bugForm.title}
                onChange={e => setBugForm({ ...bugForm, title: e.target.value })}
                required
              />
            </div>

            {/* Structured reproduction sections */}
            <div style={{ display: 'grid', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem', color: '#9ca3af' }}>
                  What did you do? (steps to reproduce) *
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="1. Open page X... 2. Click button Y..."
                  value={bugForm.stepsToReproduce}
                  onChange={e => setBugForm({ ...bugForm, stepsToReproduce: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem', color: '#9ca3af' }}>
                  What happened? (actual results) *
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Expected login success, but button became unresponsive..."
                  value={bugForm.whatHappened}
                  onChange={e => setBugForm({ ...bugForm, whatHappened: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem', color: '#9ca3af' }}>
                  What should have happened? (expected results) *
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="User should be redirected to dashboard after clicking login..."
                  value={bugForm.whatShouldHappen}
                  onChange={e => setBugForm({ ...bugForm, whatShouldHappen: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* AI Auto-fill & Component / Priority / Severity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={aiSuggesting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.25))',
                  border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px',
                  color: '#c084fc', cursor: aiSuggesting ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
                }}
              >
                {aiSuggesting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                Auto-suggest metadata with AI ✨
              </button>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select className="input-field" value={bugForm.priority} onChange={e => setBugForm({...bugForm, priority: e.target.value})} style={{ background: '#1e293b', color: '#fff', width: 'auto' }}>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>
                <select className="input-field" value={bugForm.severity} onChange={e => setBugForm({...bugForm, severity: e.target.value})} style={{ background: '#1e293b', color: '#fff', width: 'auto' }}>
                  <option value="trivial">Trivial Severity</option>
                  <option value="minor">Minor Severity</option>
                  <option value="major">Major Severity</option>
                  <option value="critical">Critical Severity</option>
                  <option value="blocker">Blocker Severity</option>
                </select>
                <select className="input-field" value={bugForm.component} onChange={e => setBugForm({...bugForm, component: e.target.value})} style={{ background: '#1e293b', color: '#fff', width: 'auto' }}>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="database">Database</option>
                  <option value="others">Others</option>
                </select>
              </div>
            </div>

            {/* ATTACHMENT UPLOAD BOX (Bugzilla Official UI Style) */}
            <div style={{
              border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '10px',
              padding: '1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)',
              marginTop: '0.5rem'
            }}>
              <Upload size={32} style={{ color: '#818cf8', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                Drag & drop a file / photo here, or browse
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 1rem 0' }}>
                Upload screenshots, photos, logs, or file evidence to assist developers.
              </p>

              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1.2rem',
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: '6px', color: '#818cf8', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'
              }}>
                {uploadingFile ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                Browse Files
                <input type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              </label>

              {/* Uploaded File Previews */}
              {attachments.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {attachments.map(att => {
                    const fullUrl = att.file_url.startsWith('http') ? att.file_url : `${API_BASE}${att.file_url}`;
                    const isImg = att.file_type?.includes('image') || att.file_name.match(/\.(png|jpg|jpeg|gif|webp)$/i);
                    return (
                      <div key={att.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b',
                        padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.8rem'
                      }}>
                        {isImg ? (
                          <img src={fullUrl} alt={att.file_name} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: '4px' }} />
                        ) : (
                          <FileText size={18} color="#818cf8" />
                        )}
                        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {att.file_name}
                        </span>
                        <button type="button" onClick={() => handleRemoveAttachment(att.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={16} /> Back to Similar Search
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Bug'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
