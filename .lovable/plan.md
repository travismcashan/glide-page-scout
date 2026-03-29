

# Consolidated Plan — Estimate Engine Overhaul

## Part 1: Fix Base Model Calculation — Why It Shows $50K

### Root Cause

Three bugs in `calculateBaseModel()`:

1. **`variable_qty` not reset to minimum** — Tasks like Design Thinking Workshop (qty×1×4 roles), Interviews (qty×2.5), Focus Groups (qty×6×2 roles) keep their current quantities instead of being set to 1. This alone could add 50+ hours.

2. **Filter includes optional selected tasks** — The filter `is_selected && is_required` catches tasks the user has toggled ON that have `is_required: true` but `default_included: false` (e.g., Interviews, Focus Groups, Empathy Map, Scenario Map). The base model should only include tasks that are `default_included: true` — the minimum scope.

3. **DoneDone Management formula is extreme** — `bySizeNum(size, 1, 3, 4.5) * 8` = 8 hours even at Small. This is a QA task that should now be handled by the percentage-based QA phase, but it's getting double-counted (once via formula, once via QA percentage distribution).

### Expected Base Model (corrected)

With vars at 1, size=Small, complexity=Simple, only default_included tasks:
- Strategy: ~20h (fixed size-based tasks + multi-role)
- Design: ~15h (layouts at 1 minimizes most tasks)
- Build: ~37h (fixed complexity floors like Standard Plugins 8h, Custom 4h, Special 6h, Perf 6h + layout-driven at 1)
- Content: ~1h (pages=1, bulk=none)
- Review: ~0.2h
- Optimization: ~11h (301s=2h, SEO=4h, Alt=4h, Resolve=1h)
- PM/QA at 14%: ~12h
- Admin: ~6h

**Total: ~102h × $150 = ~$15,300** — a reasonable floor price.

### Changes for Base Model

- Reset all `variable_qty` to 1 on each task before passing to recalculate
- Filter to `is_required` only (ignore `is_selected`) — base model shouldn't change based on user selections
- Pass `default_included` from master task data through to the tasks array so the base model can filter properly

---

## Part 2: Simplify Engine to 3 Calculation Modes

The current engine has 11 calc_types (`size`, `size_multiplied`, `complexity`, `scope`, `variable`, `percentage`, `conditional`, `form_tiers`, `bulk_import`, `bulk_import_check`, `manual`) which is overengineered. The mental model is just 3 modes:

```text
┌─────────────────────────────────────────────┐
│  1. FIXED      → hours are constant         │
│  2. VARIABLE   → hours scale with a driver  │
│  3. PERCENTAGE → phase gets % of subtotal   │
│                                             │
│  + required/optional flag (default on/off)  │
└─────────────────────────────────────────────┘
```

### Simplified `formula_config` schema

| Type | Config fields | Example |
|------|--------------|---------|
| `fixed` | `hours: 1` | Project Kickoff = 1h always |
| `variable` | `driver: "pages"`, `base: 0.5`, `min: 1` | Sitemap = pages × 0.5h, min 1h |
| `percentage` | `pct: 0.08` | PM phase = 8% of core total |

For **variable** tasks, the `driver` field references a project variable (pages, layouts, personas, forms, custom_posts, etc.). The `base` is hours-per-unit. Optional `min` sets a floor.

Tasks without a `formula_config` (or `calc_type = "fixed"`) just use their `hours_per_person` value as-is.

### Migration mapping

- `size`, `complexity`, `size_multiplied`, `manual`, `conditional` → `fixed` (resolve to their default hours at current settings)
- `scope`, `variable`, `form_tiers`, `bulk_import`, `bulk_import_check` → `variable` (with a driver + base rate)
- `percentage` → `percentage` (unchanged)

### Implementation

1. **Rewrite `estimateFormulas.ts`** — collapse `calculateTaskFromFormula` from ~80 lines of switch/case to ~15 lines handling `fixed`, `variable`, `percentage`
2. **Migrate `formula_config` data** in master_tasks and estimate_tasks
3. **Update `recalculateAllTasks`** — simplify pass logic to 3 paths

---

## Part 3: Task Type Classification

Add a `task_type` column to classify each of the ~130 tasks as one of:

- **task** — internal work (CSS coding, SEO audit, content migration)
- **meeting** — time spent with client (kickoff, design review, strategy workshop)
- **deliverable** — a tangible output (homepage design, clickable prototype, sitemap document)

No duplication of tasks. Each existing task gets classified as what it primarily is. Where naming feels ambiguous, add a verb prefix to clarify (e.g., "Design Homepage" stays a task, "Deliver Homepage Mockup" would be a deliverable — but we're just tagging, not creating new rows).

### Schema change

```sql
ALTER TABLE master_tasks ADD COLUMN task_type text NOT NULL DEFAULT 'task';
ALTER TABLE estimate_tasks ADD COLUMN task_type text NOT NULL DEFAULT 'task';
```

Then UPDATE all ~130 tasks with the correct type.

---

## Part 4: Rate Card Tab (replaces current Formulas tab)

Rebuild `EstimateFormulasTab.tsx` as an editable **Rate Card** — the single source of truth for all estimation logic.

### Columns

| Column | Description |
|--------|-------------|
| Task Name | The task name |
| Type | `task` / `meeting` / `deliverable` badge |
| Phase | Strategy, Design, Build, etc. |
| Calc Mode | `Fixed` / `Variable` / `%` badge |
| Base Hours | For fixed tasks, the hours. For variable, the per-unit rate |
| Driver | For variable tasks: pages, layouts, personas, etc. |
| Min Hours | Floor value for variable tasks |
| Required | Checkbox |
| Default On | Whether it's included by default |

### Controls at top

- PM % input
- QA % input
- Blended hourly rate input

### Filters

- By phase
- By type (task/meeting/deliverable)
- By calc mode (fixed/variable/%)
- Search by name

Edits on this tab update `master_tasks` globally. Per-estimate overrides edit `estimate_tasks` only.

---

## What stays the same

- `is_required` / `default_included` / `is_selected` flags — no change
- Phase structure and task taxonomy — no change
- PM/QA percentage logic — same concept, cleaner code path
- All Tasks tab, Scope tab, Phase Timeline, SOW View — continue working
- Tab location (after SOW View) — no change

## Files to change

- **Migration SQL**: Add `task_type` column, migrate `formula_config` to 3-type format, populate `task_type` values
- **`src/lib/estimateFormulas.ts`**: Simplify engine to fixed/variable/percentage (~200 lines removed)
- **`src/components/estimate/EstimateFormulasTab.tsx`**: Rebuild as editable Rate Card
- **`src/components/estimate/EstimateBuilderCard.tsx`**: Pass `task_type`, rename tab, fix base model filter
- **`src/components/estimate/EstimateTaskRow.tsx`**: Show `task_type` badge

