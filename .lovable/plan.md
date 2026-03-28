

## Tab Restructuring Plan

### Current tabs (6)
Analysis · Prospecting · Prompts · Knowledge · Chat · Estimates

### Proposed tabs (7)
**Analysis** · **Prospecting** · **Knowledge** · **Chat** · **Estimates** · **Roadmap** · **Proposal**

### What changes

1. **Rename** "Site Analysis" → "Analysis" (simple label change in ResultsPage)

2. **Remove Prompts tab** from the top-level tabs. Move it to the Settings page as a "Prompt Library" section. Add a wishlist item for "access prompts from chat input bar" so it's tracked for future build.

3. **Add Roadmap tab** — placeholder content for now (empty state with icon + description). URL slug: `/roadmap`

4. **Add Proposal tab** — placeholder content for now. URL slug: `/proposal`

5. **Update URL routing** in `sessionSlug.ts` — add `roadmap` and `proposal` slugs, remove `prompts` slug (keep backward-compat redirect to analysis)

### Files to modify
- **`src/pages/ResultsPage.tsx`** — rename tab label, remove Prompts TabsTrigger/TabsContent, add Roadmap + Proposal tabs with placeholder content
- **`src/lib/sessionSlug.ts`** — add `roadmap`/`proposal` to slug maps, remove `prompts`
- **`src/pages/SettingsPage.tsx`** — add Prompt Library section (move existing `<PromptLibrary />` component here)

### Tab ordering rationale
Follows the agency workflow: **research** the site (Analysis) → **find contacts** (Prospecting) → **build context** (Knowledge) → **discuss** (Chat) → **scope work** (Estimates) → **plan phases** (Roadmap) → **deliver** (Proposal)

