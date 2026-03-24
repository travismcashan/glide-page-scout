

# Three-Level Cascading Classification System

## The Cascade

```text
Level 1: TYPE (WordPress content model)
├── Page        — one-off pages
├── Post        — blog/news entries
├── CPT         — custom post type detail pages (3+ similar URLs)
├── Archive     — all list/index pages
└── Search      — search results

Level 2: TEMPLATE (page purpose)
├── Page →    Homepage, About, Pricing, Contact, Careers, Services, etc.
├── Post →    Blog Detail
├── CPT →     Case Study Detail, Work Detail, Team Member Detail, etc.
├── Archive → Archive (optionally labeled: "Archive: Blog", "Archive: Work")
└── Search →  Search

Level 3: BULK / REPEATING CONTENT (filtered view)
└── Only Post + CPT types shown
    ├── Blog Posts (Post)
    ├── Case Studies (CPT)
    ├── Work Items (CPT)
    └── Team Members (CPT)
```

## What Changes

### 1. Edge Function: `content-types/index.ts` — becomes the Type + Template classifier
- Rewrite AI prompt to output two fields per URL group: `baseType` (Page|Post|CPT|Archive|Search) and `template` (the specific purpose)
- For CPT groups, require a CPT name (e.g., "Case Study", "Work")
- Merge all archive variants into a single Archive type
- Post-processing: CPT groups below 3 URLs get demoted to Page
- Sitemap hints feed directly into type detection (e.g., `post-sitemap.xml` → Post, `work-sitemap.xml` → CPT)

### 2. Types: `content-types/types.ts`
- Add `baseType` field to `ClassifiedUrl`: `'Page' | 'Post' | 'CPT' | 'Archive' | 'Search'`
- Add optional `template` field (string — the specific page purpose)
- `contentType` display name computed from baseType + template

### 3. UI: `ContentTypesCard.tsx` — becomes "Repeating Content" view
- **Only displays Post and CPT entries** — Pages, Archives, and Search are filtered out
- Group by CPT name / Post, show count and confidence
- Rename card header from "Content Types" to "Repeating Content" or "Bulk Content"
- One-off pages visible only in URL Discovery and Nav Structure views (with their template badges)

### 4. Edge Function: `auto-tag-pages/index.ts` — absorbs template assignment
- Receives the type classification as input context
- Maps each URL to a specific template name from the industry presets (already exists)
- Template assignment becomes step 2 of the cascade, informed by the type from step 1

### 5. `PageTemplateBadge` and `pageTags` updates
- `pageTags` structure gains `baseType` alongside existing `template` field
- Badge rendering shows both: e.g., `[CPT] Case Study Detail` or `[Page] Homepage`
- URL Discovery and Nav Structure cards show all URLs with both type and template badges
- Content Types card shows only the repeating content subset

### 6. ResultsPage wiring
- Content types integration runs the combined Type+Template classifier
- Results split into: full classification (stored in `page_tags`) and filtered repeating content (stored in `content_types_data`)
- All three cards (URL Discovery, Nav Structure, Content Types) read from `page_tags` for badge display

## Technical Details

**AI prompt structure for the unified classifier:**
```text
Classify every URL into exactly one WordPress content type:
- Page: One-off pages (About, Contact, Pricing, etc.)
- Post: Blog/news articles in a date-based feed
- CPT: Custom Post Type detail pages — MUST have 3+ similar URLs. Provide the CPT name.
- Archive: Any list/index/category/tag page
- Search: Site search results

Then assign a template name describing each URL's purpose
(e.g., Homepage, Pricing, Blog Detail, Case Study Detail, Archive: Blog).
```

**Tool call schema:**
```json
{
  "groups": [
    {
      "baseType": "CPT",
      "cptName": "Case Study",
      "template": "Case Study Detail",
      "urls": ["..."]
    },
    {
      "baseType": "Page",
      "cptName": null,
      "template": "Homepage",
      "urls": ["https://example.com/"]
    }
  ]
}
```

**Content Types card filter logic:**
```typescript
const repeatingContent = classified.filter(
  c => c.baseType === 'Post' || c.baseType === 'CPT'
);
```

