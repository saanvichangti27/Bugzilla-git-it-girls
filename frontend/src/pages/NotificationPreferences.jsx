import { useState, useEffect } from 'react';
import { notificationService } from '../api/client';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import { Bell, Settings, Mail, Check, BellRing, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function NotificationPreferences() {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'preferences'
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const notifRes = await notificationService.list();
      setNotifications(notifRes.data || []);

      const countRes = await notificationService.count();
      setUnreadCount(countRes.data?.count || 0);

      const prefRes = await notificationService.getPreferences();
      setPreferences(prefRes.data || []);
    } catch (err) {
      console.error('Error fetching notification data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Group preferences by event_type and relationship
  const getGroupedPreferences = () => {
    const groups = {};
    preferences.forEach(p => {
      const key = `${p.event_type}::${p.relationship}`;
      if (!groups[key]) {
        groups[key] = {
          event_type: p.event_type,
          relationship: p.relationship,
          in_app: false,
          email: false,
        };
      }
      if (p.channel === 'in_app') {
        groups[key].in_app = p.enabled;
      } else if (p.channel === 'email') {
        groups[key].email = p.enabled;
      }
    });
    return Object.values(groups);
  };

  const handleTogglePreference = (eventType, relationship, channel) => {
    setPreferences(prev =>
      prev.map(p => {
        if (p.event_type === eventType && p.relationship === relationship && p.channel === channel) {
          return { ...p, enabled: !p.enabled };
        }
        return p;
      })
    );
  };

  const handleBulkToggle = (enable) => {
    setPreferences(prev =>
      prev.map(p => ({ ...p, enabled: enable }))
    );
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await notificationService.updatePreferences(preferences);
      alert('Notification preferences saved successfully!');
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      alert('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const formatEventName = (eventType, relationship) => {
    const relationshipNames = {
      reporter: 'Bug I Reported',
      assignee: 'Bug Assigned to Me',
      follower: 'Bug I am Following',
    };
    const eventNames = {
      'bug.created': 'is reported/created',
      'bug.status_changed': 'status changes',
      'bug.resolved': 'is marked resolved',
      'bug.comment_added': 'gets a new comment',
      'bug.assigned': 'is assigned to someone',
    };

    const relStr = relationshipNames[relationship] || relationship;
    const evtStr = eventNames[eventType] || eventType;
    return `When a ${relStr.toLowerCase()} ${evtStr}`;
  };

  const inboxColumns = [
    {
      header: 'NOTIFICATION',
      render: (n) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', opacity: n.read ? 0.6 : 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!n.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-400)', display: 'inline-block' }} />}
            {n.title}
          </div>
          {n.body && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{n.body}</div>}
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {new Date(n.created_at).toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      header: 'TYPE',
      render: (n) => (
        <Badge type="custom" value={n.event_type.replace('bug.', '').replace('_', ' ')}
          style={{ textTransform: 'uppercase', fontSize: '10px', background: 'var(--primary-bg-subtle)', color: 'var(--primary-400)' }} />
      ),
    },
    {
      header: 'ROLE',
      render: (n) => (
        <Badge type="custom" value={n.relationship}
          style={{ textTransform: 'capitalize', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
      ),
    },
    {
      header: 'ACTIONS',
      render: (n) => !n.read ? (
        <Button size="sm" variant="outline" icon={<Check size={14} />} onClick={() => handleMarkRead(n.id)}>
          Mark Read
        </Button>
      ) : (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <Check size={14} style={{ color: 'var(--success-400)' }} /> Read
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  const groupedPrefs = getGroupedPreferences();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontStyle: 'normal', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bell style={{ color: 'var(--primary)' }} /> Notifications
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Manage your in-app alerts, email subscriptions, and notification matrix settings.
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('inbox')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'inbox' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'inbox' ? '#fff' : 'var(--text-muted)',
              borderRadius: 'calc(var(--radius) - 2px)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
          >
            <BellRing size={16} /> Inbox
            {unreadCount > 0 && (
              <span style={{
                background: activeTab === 'inbox' ? '#fff' : 'var(--primary)',
                color: activeTab === 'inbox' ? 'var(--primary)' : '#fff',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === 'preferences' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'preferences' ? '#fff' : 'var(--text-muted)',
              borderRadius: 'calc(var(--radius) - 2px)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
          >
            <Settings size={16} /> Preferences
          </button>
        </div>
      </div>

      {activeTab === 'inbox' ? (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Recent Alerts</h3>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                Mark All as Read
              </Button>
            )}
          </div>

          <Table
            columns={inboxColumns}
            data={notifications}
            emptyMessage="Your inbox is clean! No notifications."
          />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Instructions Alert */}
          <div style={{
            background: 'var(--primary-bg-subtle)',
            border: '1px solid var(--primary-border-subtle)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}>
            <strong>Notification Matrix Settings:</strong> Choose which events trigger in-app alerts or dispatch direct emails via Resend. Make sure to click Save Preferences when done!
          </div>

          {/* Bulk Controls */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
              Enable All Notification Channels
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
              Disable All Notification Channels
            </Button>
          </div>

          {/* Table Matrix */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>EVENT CONDITIONAL</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <Bell size={14} /> IN-APP ALERT
                    </div>
                  </th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <Mail size={14} /> RESEND EMAIL
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedPrefs.map((grp, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>
                      {formatEventName(grp.event_type, grp.relationship)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={grp.in_app}
                        onChange={() => handleTogglePreference(grp.event_type, grp.relationship, 'in_app')}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--primary-400)',
                          cursor: 'pointer',
                        }}
                      />
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={grp.email}
                        onChange={() => handleTogglePreference(grp.event_type, grp.relationship, 'email')}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--primary-400)',
                          cursor: 'pointer',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button
              variant="primary"
              onClick={handleSavePreferences}
              loading={saving}
            >
              Save Preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
