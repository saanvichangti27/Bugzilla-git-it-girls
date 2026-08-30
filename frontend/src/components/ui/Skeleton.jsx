import React from 'react';

export default function Skeleton({ width = '100%', height = '1rem', borderRadius = 'var(--radius-md)', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--border) 50%, var(--bg-surface-hover) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style
      }}
    >
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
    </div>
  );
}
