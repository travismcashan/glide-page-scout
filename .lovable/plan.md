

# Rethinking the Estimate Model: Base Cost + Percentage Phases

## The Insight

Right now every task has its own formula, but conceptually there are really three categories:

### 1. Base Tasks (Fixed Cost Floor)
Tasks that happen on every project regardless of size. If you set every variable to 1, these are your floor. Examples:
- Strategy Workshop (KOC): 0.5-1.5h
- Strategy Review: 0.5-1h
- Toolkit Outline: 0.5-1.5h
- Heuristic Evaluation: 0.5h
- Many size-based tasks at their "Small" value

The base model = sum of all required tasks calculated with minimum variables. This gives you the "it costs at least $X to do any project" number.

### 2. Scaling Tasks (Variable-Driven)
Tasks whose hours grow with layouts, pages, personas, forms, etc. These are the meat of the estimate — CSS/HTML/JS, WordPress Dev, Content Integration, etc. The difference between a $50K and $150K project lives here.

### 3. Percentage Phases (PM & QA)
PM and QA work scales with project size, but it's really proportional to the total effort, not to any single variable. Currently:
- **Admin Hours** is already 6% of total (percentage model)
- **DoneDone Management** uses `bySizeNum * 8` which is a rough proxy
- **QA tasks** (QA Forms, Proof Reading) scale with pages/forms individually
- **PM tasks** (Timeline, KOC Prep) use size buckets

Converting PM and QA to percentage-of-subtotal would be simpler and more accurate.

## Proposed Changes

### 1. Add percentage-based phase calculation

Instead of individual task formulas for PM and QA phases, calculate each phase as a percentage of the "core work" subtotal (Strategy + Design + Build + Content + Optimization hours):

| Phase | Percentage | Rationale |
|-------|-----------|-----------|
| Project Management | ~8-10% | Includes Timeline, KOC, Admin Hours |
| QA | ~6-8% | Includes DoneDone, Proof Reading, QA Forms |

The individual tasks within PM/QA would still exist in the task list, but their hours would be distributed proportionally (or the phase total is set and tasks within are weighted shares of it).

### 2. Expose the "Base Model" concept

Add a derived value or info card showing the **minimum project cost** — calculated by running every required/formula task with all variables at their smallest meaningful value (layouts=1, pages=1, personas=1, etc.). This gives the user a clear floor price.

### 3. Update `estimateFormulas.ts`

- New function: `calculatePhaseAsPercentage(phaseName, coreSubtotal)` that returns total hours for PM or QA
- Modify `recalculateAllTasks` to do a multi-pass: (1) calculate core phases, (2) calculate PM/QA as percentages, (3) distribute PM/QA hours across their constituent tasks
- New function: `calculateBaseModel(variables)` that computes the floor cost with minimum inputs

### 4. Update Variables/Scope UI

- Add a "Base Model" display showing the minimum project cost
- Add PM % and QA % as editable variables (defaulting to 8% and 6%) so the user can tune them
- Keep individual PM/QA tasks visible but mark them as "phase-distributed"

## Technical Detail

```text
Pass 1: Calculate Strategy + Design + Build + Content + Optimization
         ↓ core_subtotal
Pass 2: PM_hours = core_subtotal × pm_percentage
         QA_hours = core_subtotal × qa_percentage
Pass 3: Distribute PM_hours across PM tasks (weighted by current ratios)
         Distribute QA_hours across QA tasks (weighted by current ratios)
Pass 4: Admin Hours = total × 6% (stays as-is, or folds into PM%)
```

### Files Changed

| File | Change |
|------|--------|
| `estimateFormulas.ts` | Add `calculatePhaseAsPercentage()`, `calculateBaseModel()`, update `recalculateAllTasks` for multi-pass |
| `EstimateVariablesTab.tsx` | Add PM % and QA % sliders/inputs |
| `EstimateBuilderCard.tsx` | Pass new percentage variables through, add base model calculation |
| DB migration | Add `pm_percentage` (default 8) and `qa_percentage` (default 6) columns to `project_estimates` |
| Scope tab UI | Add "Base Model" display card showing floor cost |

