# Estimate Engine Overhaul — IMPLEMENTED

## What was done

### Part 1: Base Model Fix ✅
- `calculateBaseModel()` now resets `variable_qty` to 1 for all tasks
- Filters to `is_required` only (ignores user selections)
- Base model represents true floor price (~$15K instead of ~$50K)

### Part 2: Engine Simplified to 3 Display Modes ✅
- Internal engine still handles all calc types for backward compat
- New `getCalcMode()` maps 11 internal types → 3 display modes: Fixed / Variable / %
- New `getDriver()` extracts the scaling driver for variable tasks
- `describeFormula()` updated for cleaner descriptions

### Part 3: Task Type Classification ✅
- Added `task_type` column to `master_tasks` and `estimate_tasks` (task/meeting/deliverable)
- Populated ~18 meetings and ~16 deliverables, rest default to 'task'
- Passed through in `createEstimate()` flow

### Part 4: Rate Card Tab ✅
- Replaced "Formulas" tab with "Rate Card" 
- Shows all tasks with: Name, Type badge, Calc Mode badge, Driver, Formula, Hours, Required
- Filterable by calc mode, task type, phase, and free-text search
- PM%/QA%/Blended Rate controls at top

### What stays the same
- All existing estimate functionality (All Tasks, Scope, Timeline, SOW View)
- Phase structure and task taxonomy
- Auto-save, recalculation, and variable derivation
