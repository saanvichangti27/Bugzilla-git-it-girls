import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Shield, Activity, AlertTriangle, Clock, Webhook } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import PermissionsManager from '../components/PermissionsManager';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ 
    open_bugs: 0, critical_bugs: 0, avg_resolution_time_hours: 0, 
    webhook_success_rate: 0, trend: [], bugs_by_component: [] 
  });
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, bugsRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/bugs?sort=-created_at')
        ]);
        setStats(statsRes.data.data);
        setBugs(bugsRes.data.data.items);
      } catch (err) {
        console.error("Failed to load admin data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Shield color="var(--primary)" size={28} />
        <h1 className="text-gradient" style={{ margin: 0 }}>Admin Area</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Global system view and configuration.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('analytics')}
          style={{ 
            background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === 'analytics' ? 600 : 400
          }}
        >
          Analytics & Overview
        </button>
        <button 
          onClick={() => setActiveTab('permissions')}
          style={{ 
            background: 'none', border: 'none', padding: '0.75rem 1rem', cursor: 'pointer',
            color: activeTab === 'permissions' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'permissions' ? '2px solid var(--primary)' : '2px solid transparent',
            fontWeight: activeTab === 'permissions' ? 600 : 400
          }}
        >
          Permissions & Workflow
        </button>
      </div>
      
      {activeTab === 'analytics' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Skeleton height="100px" />
              <Skeleton height="100px" />
              <Skeleton height="100px" />
              <Skeleton height="100px" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
              <Skeleton height="350px" />
              <Skeleton height="350px" />
            </div>
            <Skeleton height="300px" />
          </div>
        ) : (
          <>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Total Open Bugs</div>
                  <div className="metric-value">{stats.open_bugs}</div>
                </div>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--primary)' }}>
                  <Activity size={24} />
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Critical Bugs</div>
                  <div className="metric-value">{stats.critical_bugs}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--danger)' }}>
                  <AlertTriangle size={24} />
                </div>
              </div>
            </Card>
            
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Avg Resolution (hrs)</div>
                  <div className="metric-value">{stats.avg_resolution_time_hours}</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--warning)' }}>
                  <Clock size={24} />
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="metric-title">Webhook Success</div>
                  <div className="metric-value">{stats.webhook_success_rate}%</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--success)' }}>
                  <Webhook size={24} />
                </div>
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <Card title="Bugs Opened vs Resolved (Last 7 Days)">
              <div style={{ width: '100%', height: 300, marginTop: '1.5rem' }}>
                <ResponsiveContainer>
                  <LineChart data={stats.trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} 
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Line type="monotone" dataKey="opened" stroke="var(--danger)" strokeWidth={3} dot={{ r: 4 }} name="Opened" />
                    <Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Bugs by Component">
              <div style={{ width: '100%', height: 300, marginTop: '1.5rem' }}>
                <ResponsiveContainer>
                  <BarChart data={stats.bugs_by_component} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Bugs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          
          <Card title="Global Bug Log">
            <div style={{ marginTop: '1rem' }}>
              <Table
                data={bugs}
                columns={[
                  { header: 'Title', accessor: 'title' },
                  { header: 'Status', accessor: row => <Badge status={row.status} /> },
                  { header: 'Severity', accessor: 'severity' },
                  { header: 'Created', accessor: row => new Date(row.created_at).toLocaleDateString() }
                ]}
                emptyMessage="No bugs found in the system."
              />
            </div>
          </Card>
        </>
        )
      )}

      {activeTab === 'permissions' && (
        <PermissionsManager />
      )}
    </div>
  );
}
