

# Third-Party Integrations & Cost Factor Analysis

## How It Works in Jessica's XLSX

The XLSX has **three separate Build-phase tasks** related to integrations:

1. **Standard Third Party Plugins + Integrations** — hours based on project complexity (Simple=8, Moderate=10, Complex=12)
2. **Custom Third Party Integrations** — flat 6 hours (no formula, manually adjusted)
3. **Additional Dev Functionality** — flat 100 hours (manually adjusted)

The `Third Party Integrations` variable (page 1, value=4) only drives **project complexity** (Simple/Moderate/Complex), which in turn affects "Standard Third Party Plugins + Integrations" hours. It does NOT directly multiply hours per integration.

## How It Works Now in the App

- `third_party_integrations` variable is auto-populated from Wappalyzer categories (marketing-automation, analytics, CRM, email, payment-processors)
- It feeds `deriveProjectComplexity()`: ≤5 = Simple, ≤10 = Moderate, >10 = Complex
- That complexity only affects "Standard Third Party Plugins + Integrations" (8/10/12 hours) and a few other tasks
- **"Custom Third Party Integrations"** and **"Additional Dev Functionality"** have no formula — they keep their default hours
- The AI Tech Analysis card already breaks scope into: Plugins, Third-Party Integrations, Special Setup — but these counts don't feed back into the estimate variables

## Proposed Approach: Merge & Auto-Populate

### Concept
Merge the Tech Analysis card's **Plugins + Third-Party Integrations + Special Setup** into a single combined count that populates `third_party_integrations`. Then use that count to drive hours for both "Standard" and "Custom" integration tasks.

### Changes

**1. EstimateBuilderCard.tsx — Better auto-population from Tech Analysis**
- When `tech_analysis_data` is available, count items from `scope.plugins` + `scope.thirdPartyIntegrations` + `scope.specialSetup`
- Use that combined count as `third_party_integrations` instead of the Wappalyzer category filter
- Fall back to Wappalyzer count if no tech analysis data exists

**2. estimateFormulas.ts — Add formula for "Custom Third Party Integrations"**
- Currently no formula exists for this task
- Add: hours = `max(0, third_party_integrations - 5) * 2` — meaning standard covers the first ~5, custom covers each additional one at 2 hours each
- Or simpler: scale by complexity like Standard does, e.g. Simple=4, Moderate=6, Complex=10

**3. estimateFormulas.ts — Optionally scale "Additional Dev Functionality"**
- Could tie to complexity: Simple=40, Moderate=80, Complex=120
- Or leave as manual since it's highly project-specific

### Alternative: Keep them separate but visible
If merging feels too aggressive, we could instead:
- Show the Tech Analysis breakdown (Plugins / 3rd Party / Special Setup) as read-only stats in the Variables tab
- Let each count auto-fill separate fields
- Map Plugins → "Standard Third Party Plugins" hours, 3rd Party + Special Setup → "Custom Third Party Integrations" hours

### Recommendation
Go with the merge approach:
- Combined count from Tech Analysis feeds `third_party_integrations`
- "Standard Third Party Plugins + Integrations" stays complexity-based (8/10/12)
- "Custom Third Party Integrations" gets a new formula: `complexity(4, 6, 10)` or `integrations_count * 1.5`
- "Additional Dev Functionality" stays manual (too variable to automate)

This keeps it simple — one number drives complexity which drives both integration task rows, and the Tech Analysis card provides the intelligence to set that number accurately.

### Files to modify
- `src/components/estimate/EstimateBuilderCard.tsx` — use tech_analysis_data for third_party_integrations count
- `src/lib/estimateFormulas.ts` — add formula for "Custom Third Party Integrations"

