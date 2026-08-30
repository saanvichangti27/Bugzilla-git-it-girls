import Card from './Card';
import Skeleton from './Skeleton';

export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No items found.',
  rowKey = 'id',
  onRowClick,
  className = '',
  style = {},
}) {
  return (
    <Card className={className} style={{ padding: 0, overflow: 'hidden', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
            {columns.map((col, idx) => (
              <th
                key={col.header || idx}
                style={{
                  padding: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  textAlign: col.align || 'left',
                  width: col.width || 'auto',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length || 1} style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Skeleton height="40px" />
                  <Skeleton height="40px" />
                  <Skeleton height="40px" />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => {
              const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey] || rIdx;
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s ease',
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: '1rem',
                        textAlign: col.align || 'left',
                      }}
                    >
                      {col.render ? col.render(row) : col.accessor ? row[col.accessor] : null}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Card>
  );
}
