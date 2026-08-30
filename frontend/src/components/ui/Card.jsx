import React from 'react';

export default function Card({ children, title, subtitle, action, style = {}, className = '' }) {
  return (
    <div 
      className={`glass-card ${className}`} 
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        ...style
      }}
    >
      {(title || subtitle || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {title && <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{title}</h3>}
            {subtitle && <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ flexGrow: 1 }}>
        {children}
      </div>
    </div>
  );
}
