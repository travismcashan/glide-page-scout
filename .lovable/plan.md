

## Meta Stats Design System Unification

### Problem
Each integration card uses a different style for its summary/meta row:
- **SitemapCard**: Badge capsules (`Badge variant="secondary"`)
- **BrokenLinksCard**: Colored icons + `text-sm` numbers + Badge capsule for total
- **SchemaCard**: Multiple Badge capsules (outline, secondary, destructive variants)
- **SemrushCard**: Large grid stat boxes (`text-lg font-semibold`) + Badge capsules for backlinks
- **NavStructureCard, ContentTypesCard, RedesignEstimateCard, TemplatesCard**: Already use the inline text pattern (`<strong>N</strong> Label · <strong>N</strong> Label`)

### Standardized Pattern
Adopt the inline text pattern as the universal meta style since it's already the most common:

```text
<strong class="text-foreground">35</strong> Total Unique Links · <strong>text-foreground">20</strong> Primary
```

Container: `flex items-center gap-3 flex-wrap text-xs text-muted-foreground`
Numbers: `<strong className="text-foreground">{value}</strong>`
Separators: `<span>·</span>`
Labels: Title Case, plain text

### Cards to Update

1. **SitemapCard** (lines 50-63) — Replace Badge capsules with inline text stats: `<strong>3</strong> Sitemaps · <strong>1,200</strong> Total URLs · <strong>5</strong> Content Type Hints`

2. **BrokenLinksCard** (lines 74-93) — Replace colored-icon summary with inline text stats: `<strong>45</strong> OK · <strong>3</strong> Redirects · <strong>2</strong> Broken · <strong>50</strong> Checked`. Keep the progress bar below as-is (it's a visual element, not meta text).

3. **SchemaCard** (lines 30-61) — Replace Badge capsules with inline text stats: `<strong>5</strong> Schemas Found · <strong>3</strong> JSON-LD · <strong>1</strong> Microdata · <strong>2</strong> Errors · <strong>1</strong> Warning`. For error/warning counts, keep the text colored (text-destructive / text-yellow-600) but use inline text, not badges.

4. **SemrushCard** (lines 59-91) — Replace the title row ("SEMrush Domain Analysis") and large grid stat boxes with inline text meta: `<strong>1,234</strong> Organic Keywords · <strong>5,678</strong> Organic Traffic · <strong>50</strong> Paid Keywords · <strong>1,000</strong> Rank`. Replace the backlinks Badge row with inline text: `<strong>10,000</strong> Backlinks · <strong>500</strong> Domains · <strong>8,000</strong> Follow · <strong>2,000</strong> Nofollow`.

### Cards Already Consistent (no changes needed)
- NavStructureCard
- ContentTypesCard
- RedesignEstimateCard
- TemplatesCard

### Files to Edit
- `src/components/SitemapCard.tsx`
- `src/components/BrokenLinksCard.tsx`
- `src/components/SchemaCard.tsx`
- `src/components/SemrushCard.tsx`

