import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/analytics/overview');
        setData(res.data.data);
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <BarChart3 color="var(--primary)" size={28} />
        <h1 className="text-gradient" style={{ margin: 0 }}>Analytics Overview</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Track bug trends, status distributions, and team velocity.
      </p>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading analytics data...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)' }}>Failed to load data.</div>
      ) : (
        <div className="dashboard-grid">
          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1', height: '400px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>7-Day Activity Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="var(--danger)" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="resolved" stroke="var(--success)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', height: '350px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Status Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', height: '350px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Priority Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.priority_distribution} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar dataKey="value" fill="var(--primary)">
                  {data.priority_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
