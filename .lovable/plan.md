
# Three-Level Cascading Classification System — IMPLEMENTED

## The Cascade

```text
Level 1: TYPE (WordPress content model)
├── Page        — one-off pages (green badges)
├── Post        — blog/news entries (amber badges)
├── CPT         — custom post type detail pages, 3+ similar URLs (violet badges)
├── Archive     — all list/index pages (sky blue badges)
└── Search      — search results (gray badges)

Level 2: TEMPLATE (page purpose)
├── Page →    Homepage, About, Pricing, Contact, Careers, Services, etc.
├── Post →    Blog Detail
├── CPT →     Case Study Detail, Work Detail, Team Member Detail, etc.
├── Archive → Archive: Blog, Archive: Case Studies, Blog List, etc.
└── Search →  Search

Level 3: REPEATING CONTENT (filtered view in ContentTypesCard)
└── Only Post + CPT types shown
    ├── Blog Posts (Post)
    ├── Case Studies (CPT)
    ├── Work Items (CPT)
    └── Team Members (CPT)
```

## What Was Changed

### Edge Functions
- **`content-types/index.ts`**: Rewrote AI prompt to output `baseType` (Page|Post|CPT|Archive|Search) + `template` + `cptName` per URL group. CPT groups below 3 URLs demoted to Page.
- **`auto-tag-pages/index.ts`**: Updated to output `baseType`, `template`, and `cptName` per URL alongside industry detection.

### Types
- **`content-types/types.ts`**: Added `BaseType`, `baseType`, `template`, `cptName` fields to `ClassifiedUrl` and `ContentTypeSummary`.
- **`src/lib/pageTags.ts`**: Added `BaseType` and `baseType`/`cptName` to `PageTag`. Added `getTemplateCategoryFromBaseType()`. Updated `autoSeedPageTags()` to use baseType from classifier. Updated `getPageTagsSummary()` with per-type counts.

### UI
- **`PageTemplateBadge.tsx`**: Now shows dual badges — `[Type]` (Level 1, color-coded) + `[Template]` (Level 2, clickable).
- **`ContentTypesCard.tsx`**: Renamed to "Repeating Content — Posts & CPTs". Filters to only show Post + CPT entries. Added Type column with colored badge.
- **`ResultsPage.tsx`**: Updated section title, wired `baseType`/`cptName` from auto-tag results into `PageTagsMap`.

### API
- **`firecrawl.ts`**: Updated `autoTagPagesApi` return type to include `baseType` and `cptName`.
