import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import BugList from './pages/BugList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="bugs" element={<BugList />} />
          <Route path="admin" element={
            <div style={{color: 'var(--text-muted)'}}>Admin panel coming soon in Phase 2...</div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
