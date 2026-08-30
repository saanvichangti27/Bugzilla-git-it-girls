# Design System

This document outlines the design tokens and components used in the Bugzilla Modernization platform.

## Tokens
- **Color:**
  - `--primary`: Main accent color.
  - `--danger`: Error and destructive actions.
  - `--success`: Success states.
  - `--bg-base`: Main background color.
  - `--bg-surface`: Surface background color (cards, modals).
  - `--text-main`: Primary text color.
  - `--text-muted`: Secondary text color.
  - `--border`: Border color.
- **Spacing:**
  - `--space-1`: 4px
  - `--space-2`: 8px
  - `--space-3`: 12px
  - `--space-4`: 16px
  - `--space-5`: 24px
  - `--space-6`: 32px
  - `--space-8`: 48px
- **Radius:**
  - `--radius-sm`: 4px
  - `--radius-md`: 8px
  - `--radius-lg`: 12px
- **Typography:**
  - `--text-xs`: 0.75rem
  - `--text-sm`: 0.875rem
  - `--text-base`: 1rem
  - `--text-lg`: 1.125rem
  - `--text-xl`: 1.25rem
  - `--text-2xl`: 1.5rem

## Components
- **Button:** `<Button variant="primary|outline|ghost|danger" isLoading={false}>`
- **Badge:** `<Badge status="new|in_progress|resolved" />`
- **Table:** `<Table>`
