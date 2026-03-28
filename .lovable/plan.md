

# Add `is_required` Column and Task Type Column to All Tasks Table

## Context

The Excel master list has a "SOW" checkbox column where formula-driven tasks are locked (required — can't be unchecked). We need to replicate this behavior and add a visible "Type" column showing the calculation method for each task.

## What Changes

### 1. Database Migration

Add `is_required` boolean column to both `master_tasks` and `estimate_tasks`:

```sql
ALTER TABLE public.master_tasks ADD COLUMN is_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.estimate_tasks ADD COLUMN is_required boolean NOT NULL DEFAULT false;
```

### 2. Seed Required Tasks

Based on the formula engine in `estimateFormulas.ts`, every task that matches `isFormulaTask()` is formula-driven and should be marked `is_required = true`. This covers ~60 tasks across all phases including:
- Project Management: Timeline, KOC Prep, Admin Hours
- Strategy: Current Site Review, Content Inventory, Content Audit, Competitor Review, SEO Insights, etc.
- Design: Client Design Review, Internal Page SFs/Layouts, Responsive, Revisions, etc.
- Build: CSS/HTML/JS, WordPress Development, Performance Optimization, Quality Assurance, etc.
- Content: Content Integration, Bulk Import, Form Integration, etc.
- QA: DoneDone Management, Proof Reading, QA Forms
- Optimization: 301 Redirect Setup, Technical On-Page SEO, etc.

All non-formula tasks remain `is_required = false` (optional/toggleable).

### 3. Add Task Calc Type Function (`estimateFormulas.ts`)

New exported function `getTaskCalcType(taskName)` that returns one of:
- `"size"` — Size-based (S/M/L)
- `"complexity"` — Complexity-based
- `"variable"` — Variable × rate (qty-driven)
- `"scope"` — Scope-variable-driven (layouts, pages, personas, etc.)
- `"percentage"` — Percentage-based (Admin Hours)
- `"conditional"` — Conditional/lookup (paid discovery, bulk import settings)
- `"manual"` — Manually editable (no formula match)

This maps every task in `calculateTaskFromXlsx` to its category.

### 4. Update `EstimateTask` Interface (`EstimateTaskRow.tsx`)

Add `is_required?: boolean` to the interface.

### 5. Update `EstimateTaskTable.tsx`

- Add a "Type" column showing the calc type badge (color-coded, abbreviated)
- For `is_required` tasks: checkbox is checked + `disabled` + gray styling
- Ensure `is_required` tasks can never be unchecked regardless of user interaction

### 6. Update `EstimateTaskRow.tsx`

Same `is_required` checkbox behavior for the card view.

### 7. Update `EstimateBuilderCard.tsx`

- When creating estimates from master tasks, copy `is_required` into estimate tasks
- When toggling, skip if `is_required` is true
- Pass `is_required` through to table/row components

## Technical Details

The Type column badges will use short labels and subtle colors:

| Type | Label | Color |
|------|-------|-------|
| size | Size | blue |
| complexity | Cmplx | purple |
| variable | Var | amber |
| scope | Scope | green |
| percentage | % | orange |
| conditional | Cond | teal |
| manual | Manual | gray |

