

## Redesign Page Analysis Card for Estimate Tab

**Goal**: Replace the current summary-only Content Audit card on the Estimate tab with a new "Page Analysis" card that shows actual page URLs grouped under collapsible Primary / Secondary / Tertiary headers with per-page checkboxes. S/M/L tier toggles bulk-select/deselect pages across groups.

### How it works

- **Primary section**: Lists actual URLs from `navStructure.primary` (top-level nav items with URLs)
- **Secondary section**: Lists URLs from children of primary nav items
- **Tertiary section**: All remaining URLs from `pageTags` not in primary or secondary sets
- Each section is a collapsible header showing a checkbox (select all in group) + count badge
- Inside each section: scrollable list capped at **5 visible rows** with overflow scroll
- Each row has a checkbox + truncated URL path
- **S/M/L toggle**: Small checks only Primary, Medium checks Primary + Secondary, Large checks all three — toggling updates the checkboxes visually and vice-versa (manual checkbox changes can put you in a "Custom" state)
- Header MetaStats: "Detected Pages" and "Selected Pages" (selected = checked count)
- `onSelectionChange` fires with the count of checked pages → drives `pages_for_integration` variable

### Files changed

1. **`src/components/RedesignEstimateCard.tsx`** — Major rewrite for estimate mode only:
   - Build three URL lists from `navStructure` + `pageTags` (primary URLs, secondary URLs, tertiary = remainder)
   - Track a `Set<string>` of selected URLs as state
   - Render collapsible sections with checkboxes per URL row, each section capped at 5 rows with `max-h` + `overflow-y-auto`
   - S/M/L toggle updates the selected set; manual checkbox changes update the set independently
   - Analysis mode (`mode='analysis'`) stays unchanged — same summary view as today

2. **`src/components/estimate/EstimateBuilderCard.tsx`** — Rename the SectionCard title from "Content Audit" to "Page Analysis" for the estimate tab instance

3. No changes to `ResultsPage.tsx` — analysis tab keeps "Content Audit" name and current behavior

### UI structure (estimate mode)

```text
┌─ Page Analysis ──────────────────────────┐
│ Detected Pages: 47    Selected Pages: 12 │
│ [Small] [Medium] [Large]                 │
│                                          │
│ ▼ ☑ Primary (6)                          │
│ ┌──────────────────────────────────┐     │
│ │ ☑ /about                         │     │
│ │ ☑ /services                      │     │
│ │ ☑ /work                          │     │
│ │ ☑ /blog                          │     │
│ │ ☑ /contact                       │     │
│ │  (scrollable if >5)              │     │
│ └──────────────────────────────────┘     │
│ ▼ ☑ Secondary (6)                        │
│ ┌──────────────────────────────────┐     │
│ │ ☑ /services/web-design           │     │
│ │ ...                              │     │
│ └──────────────────────────────────┘     │
│ ▶ ☐ Tertiary (35)  [collapsed]           │
└──────────────────────────────────────────┘
```

### Technical details
- URL lists derived at render time via `useMemo` from existing `navStructure` and `pageTags` props — no new data fetching
- Checkbox state stored as `useState<Set<string>>` initialized based on default tier (M = primary + secondary)
- Tier toggle is a convenience shortcut; manual checkbox edits are preserved until a tier button is clicked again
- Each scrollable sub-list uses `max-h-[140px] overflow-y-auto` (~5 rows at current row height)

