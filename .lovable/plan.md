

# Tech Analysis → Estimate: S/M/L Tier Integration

## Summary

Replace the current merged-count approach with an **S/M/L tier selector** on the Tech Analysis card (like Template Analysis and Bulk Content already have). Each tier includes progressively more integration categories, and the selection drives three separate estimate task rows.

## Tier Definitions

```text
S (Small)  = Plugins only
M (Medium) = Plugins + Third-Party Integrations
L (Large)  = Plugins + Third-Party Integrations + Special Setup
```

## How Tiers Map to Estimate Tasks

| Estimate Task (Build phase)                        | What drives it         | Hours logic                        |
|----------------------------------------------------|------------------------|------------------------------------|
| Standard Third Party Plugins + Integrations        | Plugins count          | Complexity-based (Simple=8, Mod=10, Complex=12) — unchanged |
| Custom Third Party Integrations *(rename concept)* | Third-Party Integrations count | Complexity-based (4 / 6 / 10) |
| Special Setup Integrations *(new task row)*         | Special Setup count    | Complexity-based (6 / 10 / 16) |

- **Complexity** is still derived from `third_party_integrations` (total count of items included at the selected tier).
- At tier S, only plugins count feeds `third_party_integrations`. At M, plugins + 3rd-party. At L, all three.

## Changes

### 1. TechAnalysisCard.tsx — Add S/M/L tier selector + onTierChange callback
- Add an `onTierChange` prop (same pattern as ContentTypesCard)
- Show S/M/L toggle in the card header
- When tier changes, calculate counts per category and call `onTierChange(tier, pluginCount, thirdPartyCount, specialSetupCount, totalIncluded)`
- Tech Analysis suggests a tier based on data, user can override

### 2. EstimateBuilderCard.tsx — Wire up onTierChange from Tech Analysis
- Replace the current `techAnalysisData?.scope` merged-count logic in `crawlDefaults`
- Instead, handle the `onTierChange` callback to set `third_party_integrations` = total items included at that tier
- Store the tier selection (similar to how template tiers work)

### 3. estimateFormulas.ts — Add "Special Setup Integrations" formula
- Add a new regex match for `Special Setup Integrations` with complexity-based hours (6/10/16)
- Keep existing "Standard Third Party Plugins + Integrations" (8/10/12) and "Custom Third Party Integrations" (4/6/10) unchanged

### 4. Database — Add "Special Setup Integrations" master task
- Insert a new row into `master_tasks` in the Build phase, positioned after "Custom Third Party Integrations"
- Default hours: 6, default included: true

### Files to modify
- `src/components/TechAnalysisCard.tsx` — add tier selector + callback
- `src/components/estimate/EstimateBuilderCard.tsx` — wire onTierChange, update crawlDefaults
- `src/lib/estimateFormulas.ts` — add Special Setup formula
- Database migration — insert new master task row

