import React from 'react';
import { Search } from 'lucide-react';

export default function EmptyState({ 
  title = "No data found", 
  description = "There is nothing to display here right now.", 
  icon = <Search size={48} color="var(--text-muted)" />,
  action = null
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      textAlign: 'center',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px dashed var(--border)'
    }}>
      <div style={{ marginBottom: '1rem', opacity: 0.5 }}>
        {icon}
      </div>
      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.25rem' }}>
        {title}
      </h3>
      <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', maxWidth: '400px' }}>
        {description}
      </p>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}
