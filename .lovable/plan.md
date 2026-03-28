
Fix the Bulk Content estimate card so it matches what you described, not what was previously added.

1. Remove the mistaken section-level behavior
- In `src/components/ContentTypesCard.tsx`, remove the estimate-mode “Included Content Types” / “Content Types Not Included” section wrappers that were added.
- Keep the tier logic itself, but stop treating those as the thing that gets its own show-more UI.

2. Add show more/show less where it actually belongs
- The real missing behavior is inside each expanded content-type row, where URLs are listed.
- Update `src/components/content-types/ExpandableUrlRows.tsx` so each content-type’s URL list:
  - shows only the first 5 rows by default
  - keeps the inner area scrollable
  - shows a fade at the bottom when collapsed
  - has a `Show all X` / `Show less` control
- This matches your note: “you can still scroll inside each even with the show more and show less.”

3. Keep the existing bulk content structure simple
- In estimate mode, keep the bulk content card as a flat list of content types with tier-based included/excluded checkmarks.
- Do not add extra Included/Not Included section headers unless they are already truly required elsewhere.
- Preserve the tier selection behavior (`S/M/L`) and estimate variable updates.

4. Align visuals with the template/page cards
- Use the same truncation pattern already used elsewhere:
  - 5 visible rows by default
  - bottom fade overlay
  - centered toggle button
  - no auto-expansion on load
- Make sure the section header itself can stay expanded/open independently from the inner “show more” state.

5. Verify the edge cases in implementation
- No toggle should appear when a content type has 5 or fewer URLs.
- Included and excluded rows should both use the same inner URL-list truncation behavior.
- The collapsed/expanded state of the card section should remain separate from the show-more/show-less state.
- Avoid changing hook order or conditional hook placement to prevent the React runtime error you hit earlier.

Technical details
- Primary files:
  - `src/components/ContentTypesCard.tsx`
  - `src/components/content-types/ExpandableUrlRows.tsx`
- Likely code changes:
  - `ExpandableUrlRows` gets local `expanded` state plus `LIMIT = 5`
  - wrap the URL rows in a scrollable container with max height when collapsed
  - add fade overlay near the bottom and a toggle button below
  - simplify estimate rendering in `ContentTypesCard` so it no longer uses the wrong section-level expander pattern

Expected result
- On Estimates → Bulk Content, each content type can be expanded as before.
- Inside that expanded content type, if there are more than 5 URLs, you’ll see the fade and `Show all / Show less`.
- The list still scrolls while collapsed.
- No extra “Included / Not Included” section behavior pretending to be the fix.

<lov-actions>
<lov-suggestion message="Test the bulk content card end-to-end on the estimate tab and confirm each expanded content type now has its own fade and Show all/Show less behavior">Verify that it works</lov-suggestion>
<lov-suggestion message="Also make each content type’s Show all/Show less state remember itself while I stay on the estimate page">Remember per-type expansion</lov-suggestion>
<lov-suggestion message="Apply the same inner Show all/Show less behavior to any other estimate cards that still expand long URL lists without the fade treatment">Standardize estimate expanders</lov-suggestion>
</lov-actions>
