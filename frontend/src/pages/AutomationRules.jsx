import { useState, useEffect, useCallback } from 'react';
import { automationService, userService } from '../api/client';
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Shield, Activity, Clock, CheckCircle, XCircle, List, X,
  AlertTriangle, Settings, Webhook, BellRing, UserCheck, Tag, ArrowRight
} from 'lucide-react';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const TRIGGER_EVENTS = [
  { value: 'bug.created',        label: 'Bug Created' },
  { value: 'bug.status_changed', label: 'Bug Status Changed' },
  { value: 'bug.resolved',       label: 'Bug Resolved' },
  { value: 'bug.comment_added',  label: 'Comment Added' },
  { value: 'bug.assigned',       label: 'Bug Assigned' },
  { value: 'bug.updated',        label: 'Bug Updated' },
];

const CONDITION_FIELDS = [
  { value: 'priority',  label: 'Priority' },
  { value: 'status',    label: 'Status' },
  { value: 'severity',  label: 'Severity' },
  { value: 'component', label: 'Component' },
  { value: 'title',     label: 'Title' },
];

const OPERATORS = [
  { value: '=',        label: 'equals (=)' },
  { value: '!=',       label: 'not equals (!=)' },
  { value: 'in',       label: 'is one of (in)' },
  { value: 'contains', label: 'contains' },
];

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'trivial'];
const STATUS_OPTIONS   = ['new', 'in_progress', 'ready_for_testing', 'resolved', 'closed'];
const SEVERITY_OPTIONS = ['critical', 'major', 'moderate', 'minor', 'trivial'];

const ACTION_TYPES = [
  { value: 'notify_followers', label: 'Notify Followers',   icon: <BellRing size={15}/> },
  { value: 'set_status',       label: 'Set Status',         icon: <Tag size={15}/> },
  { value: 'set_priority',     label: 'Set Priority',       icon: <AlertTriangle size={15}/> },
  { value: 'assign_user',      label: 'Assign User',        icon: <UserCheck size={15}/> },
  { value: 'send_webhook',     label: 'Send Webhook',       icon: <Webhook size={15}/> },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function emptyRule() {
  return {
    name: '',
    trigger_event_type: 'bug.created',
    conditions: [],
    actions: [],
    enabled: true,
  };
}

function emptyCondition() {
  return { field: 'priority', operator: '=', value: '' };
}

function emptyAction() {
  return { type: 'notify_followers', value: '' };
}

function priorityColor(p) {
  if (!p) return '#94a3b8';
  const map = { critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#34d399', trivial: '#94a3b8' };
  return map[p.toLowerCase()] || '#94a3b8';
}

function statusColor(s) {
  if (!s) return '#94a3b8';
  const map = { new: '#818cf8', in_progress: '#fbbf24', ready_for_testing: '#22d3ee', resolved: '#34d399', closed: '#9ca3af' };
  return map[s.toLowerCase()] || '#94a3b8';
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      onClick={() => onChange(!checked)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: checked ? 'var(--success)' : 'var(--text-muted)',
        transition: 'color 0.2s',
        display: 'flex', alignItems: 'center',
      }}
      title={checked ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      {checked ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
    </button>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem',
      fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.03em',
      background: `${color}22`, color,
      border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

function ActionValueInput({ action, users, onChange }) {
  const sharedStyle = {
    background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.8rem',
    color: 'var(--text-main)', fontSize: '0.9rem', width: '100%',
    fontFamily: 'inherit',
  };

  if (action.type === 'notify_followers') return null;

  if (action.type === 'set_status') return (
    <select value={action.value} onChange={e => onChange({ ...action, value: e.target.value })}
      style={sharedStyle}>
      <option value="">— pick status —</option>
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
    </select>
  );

  if (action.type === 'set_priority') return (
    <select value={action.value} onChange={e => onChange({ ...action, value: e.target.value })}
      style={sharedStyle}>
      <option value="">— pick priority —</option>
      {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );

  if (action.type === 'assign_user') return (
    <select value={action.value} onChange={e => onChange({ ...action, value: e.target.value })}
      style={sharedStyle}>
      <option value="">— pick user —</option>
      {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
    </select>
  );

  if (action.type === 'send_webhook') return (
    <input
      type="url"
      placeholder="https://discord.com/api/webhooks/…"
      value={action.value}
      onChange={e => onChange({ ...action, value: e.target.value })}
      style={sharedStyle}
    />
  );

  return null;
}

function ConditionValueInput({ cond, onChange }) {
  const sharedStyle = {
    background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.8rem',
    color: 'var(--text-main)', fontSize: '0.9rem', width: '100%',
    fontFamily: 'inherit',
  };

  if (cond.field === 'priority') return (
    <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })} style={sharedStyle}>
      <option value="">— pick value —</option>
      {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );

  if (cond.field === 'status') return (
    <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })} style={sharedStyle}>
      <option value="">— pick value —</option>
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
    </select>
  );

  if (cond.field === 'severity') return (
    <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })} style={sharedStyle}>
      <option value="">— pick value —</option>
      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  return (
    <input
      type="text" placeholder="value…" value={cond.value}
      onChange={e => onChange({ ...cond, value: e.target.value })}
      style={sharedStyle}
    />
  );
}

