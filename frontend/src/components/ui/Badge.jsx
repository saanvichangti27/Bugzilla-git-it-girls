import React from 'react';

export default function Badge({ status, priority, severity, children, className = '', style = {} }) {
  const getBadgeStyle = () => {
    // Status variants
    if (status) {
      const s = status.toLowerCase();
      if (s === 'new') return { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' };
      if (s === 'in_progress') return { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
      if (s === 'ready_for_testing') return { background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee' };
      if (s === 'resolved') return { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' };
      if (s === 'closed') return { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' };
    }
    
    // Priority or Severity variants
    if (priority || severity) {
      const val = (priority || severity).toLowerCase();
      if (val === 'high' || val === 'critical' || val === 'blocker') {
        return { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
      }
      if (val === 'low' || val === 'trivial') {
        return { background: 'rgba(156, 163, 175, 0.2)', color: '#d1d5db' };
      }
      if (val === 'medium' || val === 'minor' || val === 'major') {
        return { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
      }
    }
    
    // Default
    return { background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' };
  };

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.6rem',
    borderRadius: '9999px',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    textTransform: 'capitalize',
    ...getBadgeStyle(),
    ...style
  };

  const content = children || status?.replace(/_/g, ' ') || priority || severity;

  return (
    <span className={`badge ${className}`} style={baseStyle}>
      {content}
    </span>
  );
}
