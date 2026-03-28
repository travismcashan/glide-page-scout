

## Separate Analysis vs. Estimate Modes for Templates & Forms Cards

**Goal**: Analysis tab shows raw data (what exists on the site). Estimate tab shows the AI recommendation tiers (S/M/L) for choosing what goes into the estimate calculation.

### Approach

Add a `mode` prop (`'analysis' | 'estimate'`) to both `TemplatesCard` and `FormsCard`. Default to `'analysis'`.

**When `mode === 'analysis'`:**
- Do NOT auto-trigger AI recommendations
- Hide the S/M/L `ToggleGroup` tier selector
- Hide the AI sparkle badge and reasoning sections
- Hide checkboxes for including/excluding templates
- Show all templates/forms as a flat read-only list (no "recommended" vs "not included" split)

**When `mode === 'estimate'`:**
- Keep all current behavior: auto-trigger AI, show tier toggles, checkboxes, reasoning, etc.

### Files changed

1. **`src/components/TemplatesCard.tsx`**
   - Add `mode?: 'analysis' | 'estimate'` prop (default `'analysis'`)
   - Skip `fetchAiRecommendations` auto-run when mode is `'analysis'`
   - Conditionally hide tier toggle, AI badge, reasoning, checkboxes

2. **`src/components/FormsCard.tsx`**
   - Same `mode` prop and conditional rendering as above

3. **`src/pages/ResultsPage.tsx`**
   - Pass `mode="analysis"` to both cards in the Analysis tab (no change needed since that's the default)
   - Remove `savedTiers`, `onTiersChange`, `onRerunRequest` props from the Analysis tab instances

4. **`src/components/estimate/EstimateBuilderCard.tsx`**
   - Pass `mode="estimate"` to both `TemplatesCard` and `FormsCard` in the Variables tab

