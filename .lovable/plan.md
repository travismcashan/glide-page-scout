

# Rebuild Estimator from Jessica's XLSX

## What Changes

### Database Schema

**Modify `master_tasks`** — add columns:
- `roles` text (comma-separated, e.g. "PM, UXA, CL")
- `hours_per_person` numeric (hours each person spends)
- `variable_label` text nullable (e.g. "Hours", "Sessions", "Interviews")
- `default_variable_qty` integer nullable (default quantity when variable applies)
- Keep `default_hours` as the calculated total (hours_per_person × role_count)

**Modify `estimate_tasks`** — add columns:
- `roles` text
- `hours_per_person` numeric
- `variable_label` text nullable
- `variable_qty` integer nullable

**Re-seed reference data:**
- Delete and re-insert `project_phases` with the 12 XLSX phases (Project Management, Onboarding, Strategy, Design, Build, Content, Optimization, Review, QA, Launch, Post Launch, Check)
- Delete and re-insert `team_roles` with the 12 XLSX roles (Sales, PM, UXA, SEO, Web Strategist, CL, Designer, Writer, Content Strategist, Content Coordinator, Tech Lead, Dev) plus their hourly rates
- Delete and re-insert `master_tasks` with all ~128 tasks from the XLSX, including roles, hours/person, total, variable info, and default selected (TRUE/FALSE)

### UI Overhaul

**EstimateTaskRow** — show:
- Checkbox (selected/not)
- Task name
- Roles badges
- Hours/Person input
- Total hours (auto-calculated: hrs/person × roles OR hrs/person × variable_qty)
- Variable quantity input when task has a variable

**EstimateBuilderCard** — add two new tab views:
- **Phase Timeline** — table showing each phase with total hours, estimated weeks (low = hours/8, high = hours/6), cumulative timeline
- **SOW View** — filtered list showing only selected (TRUE) tasks, grouped by phase, formatted for client presentation

**Summary sidebar** — add:
- Work weeks estimate (low/high range)
- Project budget total

### Formula Engine

Update `estimateFormulas.ts`:
- Total hours calculation: if task has variable, total = hours_per_person × variable_qty × role_count; otherwise total = hours_per_person × role_count
- Phase weeks calculation: low = phase_hours / 8, high = phase_hours / 6

## Files Modified

| File | Change |
|------|--------|
| Migration SQL | Add columns to master_tasks + estimate_tasks |
| Seed SQL (insert) | Re-seed phases, roles, and ~128 master tasks |
| `EstimateTaskRow.tsx` | Multi-role display, hours/person, variable qty |
| `EstimateBuilderCard.tsx` | Phase Timeline tab, SOW tab, enhanced summary |
| `EstimateVariablesTab.tsx` | Unchanged (still drives variable-based formulas) |
| `estimateFormulas.ts` | Updated calculation: hrs/person × roles × variable |

## What's Preserved

- Variables tab and auto-fill from crawl data
- Save/load estimates to database
- By Phase and By Role grouping tabs
- Recalculate button

