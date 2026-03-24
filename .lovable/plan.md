

## Unified Data List Design System

### Problem
Four components display URL/page lists with inconsistent patterns:
- **Navigation Structure**: `bg-muted/20` container, inline header row, tree items with no scroll container
- **XML Sitemaps**: `bg-card` (white) container, clickable rows act as headers, expanded content in `bg-muted/30`
- **Discovered URLs**: `bg-card` table with sticky `bg-muted/80` thead, inside tabs
- **Repeating Content**: Grid-based layout, no bg on header, expanded rows in `bg-muted/10`

### Unified Pattern

Every data list will follow this structure:

```text
┌─────────────────────────────────────────────┐
│  Sticky header row (bg-muted/80)            │  <- consistent across all
│  Column1  |  Column2  |  Column3            │
├─────────────────────────────────────────────┤
│  Data rows (bg-card, hover:bg-muted/30)     │
│  ...                                        │
│  Expandable section (bg-muted/20)           │  <- when needed
│  ...                                        │
└─────────────────────────────────────────────┘
```

**Design tokens (shared)**:
- **Container**: `rounded-lg border border-border bg-card overflow-hidden`
- **Header row**: `sticky top-0 bg-muted/80 backdrop-blur-sm` with `text-xs font-medium text-muted-foreground` and `px-3 py-1.5`
- **Data rows**: `border-t border-border hover:bg-muted/30 transition-colors` with `px-3 py-1.5`
- **Expanded sub-rows**: `bg-muted/20 border-t border-border`
- **Text**: `text-xs font-mono leading-5 text-muted-foreground` for all URLs/titles
- **Max height**: `max-h-[300px] overflow-y-auto` on scroll containers

### Files to Change

1. **`src/components/NavStructureCard.tsx`**
   - Replace the per-section `border border-border rounded-lg bg-muted/20` with `bg-card`
   - Use the shared header style (`bg-muted/80 backdrop-blur-sm`) for the column headers
   - Wrap tree content in a scrollable container matching discovered URLs

2. **`src/components/SitemapCard.tsx`**
   - Add a sticky header row (Sitemap | Label | URLs) above the expandable rows
   - Change parent row bg to match data row pattern (no special white treatment)
   - Change expanded URL list bg from `bg-muted/30` to `bg-muted/20`

3. **`src/components/UrlDiscoveryCard.tsx`**
   - Already closest to the target pattern; minor tweaks to ensure header uses `bg-muted/80 backdrop-blur-sm` consistently (already does)
   - Confirm row padding matches `px-3 py-1.5`

4. **`src/components/ContentTypesCard.tsx`**
   - Replace grid-based layout with `<table>` or keep grid but apply shared container/header styles
   - Header: `bg-muted/80 backdrop-blur-sm` instead of bare border-b
   - Expanded section: `bg-muted/20` instead of `bg-muted/10`

5. **`src/components/content-types/ExpandableUrlRows.tsx`**
   - Ensure row padding and hover styles match the shared pattern (`px-3 py-1.5`, `hover:bg-muted/30`)

### Summary of Visual Consistency

| Element | Before (mixed) | After (unified) |
|---------|----------------|-----------------|
| Container bg | `bg-muted/20`, `bg-card`, none | `bg-card` everywhere |
| Header bg | `border-b`, `bg-muted/80`, none | `bg-muted/80 backdrop-blur-sm` |
| Row hover | `hover:bg-muted/50`, `/30` | `hover:bg-muted/30` |
| Expanded bg | `bg-muted/10`, `/30` | `bg-muted/20` |
| Text style | mixed sizes/fonts | `text-xs font-mono leading-5` |
| Row padding | mixed | `px-3 py-1.5` |

