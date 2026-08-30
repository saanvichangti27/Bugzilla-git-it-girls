import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../api/client';
import { Bug, LogIn, UserPlus } from 'lucide-react';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'reporter'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        await authService.login(formData.email, formData.password);
      } else {
        await authService.signup(formData.name, formData.email, formData.password, formData.role);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Authentication failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <Card className="auth-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
              <Bug size={32} />
            </div>
          </div>
          <h2 className="text-gradient">Bugzilla 2.0</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to continue to the dashboard</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: '#f87171', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <Input 
                label="Full Name"
                type="text" 
                placeholder="Jane Doe"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
              />

              <Select 
                label="Role"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                required
                options={[
                  { label: 'Reporter', value: 'reporter' },
                  { label: 'Developer', value: 'developer' },
                  { label: 'Tester', value: 'tester' },
                  { label: 'Admin', value: 'admin' }
                ]}
              />
            </>
          )}
          
          <Input 
            label="Email Address"
            type="email" 
            placeholder="you@example.com"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            required
          />
          
          <Input 
            label="Password"
            type="password" 
            placeholder="••••••••"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
            required
          />
          
          <Button type="submit" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}>
            {isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Create Account</>}
          </Button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); setError(''); }}
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
