

## Connect Page Tiers to Pages for Integration Variable

**Goal**: Add S/M/L tier selection to the RedesignEstimateCard (estimate mode only) that dynamically sets `pages_for_integration` in the project variables.

### Tier Logic (no AI needed)
- **Small**: Primary pages count
- **Medium**: Primary + Secondary
- **Large**: Primary + Secondary + Tertiary

### Approach
Add the same `mode` prop pattern used by TemplatesCard.

### Files changed

1. **`src/components/RedesignEstimateCard.tsx`**
   - Add `mode?: 'analysis' | 'estimate'` prop (default `'analysis'`)
   - Add `onSelectionChange?: (count: number) => void` prop
   - In estimate mode: render S/M/L `ToggleGroup` (same styling as TemplatesCard)
   - Track `activeTier` state; on tier change, compute the sum and call `onSelectionChange`
   - Add "Detected Pages" and "Selected Pages" MetaStats (matching template card pattern)
   - Analysis mode: show all three counts read-only as today, no toggles

2. **`src/components/estimate/EstimateBuilderCard.tsx`**
   - Pass `mode="estimate"` to `RedesignEstimateCard`
   - Wire `onSelectionChange` to update `estimate.pages_for_integration` via `handleVariablesChange`

3. **`src/pages/ResultsPage.tsx`**
   - Ensure analysis tab passes `mode="analysis"` (default) — no functional change needed

### Technical detail
- Tier state stored locally in component (like TemplatesCard), no DB persistence needed beyond the estimate variable
- Default tier on mount: auto-select M (Primary + Secondary) as a sensible default
- The `onSelectionChange` callback fires on tier change with the computed page count

