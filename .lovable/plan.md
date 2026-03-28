

# Smart Estimate Variables: Wire All Data Sources & Show Derived Values

## Summary

Update the estimate formula engine and Variables/Scope tab to:
1. **Weight forms by S/M/L tier** instead of flat count
2. **Weight project complexity** from tech analysis tiers (plugins=1, 3rd-party=2, special=4)
3. **Auto-derive bulk import tier** from Content Types URL counts
4. **Weight content integration** by template complexity (low/med/high per page)
5. **Base 301 redirects** on actual page count instead of project size
6. **Drop accessibility remediation** (this is a redesign — building from scratch)
7. **Add a "Derived Values" bullet list** below the cards in the Variables tab showing every auto-calculated value and its source

No WAVE card needed in the estimate since accessibility remediation is irrelevant for a ground-up redesign.

---

## Technical Details

### 1. New `EstimateVariables` fields (DB migration + types)

Add columns to `project_estimates`:
- `form_count_s integer default 0`
- `form_count_m integer default 0`  
- `form_count_l integer default 0`
- `complexity_score integer default 0` (weighted tech score)

Update `EstimateVariables` interface in `estimateFormulas.ts` to include these.

### 2. Formula changes in `estimateFormulas.ts`

**Forms** — replace flat `forms * 0.5` / `forms * 0.25`:
```
Form Integration: (S * 0.25) + (M * 0.5) + (L * 1.5)
QA Forms:         (S * 0.15) + (M * 0.25) + (L * 0.5)
```

**Project Complexity** — replace raw integration count:
```
score = (plugins * 1) + (thirdParty * 2) + (specialSetup * 4)
Simple ≤ 8, Moderate ≤ 20, Complex > 20
```

**Content Integration** — cross-reference template complexity:
```
Per-page hours: low=0.4, medium=0.8, high=1.2
Fallback to 0.8 if no template data
```

**301 Redirects** — replace size-based with:
```
pages * 0.1, minimum 2h
```

**Bulk Import** — auto-derive tier from content types total URL count (already partially done in `onTierChange`, just ensure it's seeded on create).

### 3. Wire FormsCard tier counts into estimate variables

In `EstimateBuilderCard.tsx`, add a callback from `FormsCard` that passes S/M/L counts. When tiers change, update `form_count_s`, `form_count_m`, `form_count_l` on the estimate and recalculate.

### 4. Wire tech analysis weighted score

The existing `handleTechTierChange` already receives `TechTierCounts`. Extend it to also compute and store the weighted `complexity_score` and use that for `deriveProjectComplexity`.

### 5. "Derived Values" summary list

Add a simple card/section below the integration cards in the Variables tab showing a bullet list of all auto-derived values:

```
Derived from analysis:
- Design Layouts: 7 (from Template Analysis — M tier)
- Pages for Integration: 34 (from Page Analysis)
- Custom Post Types: 3 (from Bulk Content)
- Form Integration Hours: 4.25h (2S × 0.25 + 1M × 0.5 + 2L × 1.5)
- Bulk Import Tier: < 500 (from 312 CPT URLs)
- Project Size: Medium (weighted: 34 pages + 7 layouts + 3 CPTs)
- Project Complexity: Moderate (score: 14 — 6 plugins + 2 third-party + 1 special)
- 301 Redirects: 3.4h (34 pages × 0.1)
```

Each bullet shows the value, the formula, and which card it came from. This ensures nothing is hidden.

### Files to modify

| File | Change |
|------|--------|
| `src/lib/estimateFormulas.ts` | Add form tier fields to `EstimateVariables`, update `deriveProjectComplexity` to use weighted score, update Form Integration / QA Forms / Content Integration / 301 Redirect formulas |
| `src/components/estimate/EstimateBuilderCard.tsx` | Wire FormsCard tier counts, compute weighted complexity score, add Derived Values summary list component below cards |
| `src/components/estimate/EstimateVariablesTab.tsx` | Update to show form tier counts (read-only display from cards) instead of single flat form_count |
| DB migration | Add `form_count_s`, `form_count_m`, `form_count_l`, `complexity_score` columns to `project_estimates` |

