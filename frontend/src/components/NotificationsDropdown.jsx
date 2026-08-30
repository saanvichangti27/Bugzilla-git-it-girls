import { useState, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { api } from '../api/client';

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data.data);
      } catch (e) {
        console.error("Failed to fetch notifications", e);
      }
    };
    fetchNotifs();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-main)',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.5rem'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: 'var(--danger)',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-panel" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: '350px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 100,
          marginTop: '0.5rem',
          padding: '1rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            Notifications
          </h3>
          
          {notifications.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No notifications</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.map(n => (
                <div key={n.id} style={{
                  padding: '0.75rem',
                  background: n.read ? 'transparent' : 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem', whiteSpace: 'pre-wrap' }}>{n.message}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.read && (
                    <button 
                      onClick={() => markRead(n.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', height: 'fit-content' }}
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
