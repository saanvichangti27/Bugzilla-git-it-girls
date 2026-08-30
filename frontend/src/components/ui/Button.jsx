import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  style = {},
  ...props
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    fontSize: 'var(--text-sm)',
    opacity: (disabled || isLoading) ? 0.7 : 1,
  };

  const variants = {
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'white',
    },
    outline: {
      background: 'transparent',
      border: '1px solid var(--border)',
      color: 'var(--text-main)',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
    }
  };

  const combinedStyle = { ...baseStyle, ...variants[variant], ...style };

  return (
    <button
      className={`btn btn-${variant} ${className}`}
      style={combinedStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
}
