import { useState, useEffect } from 'react';
import { api, bugService } from '../api/client';
import { Paperclip, Plus, UserPlus, UserCheck } from 'lucide-react';
import AddBugModal from '../components/AddBugModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';

export default function BugList() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '') : 'http://127.0.0.1:8000';

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bugs');
      setBugs(res.data.data.items || []);
    } catch (err) {
      console.error("Failed to fetch bugs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const handleToggleFollow = async (bugId, isFollowing) => {
    try {
      if (isFollowing) {
        await bugService.unfollowBug(bugId);
      } else {
        await bugService.followBug(bugId);
      }
      fetchBugs();
    } catch (err) {
      console.error("Failed to update follow status", err);
    }
  };

  const columns = [
    {
      header: 'TITLE & ATTACHMENTS',
      accessor: 'title',
      render: (bug) => (
        <div>
          <div style={{ fontWeight: 500 }}>{bug.title}</div>
          {bug.attachments && bug.attachments.length > 0 && (
            <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {bug.attachments.map((att) => {
                const url = att.file_url.startsWith('http') ? att.file_url : `${API_BASE}${att.file_url}`;
                return (
                  <a
                    key={att.id}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: 'var(--primary-bg-subtle)',
                      border: '1px solid var(--primary-border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--primary-400)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <Paperclip size={12} /> {att.file_name}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'STATUS',
      accessor: 'status',
      render: (bug) => <Badge type="status" value={bug.status} />,
    },
    {
      header: 'PRIORITY',
      accessor: 'priority',
      render: (bug) => <Badge type="priority" value={bug.priority} />,
    },
    {
      header: 'COMPONENT',
      accessor: 'component',
      render: (bug) => (
        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {bug.component || '--'}
        </span>
      ),
    },
    {
      header: 'ASSIGNEE',
      accessor: 'assignee',
      render: (bug) =>
        bug.assignee?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>,
    },
    {
      header: 'ACTION',
      align: 'right',
      render: (bug) => (
        <Button
          size="sm"
          variant={bug.is_following ? 'danger' : 'outline'}
          icon={bug.is_following ? <UserCheck size={14} /> : <UserPlus size={14} />}
          onClick={() => handleToggleFollow(bug.id, bug.is_following)}
        >
          {bug.is_following ? 'Stop following' : 'Follow bug'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AddBugModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onBugCreated={() => fetchBugs()}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.2rem' }}>Bug Explorer</h1>
          <p style={{ color: 'var(--text-muted)' }}>Browse, follow issues, and inspect attachments.</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setShowAddModal(true)}>
          Report New Bug
        </Button>
      </div>

      <Table
        columns={columns}
        data={bugs}
        loading={loading}
        emptyMessage="No bugs found. System is clean!"
      />
    </div>
  );
}
