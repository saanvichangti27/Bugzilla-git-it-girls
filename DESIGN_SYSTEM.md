# Bugzilla Modernization — Design System Documentation

This document describes the design tokens, color scales, typography, and reusable UI components for the Bugzilla Modernization Platform.

---

## 1. Design Tokens (`index.css`)

### Color Scales (Dark Theme Only)
- **Primary Scale (Indigo/Violet)**:
  - `--primary-400` (`#818cf8`): Highlights, active states
  - `--primary-500` / `--primary` (`#6366f1`): Default brand primary button & accent
  - `--primary-600` / `--primary-hover` (`#4f46e5`): Hover state for primary buttons
  - `--primary-bg-subtle` (`rgba(99, 102, 241, 0.15)`): Badge & card pill backgrounds
  - `--primary-border-subtle` (`rgba(99, 102, 241, 0.35)`): Subtle accent borders
- **Success Scale (Emerald)**:
  - `--success-400` (`#34d399`): Resolved badge text & positive indicators
  - `--success-500` (`#10b981`): Success action button background
  - `--success-bg-subtle` (`rgba(16, 185, 129, 0.15)`): Resolved badge background
- **Warning Scale (Amber)**:
  - `--warning-400` (`#fbbf24`): In-progress / duplicate warnings
  - `--warning-500` (`#f59e0b`): Caution buttons & metrics
- **Danger Scale (Rose)**:
  - `--danger-400` (`#f87171`): Stop following / critical badge text
  - `--danger-500` (`#ef4444`): Danger action button background
- **Info Scale (Cyan)**:
  - `--info-400` (`#22d3ee`): Ready for testing / being tested indicators

### Spacing System
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-7`: `32px`
- `--space-8`: `48px`

### Typography Scale
- `--text-xs`: `0.75rem` (12px)
- `--text-sm`: `0.875rem` (14px)
- `--text-base`: `1rem` (16px)
- `--text-lg`: `1.125rem` (18px)
- `--text-xl`: `1.25rem` (20px)
- `--text-2xl`: `1.5rem` (24px)
- `--text-3xl`: `2rem` (32px)

---

## 2. Core UI Components (`frontend/src/components/ui/`)

### `<Button>`
Universal button component supporting variants, sizes, loading state, and icon slots.

```jsx
import Button from '../components/ui/Button';

// Primary with Icon
<Button variant="primary" icon={<Plus size={16} />}>Report New Bug</Button>

// Outline with Loading state
<Button variant="outline" loading={isSubmitting}>Submit</Button>

// Small Danger Button
<Button variant="danger" size="sm">Delete</Button>
```

#### Props:
- `variant`: `'primary' | 'outline' | 'ghost' | 'danger' | 'success'` (default: `'primary'`)
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `loading`: `boolean` (displays animated spinner and disables button)
- `icon`: `ReactNode` (leading icon)
- `disabled`: `boolean`

---

### `<Badge>`
Theme-aware badge component automatically mapping bug statuses, priorities, and severities to consistent token colors.

```jsx
import Badge from '../components/ui/Badge';

<Badge type="status" value="in_progress" />
<Badge type="priority" value="critical" />
<Badge type="severity" value="blocker" />
```

#### Props:
- `type`: `'status' | 'priority' | 'severity' | 'custom'`
- `value`: `string` (e.g. `'new'`, `'in_progress'`, `'ready_for_testing'`, `'resolved'`, `'critical'`, `'high'`, etc.)

---

### `<Table>`
Standardized glassmorphism table component with prop-driven headers, data rows, loading skeletons, and empty state rendering.

```jsx
import Table from '../components/ui/Table';

const columns = [
  { header: 'Title & Attachments', accessor: 'title' },
  { header: 'Status', accessor: 'status', render: (row) => <Badge type="status" value={row.status} /> },
  { header: 'Action', align: 'right', render: (row) => <Button size="sm">View</Button> }
];

<Table columns={columns} data={bugs} loading={isLoading} emptyMessage="No bugs found." />
```

#### Props:
- `columns`: `Array<{ header: string, accessor?: string, render?: (row) => ReactNode, align?: 'left' | 'center' | 'right' }>`
- `data`: `Array<object>`
- `loading`: `boolean`
- `emptyMessage`: `string`
