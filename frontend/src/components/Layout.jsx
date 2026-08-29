import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { authService } from '../api/client';
import { LayoutDashboard, Bug, LogOut, Settings } from 'lucide-react';

export default function Layout() {
  const user = authService.getCurrentUser();
  const navigate = useNavigate();

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
          
          {user.role === 'admin' && (
            <NavLink to="/admin" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={18} />
              Admin
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
