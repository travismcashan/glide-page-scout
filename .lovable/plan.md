

# Fix Base Model Calculation — Why It Shows $50K

## Root Cause

Three bugs in `calculateBaseModel()`:

1. **`variable_qty` not reset to minimum** — Tasks like Design Thinking Workshop (qty×1×4 roles), Interviews (qty×2.5), Focus Groups (qty×6×2 roles) keep their current quantities instead of being set to 1. This alone could add 50+ hours.

2. **Filter includes optional selected tasks** — The filter `is_selected && is_required` catches tasks the user has toggled ON that have `is_required: true` but `default_included: false` (e.g., Interviews, Focus Groups, Empathy Map, Scenario Map). The base model should only include tasks that are `default_included: true` — the minimum scope.

3. **DoneDone Management formula is extreme** — `bySizeNum(size, 1, 3, 4.5) * 8` = 8 hours even at Small. This is a QA task that should now be handled by the percentage-based QA phase, but it's getting double-counted (once via formula, once via QA percentage distribution).

## Expected Base Model (corrected)

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

## Changes

### `src/lib/estimateFormulas.ts` — `calculateBaseModel()`

1. Reset all `variable_qty` to 1 on each task before passing to recalculate
2. Change filter from `is_selected && is_required` to `(t as any).default_included !== false && is_required` — or better, add a `default_included` field to the task type and filter on it
3. Since tasks in the estimate don't carry `default_included`, use a simpler approach: filter by `is_required` only, and force `variable_qty = 1`

### `src/components/estimate/EstimateBuilderCard.tsx`

Pass `default_included` from master task data through to the tasks array so the base model can filter properly. Or: query master tasks for their `default_included` flag.

### Alternative (simpler)

Since base model = "absolute minimum project cost", just:
- Reset variable_qty to 1 on all tasks
- Filter to `is_required` only (ignore `is_selected`)
- This gives the true floor regardless of what the user has toggled

This is the cleaner approach — the base model shouldn't change based on user selections.

