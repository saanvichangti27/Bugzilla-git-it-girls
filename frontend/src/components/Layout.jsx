import { useState, useEffect } from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { authService, notificationService } from '../api/client';
import { LayoutDashboard, Bug, LogOut, Settings, Bell, Zap } from 'lucide-react';

export default function Layout() {
  const user = authService.getCurrentUser();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const fetchUnreadCount = async () => {
      try {
        const res = await notificationService.count();
        setUnreadCount(res.data?.count || 0);
      } catch (err) {
        console.error('Error fetching unread notification count:', err);
      }
    };

    fetchUnreadCount();
    
    // Poll every 25 seconds
    const interval = setInterval(fetchUnreadCount, 25000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleLogout = () => {
    authService.logout();
    navigate('/auth');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Bug size={24} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.05em' }}>Bugzilla<span style={{color: 'var(--primary)'}}>.</span></h2>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/bugs" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bug size={18} />
            Bug Explorer
          </NavLink>
          <NavLink to="/notifications" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} />
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background: 'var(--primary)',
                color: '#fff',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 700,
                marginRight: '0.5rem',
              }}>
                {unreadCount}
              </span>
            )}
          </NavLink>

          
          {user.role === 'admin' && (
            <NavLink to="/admin" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Zap size={18} />
              Automation
            </NavLink>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
