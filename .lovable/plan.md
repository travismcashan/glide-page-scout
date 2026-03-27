

## Results Page: Compact Header Redesign

### Problem
The current results page stacks AppHeader → large domain (text-4xl) → timestamps → progress bar → tab strip → content, pushing actual content ~25-30% down the viewport.

### Solution: Compress everything above the tabs into a single tight bar

**1. Shrink domain to text-xl/2xl and put it on the same row as timestamps**

Current:
```text
┌─────────────────────────────────────┐
│ AppHeader (fixed)                   │
├─────────────────────────────────────┤
│                                     │  ← pt-8
│ wellspringfinancialpartners.com     │  ← text-4xl
│ Created: ... Updated: ...           │  ← mt-2
│                                     │  ← pb-4
├─────────────────────────────────────┤
│ ███████░░░░░░ Progress bar          │
├─────────────────────────────────────┤
│                                     │  ← py-8
│ Site Analysis | Prospecting | Chat  │  ← tabs
├─────────────────────────────────────┤
│ Content starts here (~25-30% down)  │
└─────────────────────────────────────┘
```

After:
```text
┌─────────────────────────────────────┐
│ AppHeader (fixed)                   │
├─────────────────────────────────────┤
│ wellspringfinancial...  Created: .. │  ← single row, text-xl, pt-3 pb-2
│ ███████░░░ (progress bar, if active)│
│ Site Analysis | Prospecting | Chat  │  ← tabs immediately below
├─────────────────────────────────────┤
│ Content starts here (~10-12% down)  │
└─────────────────────────────────────┘
```

### Changes (single file: `ResultsPage.tsx`)

1. **Domain heading**: `text-4xl font-light pt-8 pb-4` → `text-xl font-semibold pt-3 pb-0`. Place domain and timestamps on the same flex row with `justify-between`.

2. **Timestamps**: Move inline-right on the domain row (same line). Remove the separate `mt-2` block.

3. **Main content padding**: `py-8` → `pt-2 pb-8` to close the gap between the domain row and the tab strip.

4. **Progress bar**: Leave as-is — it already disappears when done and is fine where it sits.

5. **Sticky tab bar**: No structural changes needed — it already works independently.

### Net effect
- ~100-120px of vertical space reclaimed
- Content starts at roughly 10-12% down instead of 25-30%
- No layout or component restructuring — purely spacing and sizing adjustments

