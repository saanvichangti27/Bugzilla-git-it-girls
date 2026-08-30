import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      navigate(`/bugs?search=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  return (
    <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '300px' }}>
      <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
      <input
        type="text"
        className="input-field"
        placeholder="Search bugs, comments..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ paddingLeft: '32px', width: '100%', borderRadius: 'var(--radius-lg)' }}
      />
    </form>
  );
}
