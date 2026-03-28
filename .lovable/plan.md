

# Phase 2: Group Comparison Dashboard

Phase 1 (basic CRUD, member list, progress tracking) is complete. This plan adds the comparison and analysis features from the original plan.

## What We're Building

Transform the GroupDetailPage from a simple member list into a tabbed dashboard with four comparison views, plus the groundwork for the AI strategy brief.

## Changes to GroupDetailPage

Replace the current flat member list with a **tabbed layout**:

```text
┌─ Group Header (name, description, member count) ──────────────┐
│                                                                 │
│  [Sites]  [Scores]  [Technology]  [Performance]  [Strategy]    │
│                                                                 │
│  ┌─ Tab Content ─────────────────────────────────────────────┐ │
│  │  (varies by tab)                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 1: Sites (existing view)
- Current member list with progress indicators, add/remove — unchanged

### Tab 2: Score Overview Grid
- Fetch full `crawl_sessions` data for all member session IDs
- Run `computeOverallScore()` from `siteScore.ts` for each
- Render a comparison table:
  - Rows = categories (Performance, SEO, Accessibility, Security, Content, Technology, URL Health)
  - Columns = each member site (domain name header)
  - Cells = score + letter grade with color coding
  - Footer row = overall score per site
- Highlight best/worst per category with visual indicators

### Tab 3: Technology Comparison
- Pull `builtwith_data` and `wappalyzer_data` from each session
- Build a unified technology matrix:
  - Rows = technology names (deduplicated across all sites)
  - Columns = each site
  - Cells = checkmark if present, empty if not
- Group by category (CMS, Analytics, CDN, Frameworks, etc.)
- Summary section: "Shared across all sites" vs "Unique to [domain]"

### Tab 4: Performance Comparison
- Pull `psi_data`, `gtmetrix_scores`, `crux_data` from each session
- Bar chart comparing key metrics side by side:
  - PSI Performance (mobile/desktop)
  - Core Web Vitals (LCP, FID/INP, CLS) from CrUX
  - GTmetrix grade
- Identify best-performing site as benchmark
- Use simple colored bar visualization (no charting library needed — CSS bars)

### Tab 5: AI Strategy Brief (placeholder for Phase 3)
- Show a "Generate Strategy Brief" button (disabled/coming soon)
- Brief description of what it will do

## New Components

| File | Purpose |
|------|---------|
| `src/components/groups/GroupScoreGrid.tsx` | Score comparison table across all sites |
| `src/components/groups/GroupTechMatrix.tsx` | Technology presence matrix |
| `src/components/groups/GroupPerformanceChart.tsx` | Side-by-side performance bars |

## Data Fetching

When the group detail page loads, fetch full session data for all members:

```typescript
const { data: sessions } = await supabase
  .from('crawl_sessions')
  .select('*')
  .in('id', memberSessionIds);
```

This gives us all the jsonb columns (psi_data, builtwith_data, wappalyzer_data, crux_data, etc.) needed for comparison — no new tables or edge functions required.

## Modified Files

| File | Change |
|------|---------|
| `src/pages/GroupDetailPage.tsx` | Add tabs wrapping existing list + new comparison tabs, fetch full session data |
| 3 new component files above | Comparison UI components |

## No Database Changes

All data already exists in `crawl_sessions`. This is purely a frontend feature using `computeOverallScore()` and direct jsonb field reads.

