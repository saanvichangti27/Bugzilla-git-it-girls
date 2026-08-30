import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bug, Settings, Bell, LayoutDashboard } from 'lucide-react';
import { api } from '../api/client';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Always show navigation routes
    const navItems = [
      { type: 'nav', title: 'Go to Dashboard', icon: <LayoutDashboard size={18} />, path: '/' },
      { type: 'nav', title: 'Go to Bugs', icon: <Bug size={18} />, path: '/bugs' },
      { type: 'nav', title: 'Go to Notifications', icon: <Bell size={18} />, path: '/notifications' },
      { type: 'nav', title: 'Go to Admin', icon: <Settings size={18} />, path: '/admin' }
    ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

    if (query.trim().length > 2) {
      const searchBugs = async () => {
        try {
          const res = await api.get(`/bugs/search?q=${encodeURIComponent(query)}`);
          const bugItems = res.data.data.map(b => ({
            type: 'bug',
            id: b.id,
            title: b.title,
            icon: <Bug size={18} />
          }));
          setResults([...navItems, ...bugItems]);
        } catch (err) {
          console.error("Search failed in command palette", err);
          setResults(navItems);
        }
      };
      searchBugs();
    } else {
      setResults(navItems);
    }
    setSelectedIndex(0);
  }, [query, isOpen]);

  const handleSelect = (item) => {
    setIsOpen(false);
    if (item.type === 'nav') {
      navigate(item.path);
    } else if (item.type === 'bug') {
      // For now, let's just go to dashboard, in a real app this might open a modal or specific bug page
      // Or maybe the frontend has a bug view route? It doesn't right now, bugs are mostly on Dashboard/BugList modals.
      // So let's just route to /bugs for now, or trigger an event.
      // Actually, since there's no dedicated bug view page, navigating to /bugs is best.
      navigate('/bugs');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh'
      }}
      onClick={() => setIsOpen(false)}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '600px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={20} color="var(--text-muted)" style={{ marginRight: '12px' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search bugs or jump to page..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flexGrow: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '1.1rem'
            }}
          />
        </div>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li 
                    key={item.id || item.path}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      padding: '12px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {item.icon}
                    </span>
                    <span>{item.title}</span>
                    {item.type === 'bug' && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Bug
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> to navigate</span>
          <span><kbd style={kbdStyle}>Enter</kbd> to select</span>
          <span><kbd style={kbdStyle}>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '2px 6px',
  fontFamily: 'monospace',
  fontSize: '0.8rem'
};
