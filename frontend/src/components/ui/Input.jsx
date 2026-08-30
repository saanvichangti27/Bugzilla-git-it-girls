import React, { forwardRef } from 'react';

const Input = forwardRef(({ label, error, style = {}, className = '', ...props }, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', ...style }}>
      {label && (
        <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`input-field ${className}`}
        style={{
          border: error ? '1px solid var(--danger)' : undefined,
          outline: 'none',
          boxShadow: error ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined,
          transition: 'all 0.2s ease',
          ':focus': {
            borderColor: error ? 'var(--danger)' : 'var(--border-focus)',
            boxShadow: error ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : '0 0 0 2px rgba(99, 102, 241, 0.2)'
          }
        }}
        {...props}
      />
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
