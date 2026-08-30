import { useState } from 'react';
import { bugService, aiService, api } from '../api/client';
import { Search, Upload, X, FileText, Image as ImageIcon, Sparkles, Loader2, CheckCircle2, UserCheck, UserPlus, ArrowRight, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Select from './ui/Select';
import Textarea from './ui/Textarea';
import { useToast } from '../contexts/ToastContext';

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
  const toast = useToast();

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
      } else {
        await bugService.followBug(bugId);
      }
      setFollowingMap({ ...followingMap, [bugId]: !isFollowing });
    } catch (err) {
      console.error("Failed to update follow status", err);
      toast("Failed to update follow status", 'error');
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
      console.error('File upload failed', err);
      toast('Failed to upload file.', 'error');
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
      console.error("AI autocomplete failed", err);
      toast("AI autocomplete failed", 'error');
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
      toast("Bug reported successfully!", "success");
    } catch (err) {
      console.error("Failed to submit bug", err);
      toast(err.response?.data?.detail?.message || err.response?.data?.error?.message || "Failed to create bug.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://127.0.0.1:8000';

  const modalTitle = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Bugzilla Bug Reporter
      </div>
      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {step === 1 ? 'Step 1: Check for similar existing issues' : 'Step 2: Enter detailed issue description & attachments'}
      </p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="850px">

        {/* STEP 1: FIND SIMILAR ISSUES */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', margin: '1rem 0 2rem 0' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e5e7eb', marginBottom: '1rem' }}>
                Summarize your issue or request in one sentence:
              </h3>
              <form onSubmit={handleSearchSimilar} style={{ display: 'flex', gap: '0.5rem', maxWidth: '650px', margin: '0 auto' }}>
                <Input
                  type="text"
                  placeholder="e.g. login page issue or dropdown unresponsive..."
                  value={summaryQuery}
                  onChange={(e) => setSummaryQuery(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                  required
                />
                <Button type="submit" variant="primary" disabled={searchingSimilar} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                  {searchingSimilar ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                  Find similar issues
                </Button>
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
                              <Button
                                type="button"
                                size="sm"
                                variant={followingMap[bug.id] ? 'danger' : 'primary'}
                                onClick={() => handleToggleFollow(bug.id)}
                                icon={followingMap[bug.id] ? <UserCheck size={14} /> : <UserPlus size={14} />}
                              >
                                {followingMap[bug.id] ? 'Stop following' : 'Follow bug'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <Button variant="primary" onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}>
                    None of these match, continue to Report <ArrowRight size={16} />
                  </Button>
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
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>Bug Title <span style={{ color: '#ef4444' }}>*</span></label>
              <Input
                type="text"
                placeholder="Briefly describe the issue..."
                value={bugForm.title}
                onChange={(e) => setBugForm({ ...bugForm, title: e.target.value })}
                required
              />
            </div>

            {/* Structured reproduction sections */}
            <div style={{ display: 'grid', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>Steps to Reproduce <span style={{ color: '#ef4444' }}>*</span></label>
                <Textarea
                  placeholder="1. Go to page X&#10;2. Click on Y&#10;3. See error Z"
                  value={bugForm.stepsToReproduce}
                  onChange={(e) => setBugForm({ ...bugForm, stepsToReproduce: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>What happened? (actual results) <span style={{ color: '#ef4444' }}>*</span></label>
                <Textarea
                  placeholder="Expected login success, but button became unresponsive..."
                  value={bugForm.whatHappened}
                  onChange={(e) => setBugForm({ ...bugForm, whatHappened: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>What Should Happen? <span style={{ color: '#ef4444' }}>*</span></label>
                <Textarea
                  placeholder="Describe the expected correct behavior..."
                  value={bugForm.whatShouldHappen}
                  onChange={(e) => setBugForm({ ...bugForm, whatShouldHappen: e.target.value })}
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* AI Auto-fill & Component / Priority / Severity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <Button
                type="button"
                onClick={handleAutoSuggest}
                disabled={aiSuggesting}
                icon={aiSuggesting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.25))',
                  border: '1px solid rgba(139,92,246,0.4)',
                  color: '#c084fc',
                }}
              >
                Auto-suggest metadata with AI ✨
              </Button>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>Priority</label>
                  <Select
                    value={bugForm.priority}
                    onChange={(e) => setBugForm({ ...bugForm, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
                
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>Severity</label>
                  <Select
                    value={bugForm.severity}
                    onChange={(e) => setBugForm({ ...bugForm, severity: e.target.value })}
                  >
                    <option value="minor">Minor (UI/Cosmetic)</option>
                    <option value="major">Major (Feature broken)</option>
                    <option value="blocker">Blocker (System down)</option>
                  </Select>
                </div>

                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>Component</label>
                  <Select
                    value={bugForm.component}
                    onChange={(e) => setBugForm({ ...bugForm, component: e.target.value })}
                  >
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="database">Database</option>
                    <option value="others">Others</option>
                  </Select>
                </div>
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
              <Button type="button" variant="outline" onClick={() => setStep(1)} icon={<ArrowLeft size={16} />}>
                Back to Similar Search
              </Button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Bug'}
                </Button>
              </div>
            </div>
          </form>
        )}
    </Modal>
  );
}
