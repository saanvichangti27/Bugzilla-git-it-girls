import { authService } from '../api/client';
import AdminDashboard from './AdminDashboard';
import TesterDashboard from './TesterDashboard';

export default function Dashboard() {
  const user = authService.getCurrentUser();

  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'tester') return <TesterDashboard />;
  
  // Fallback for developer and reporter (which will be merged from Siri's branch)
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h2 className="text-gradient">Welcome, {user?.name}</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        You are logged in as a <strong>{user?.role}</strong>. 
        Your specific dashboard is currently being built in Siri's branch and will appear here once merged.
      </p>
    </div>
  );
}
