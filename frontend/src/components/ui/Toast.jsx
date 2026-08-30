import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function Toast({ id, message, type = 'info', duration = 3000, onClose }) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const icons = {
    success: <CheckCircle size={20} color="var(--success)" />,
    error: <AlertCircle size={20} color="var(--danger)" />,
    info: <Info size={20} color="var(--primary)" />
  };

  const borders = {
    success: '1px solid rgba(16, 185, 129, 0.3)',
    error: '1px solid rgba(239, 68, 68, 0.3)',
    info: '1px solid rgba(99, 102, 241, 0.3)'
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: borders[type] || borders.info,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '250px',
        maxWidth: '350px',
        pointerEvents: 'auto',
        animation: isClosing ? 'fadeOutRight 0.3s forwards' : 'fadeInRight 0.3s forwards',
        transition: 'all 0.3s ease'
      }}
    >
      <style>
        {`
          @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeOutRight {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(50px); }
          }
        `}
      </style>
      
      <div style={{ flexShrink: 0 }}>
        {icons[type]}
      </div>
      
      <div style={{ flexGrow: 1, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4' }}>
        {message}
      </div>

      <button 
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
