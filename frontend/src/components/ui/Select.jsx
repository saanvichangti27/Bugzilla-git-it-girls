import React, { forwardRef } from 'react';

const Select = forwardRef(({ label, error, options = [], style = {}, className = '', ...props }, ref) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', ...style }}>
      {label && (
        <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`input-field ${className}`}
        style={{
          border: error ? '1px solid var(--danger)' : undefined,
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 1rem top 50%',
          backgroundSize: '0.65rem auto',
          paddingRight: '2.5rem',
          ...props.style
        }}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
