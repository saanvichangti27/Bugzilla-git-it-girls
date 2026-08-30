import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  style = {},
  type = 'button',
  onClick,
  ...props
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--primary)',
          color: '#ffffff',
          border: 'none',
        };
      case 'outline':
        return {
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-main)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
        };
      case 'danger':
        return {
          background: 'var(--danger-bg-subtle)',
          border: '1px solid var(--danger-border-subtle)',
          color: 'var(--danger-400)',
        };
      case 'success':
        return {
          background: 'var(--success-bg-subtle)',
          border: '1px solid var(--success-border-subtle)',
          color: 'var(--success-400)',
        };
      case 'warning':
        return {
          background: 'var(--warning-bg-subtle)',
          border: '1px solid var(--warning-border-subtle)',
          color: 'var(--warning-400)',
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: '0.35rem 0.75rem',
          fontSize: 'var(--text-xs)',
          borderRadius: 'var(--radius-xs)',
        };
      case 'lg':
        return {
          padding: '0.75rem 1.5rem',
          fontSize: 'var(--text-base)',
          borderRadius: 'var(--radius-md)',
        };
      case 'md':
      default:
        return {
          padding: '0.55rem 1.1rem',
          fontSize: 'var(--text-sm)',
          borderRadius: 'var(--radius-sm)',
        };
    }
  };

  const combinedStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.65 : 1,
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    outline: 'none',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={combinedStyles}
      className={`btn ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
