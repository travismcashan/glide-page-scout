

## Add S/M/L Tier Selection to Bulk Content Analysis

### Overview
Add tier-based selection (Small/Medium/Large) to the Bulk Content card in the estimate view, mirroring how Template Analysis works. Each tier controls which content types are included in the estimate:

- **Small**: None (no bulk content migration)
- **Medium**: Blog posts only
- **Large**: Blog posts + CPTs

Checkmarks will indicate which content type groups are included at each tier. The `custom_posts` variable in the estimate will auto-update based on the tier selection.

### Technical approach

**1. Add tier UI to ContentTypesCard (estimate mode)**

- Add a `mode` prop (`'analysis' | 'estimate'`) to `ContentTypesCard`
- When in estimate mode, render S/M/L tier toggle buttons above the content list (same style as TemplatesCard)
- Track `activeTier` state
- Filter displayed content types based on tier:
  - **S**: Show all groups but mark all as "not included" (checkmarks unchecked)
  - **M**: Check only `Post` baseType groups (Blog)
  - **L**: Check both `Post` and `CPT` baseType groups
- Add checkboxes to each content type group header showing included/excluded state

**2. Wire up to EstimateBuilderCard**

- Pass `mode="estimate"` and a new `onTierChange` callback from EstimateBuilderCard to ContentTypesCard
- When tier changes, update the `custom_posts` variable:
  - S → `custom_posts = 0`
  - M → count of Post-type groups (typically 1 for blog)
  - L → count of Post + CPT groups
- Also update `bulk_import_amount` based on total URL count in selected tiers

**3. Add AI reasoning (optional stretch)**

Since the content type data is already classified by the edge function, no additional AI call is needed — the tier logic is deterministic (Post vs CPT baseType). Add a brief static reasoning note per tier explaining what's included.

### Files to modify

| File | Change |
|------|--------|
| `src/components/ContentTypesCard.tsx` | Add `mode` prop, tier toggle buttons, checkbox per group, tier filtering logic |
| `src/components/estimate/EstimateBuilderCard.tsx` | Pass `mode="estimate"` and `onTierChange` callback, update `custom_posts` variable |

### UI behavior

- Tier buttons: `[S] [M] [L]` with labels like "Small · 0 types", "Medium · 1 type", "Large · 3 types"
- Auto-select a default tier based on content (if no CPTs exist, default to M; if CPTs exist, default to L)
- Each content type row gets a checkbox; toggling tier updates which are checked
- Included section expanded by default, "Not Included" collapsed (same pattern as Template Analysis)