/* ─── Rule Card ──────────────────────────────────────────────────────────── */

function RuleCard({ rule, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
      transition: 'box-shadow 0.2s, border-color 0.2s',
      boxShadow: expanded ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      borderColor: rule.enabled ? 'var(--border)' : 'rgba(255,255,255,0.04)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '1rem 1.25rem',
        background: rule.enabled
          ? 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, transparent 60%)'
          : 'transparent',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: rule.enabled ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: rule.enabled ? 'var(--primary)' : 'var(--text-muted)',
        }}>
          <Zap size={16}/>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: rule.enabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {rule.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge color="#818cf8">
              {TRIGGER_EVENTS.find(e => e.value === rule.trigger_event_type)?.label ?? rule.trigger_event_type}
            </Badge>
            <span style={{ opacity: 0.6 }}>{(rule.conditions || []).length} condition{rule.conditions?.length !== 1 ? 's' : ''}</span>
            <span style={{ opacity: 0.6 }}>{(rule.actions || []).length} action{rule.actions?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Toggle
            id={`toggle-rule-${rule.id}`}
            checked={!!rule.enabled}
            onChange={enabled => onToggle(rule.id, enabled)}
          />
          <button
            id={`delete-rule-${rule.id}`}
            onClick={() => onDelete(rule.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-bg-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
            title="Delete rule"
          >
            <Trash2 size={16}/>
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem 1.25rem', display: 'grid', gap: '1rem' }}>
          {/* Conditions */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Conditions (ALL must match)
            </div>
            {(!rule.conditions || rule.conditions.length === 0) ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Always runs (no conditions)</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rule.conditions.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)',
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  }}>
                    <code style={{ color: 'var(--primary-300)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4 }}>{c.field}</code>
                    <span style={{ color: 'var(--text-muted)' }}>{c.operator}</span>
                    <code style={{ color: 'var(--warning)', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>{Array.isArray(c.value) ? c.value.join(', ') : c.value}</code>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(rule.actions || []).map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)',
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ color: 'var(--success)' }}>
                    {ACTION_TYPES.find(at => at.value === a.type)?.icon}
                  </span>
                  <span style={{ color: 'var(--success-400)' }}>{ACTION_TYPES.find(at => at.value === a.type)?.label ?? a.type}</span>
                  {a.value && (
                    <>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)' }}/>
                      <code style={{ color: 'var(--text-main)', fontSize: '0.82rem', wordBreak: 'break-all' }}>{a.value}</code>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {rule.created_at && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
              Created {new Date(rule.created_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Rule Builder Form ──────────────────────────────────────────────────── */

function RuleBuilder({ users, onSave, onCancel }) {
  const [form, setForm] = useState(emptyRule());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, emptyCondition()] }));
  const removeCondition = i => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i, val) => setForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? val : c) }));

  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, emptyAction()] }));
  const removeAction = i => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i, val) => setForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? val : a) }));

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Rule name is required.'); return; }
    if (form.actions.length === 0) { setError('Add at least one action.'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to save rule.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '0.65rem 1rem',
    color: 'var(--text-main)', fontSize: '0.95rem', width: '100%',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-md)',
      padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} style={{ color: 'var(--primary)' }}/>
          New Automation Rule
        </h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20}/>
        </button>
      </div>

      {/* Name */}
      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Rule Name *</label>
        <input
          id="rule-name"
          style={inputStyle}
          placeholder="e.g. Escalate critical bugs immediately"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>

      {/* Trigger */}
      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
          Trigger Event
        </label>
        <select
          id="rule-trigger"
          style={inputStyle}
          value={form.trigger_event_type}
          onChange={e => setForm(f => ({ ...f, trigger_event_type: e.target.value }))}
        >
          {TRIGGER_EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
        </select>
      </div>

      {/* Conditions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Conditions (ALL must match)</label>
          <button id="add-condition" onClick={addCondition} style={{
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '3px 10px',
            cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus size={13}/> Add Condition
          </button>
        </div>
        {form.conditions.length === 0 && (
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
            No conditions — rule fires for every matching event.
          </div>
        )}
        {form.conditions.map((cond, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={cond.field} onChange={e => updateCondition(i, { ...cond, field: e.target.value })} style={inputStyle}>
              {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={cond.operator} onChange={e => updateCondition(i, { ...cond, operator: e.target.value })} style={inputStyle}>
              {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
            <ConditionValueInput cond={cond} onChange={val => updateCondition(i, val)}/>
            <button onClick={() => removeCondition(i)} style={{
              background: 'var(--danger-bg-subtle)', border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center',
            }}>
              <X size={14}/>
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Actions *</label>
          <button id="add-action" onClick={addAction} style={{
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '3px 10px',
            cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Plus size={13}/> Add Action
          </button>
        </div>
        {form.actions.map((action, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={action.type} onChange={e => updateAction(i, { ...action, type: e.target.value, value: '' })} style={inputStyle}>
              {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
            </select>
            <ActionValueInput action={action} users={users} onChange={val => updateAction(i, val)}/>
            <button onClick={() => removeAction(i)} style={{
              background: 'var(--danger-bg-subtle)', border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center',
            }}>
              <X size={14}/>
            </button>
          </div>
        ))}
      </div>

      {/* Enabled */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Toggle id="rule-enabled" checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))}/>
        <span style={{ fontSize: '0.9rem', color: form.enabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {form.enabled ? 'Rule enabled' : 'Rule disabled'}
        </span>
      </div>

      {error && (
        <div style={{
          background: 'var(--danger-bg-subtle)', border: '1px solid var(--danger-border-subtle)',
          color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem',
          fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15}/> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn btn-outline" style={{ minWidth: 90 }}>
          Cancel
        </button>
        <button
          id="save-rule"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ minWidth: 130, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : <><CheckCircle size={15}/> Save Rule</>}
        </button>
      </div>
    </div>
  );
}

/* ─── Execution Logs Panel ───────────────────────────────────────────────── */

function LogsPanel({ logs, loading }) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', marginBottom: '1rem' }}>
        <Activity size={18} style={{ color: 'var(--primary)' }}/> Execution Log
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
          (automation_rule:* destinations from the last 20 executions)
        </span>
      </h3>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading logs…</div>
      ) : logs.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          padding: '2rem', textAlign: 'center', color: 'var(--text-muted)',
        }}>
          <Clock size={32} style={{ marginBottom: 8, opacity: 0.4 }}/>
          <div>No automation executions yet.</div>
          <div style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.6 }}>Logs appear here when a rule fires.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map(log => (
            <div key={log.id} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
              alignItems: 'center', gap: '1rem',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', padding: '0.7rem 1.2rem',
            }}>
              <span style={{ color: log.success ? 'var(--success)' : 'var(--danger)' }}>
                {log.success ? <CheckCircle size={16}/> : <XCircle size={16}/>}
              </span>
              <div>
                <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {log.destination}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{log.event_type}</div>
              </div>
              <span style={{
                fontSize: '0.75rem', padding: '2px 8px', borderRadius: 9999,
                background: log.success ? 'var(--success-bg-subtle)' : 'var(--danger-bg-subtle)',
                color: log.success ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600,
              }}>
                {log.status_code ?? '—'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                {new Date(log.created_at).toLocaleTimeString()} · {new Date(log.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function AutomationRules() {
  const [rules, setRules]         = useState([]);
  const [logs, setLogs]           = useState([]);
  const [users, setUsers]         = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingLogs, setLoadingLogs]   = useState(true);
  const [showBuilder, setShowBuilder]   = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await automationService.listRules();
      setRules(res.data ?? []);
    } catch {
      showToast('Failed to load rules', 'error');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await automationService.getLogs(null);
      const all = (res.data?.items ?? []).filter(l =>
        typeof l.destination === 'string' && l.destination.startsWith('automation_rule:')
      );
      setLogs(all);
    } catch {
      // Logs not critical — fail silently
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadLogs();
    userService.list().then(res => setUsers(res.data ?? [])).catch(() => {});
  }, [loadRules, loadLogs]);

  const handleToggle = async (id, enabled) => {
    try {
      await automationService.toggleRule(id, enabled);
      setRules(rs => rs.map(r => r.id === id ? { ...r, enabled } : r));
      showToast(enabled ? 'Rule enabled' : 'Rule disabled');
    } catch {
      showToast('Failed to update rule', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation rule? This cannot be undone.')) return;
    try {
      await automationService.deleteRule(id);
      setRules(rs => rs.filter(r => r.id !== id));
      showToast('Rule deleted');
    } catch {
      showToast('Failed to delete rule', 'error');
    }
  };

  const handleSave = async (form) => {
    const res = await automationService.createRule(form);
    const created = res.data;
    setRules(rs => [created, ...rs]);
    setShowBuilder(false);
    showToast(`Rule "${created.name}" created!`);
  };

  const enabledCount  = rules.filter(r => r.enabled).length;
  const disabledCount = rules.length - enabledCount;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(192,132,252,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(99,102,241,0.35)',
            }}>
              <Zap size={20} color="#818cf8"/>
            </div>
            <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.7rem' }}>Automation Rules</h1>
            <Badge color="#818cf8">
              <Shield size={11}/> Admin Only
            </Badge>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            Configure event-driven rules that automatically trigger notifications, status changes, assignments, and webhooks.
          </p>
        </div>
        <button
          id="open-rule-builder"
          onClick={() => setShowBuilder(true)}
          className="btn btn-primary"
          style={{ flexShrink: 0 }}
        >
          <Plus size={16}/> New Rule
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Rules', value: rules.length, icon: <List size={20}/>, color: '#818cf8' },
          { label: 'Active',      value: enabledCount, icon: <CheckCircle size={20}/>, color: 'var(--success)' },
          { label: 'Disabled',    value: disabledCount, icon: <ToggleLeft size={20}/>, color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: s.color, opacity: 0.8 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Builder form ── */}
      {showBuilder && (
        <div style={{ marginBottom: '1.5rem', animation: 'slideDown 0.2s ease' }}>
          <RuleBuilder
            users={users}
            onSave={handleSave}
            onCancel={() => setShowBuilder(false)}
          />
        </div>
      )}

      {/* ── Rule list ── */}
      {loadingRules ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{
            width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)',
            borderRadius: '50%', margin: '0 auto 1rem',
            animation: 'spin 0.8s linear infinite',
          }}/>
          Loading rules…
        </div>
      ) : rules.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center',
        }}>
          <Zap size={40} style={{ color: 'var(--primary)', opacity: 0.35, marginBottom: 12 }}/>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No automation rules yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Create your first rule to start automating workflows.
          </div>
          <button onClick={() => setShowBuilder(true)} className="btn btn-primary">
            <Plus size={16}/> Create First Rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Logs panel ── */}
      <LogsPanel logs={logs} loading={loadingLogs}/>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: toast.type === 'error' ? 'var(--danger-bg-subtle)' : 'rgba(16,185,129,0.15)',
          border: `1px solid ${toast.type === 'error' ? 'var(--danger-border-subtle)' : 'rgba(16,185,129,0.35)'}`,
          color: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
          borderRadius: 'var(--radius-sm)', padding: '0.75rem 1.25rem',
          fontWeight: 600, fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 9999, animation: 'slideUp 0.2s ease',
        }}>
          {toast.type === 'error' ? <XCircle size={16}/> : <CheckCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
