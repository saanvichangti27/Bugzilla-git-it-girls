export default function Badge({
  type = 'status',
  value = '',
  label = null,
  className = '',
  style = {},
}) {
  const normalized = String(value || '').toLowerCase();

  const getStyles = () => {
    switch (normalized) {
      // Statuses
      case 'new':
        return { background: 'var(--primary-bg-subtle)', color: 'var(--primary-400)', border: '1px solid var(--primary-border-subtle)' };
      case 'in_progress':
      case 'in progress':
        return { background: 'var(--warning-bg-subtle)', color: 'var(--warning-400)', border: '1px solid var(--warning-border-subtle)' };
      case 'ready_for_testing':
      case 'being tested':
        return { background: 'var(--info-bg-subtle)', color: 'var(--info-400)', border: '1px solid var(--info-border-subtle)' };
      case 'resolved':
      case 'verified':
        return { background: 'var(--success-bg-subtle)', color: 'var(--success-400)', border: '1px solid var(--success-border-subtle)' };
      case 'closed':
        return { background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(148, 163, 184, 0.3)' };

      // Priorities / Severities
      case 'high':
      case 'critical':
      case 'blocker':
        return { background: 'var(--danger-bg-subtle)', color: 'var(--danger-400)', border: '1px solid var(--danger-border-subtle)' };
      case 'medium':
      case 'major':
        return { background: 'var(--warning-bg-subtle)', color: 'var(--warning-400)', border: '1px solid var(--warning-border-subtle)' };
      case 'low':
      case 'minor':
      case 'trivial':
        return { background: 'rgba(148, 163, 184, 0.15)', color: '#d1d5db', border: '1px solid rgba(148, 163, 184, 0.3)' };

      default:
        return { background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-main)', border: '1px solid var(--border)' };
    }
  };

  const displayText = label || (normalized === 'ready_for_testing' ? 'being tested' : normalized.replace(/_/g, ' '));

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        textTransform: 'capitalize',
        lineHeight: 1.2,
        ...getStyles(),
        ...style,
      }}
      className={`badge ${className}`}
    >
      {displayText}
    </span>
  );
}
