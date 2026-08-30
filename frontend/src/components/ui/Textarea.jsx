import React, { forwardRef } from 'react';

const Textarea = forwardRef(({ label, error, style = {}, className = '', ...props }, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', ...style }}>
      {label && (
        <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`input-field ${className}`}
        style={{
          border: error ? '1px solid var(--danger)' : undefined,
          outline: 'none',
          minHeight: '100px',
          resize: 'vertical',
          fontFamily: 'inherit',
          ...props.style
        }}
        {...props}
      />
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
