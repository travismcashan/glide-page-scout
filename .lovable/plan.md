

## Content Audit — Template Curation

### Problem
The Level 2 unique template count includes toolkit pages (Privacy Policy, Terms, FAQ, etc.) that would never be custom-designed in a redesign. The count is inflated and the user needs a way to curate which templates actually require custom design work.

### Solution
Add a **"Design" toggle column** to the Level 2 table. Each template row gets a clickable toggle indicating whether it requires custom design. Toolkit templates (Privacy Policy, Terms, Search, 404, etc.) default to **off**; everything else defaults to **on**. The summary count updates to show **"X of Y templates require custom design"**.

### How it works

1. **Add local state** (`excludedTemplates: Set<string>`) to track which templates the user has toggled off. Auto-seed it with known toolkit templates from the existing `TOOLKIT_TEMPLATES` set in `pageTags.ts`.

2. **Add a "Design" column** to the Level 2 table with a small toggle or checkbox per row. Clicking it moves the template in/out of the excluded set.

3. **Update the summary line** to show two numbers: total templates and the filtered "design templates" count (e.g., "14 unique templates, 10 require custom design").

4. **Visual distinction**: Excluded rows get a muted/strikethrough style so it's clear they're not counted toward the design effort.

5. **Persist via callback**: Add an optional `onExcludedChange` prop so the parent can store the exclusion set in the session if desired (future enhancement).

### Files to change
- **`src/components/RedesignEstimateCard.tsx`** — Add `excludedTemplates` state, auto-seed from toolkit detection, add Design column with toggles, update summary, style excluded rows.

### Technical details
- Use the existing `getTemplateCategory()` from `pageTags.ts` to detect toolkit templates for auto-seeding (category === 'toolkit' defaults to excluded).
- The toggle is a simple `Switch` or `Checkbox` component from the existing UI library.
- The summary becomes: `"14 unique templates · 10 custom design · 4 block-built"`.
- Excluded rows render with `opacity-50` and strikethrough on the template name.

