import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import BugList from './pages/BugList';
import NotificationPreferences from './pages/NotificationPreferences';
import AutomationRules from './pages/AutomationRules';
import { authService } from './api/client';
import { ToastProvider } from './contexts/ToastContext';

function AdminRoute({ children }) {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="bugs" element={<BugList />} />
            <Route path="notifications" element={<NotificationPreferences />} />
            <Route path="admin" element={
              <AdminRoute>
                <AutomationRules />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
