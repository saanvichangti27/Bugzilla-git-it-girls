import React from 'react';

export function Table({ children, className = '', style = {} }) {
  return (
    <div className={`glass-panel ${className}`} style={{ overflow: 'hidden', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead>
      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
        {children}
      </tr>
    </thead>
  );
}

export function TableHeader({ children, style = {} }) {
  return (
    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', ...style }}>
      {children}
    </th>
  );
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = '', style = {}, onMouseEnter, onMouseLeave }) {
  return (
    <tr
      className={className}
      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease', ...style }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
        if (onMouseEnter) onMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        if (onMouseLeave) onMouseLeave(e);
      }}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, colSpan, style = {} }) {
  return (
    <td colSpan={colSpan} style={{ padding: '1rem', ...style }}>
      {children}
    </td>
  );
}
