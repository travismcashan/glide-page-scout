

# Unified Page Template Taxonomy System

## The Problem

Right now, **content types**, **URL discovery**, and **nav structure** each show URLs independently with no shared understanding of what kind of page each URL represents. You want a single, consistent tagging layer that lets you classify any URL — from any view — into your mental model:

```text
Page Template Types
├── Custom Pages        (block-built, unique design — Homepage, About, Pricing)
├── Template Pages      (CPT-driven list/detail — Blog, Case Studies, Resources)
│   ├── List Page       (archive/index)
│   └── Detail Page     (single post)
└── Toolkit Pages       (default content layout — Privacy, Terms, generic pages)
```

And sometimes a page blurs the line (e.g., a Services page that's mostly toolkit but has a few custom blocks).

## Proposed Architecture

### 1. Shared Page Tags Store

A single `pageTags` map stored on the crawl session (new `page_tags` JSONB column on `crawl_sessions`). Structure:

```text
{
  "https://example.com/":          { template: "custom",   label: "Homepage" },
  "https://example.com/blog/":     { template: "template", variant: "list",   contentType: "Blog" },
  "https://example.com/blog/foo/": { template: "template", variant: "detail", contentType: "Blog" },
  "https://example.com/privacy/":  { template: "toolkit" },
  "https://example.com/services/": { template: "custom",   notes: "Mostly toolkit + custom hero" }
}
```

- **`template`**: `custom` | `template` | `toolkit` — your three tiers
- **`variant`** (optional): `list` | `detail` — for template pages
- **`contentType`** (optional): links to the content type classification (e.g., "Blog", "Case Studies")
- **`label`** / **`notes`** (optional): freeform annotation

### 2. Auto-Seeding from Content Types

When the content types integration runs, it already classifies URLs. We auto-seed `pageTags` by mapping:
- URLs with content types like "Blog Post", "Case Study" → `template` + `detail` + that content type
- URLs matching list patterns (`/blog/`, `/resources/`) → `template` + `list`
- Everything else defaults to `toolkit`
- Homepage always gets `custom`

Users then promote toolkit pages to custom or adjust as needed — the AI gives a starting point, not a final answer.

### 3. Unified Badge in All Views

A small colored pill appears on every URL row across nav structure, URL discovery, and content types:

```text
[Custom]    — green
[Template]  — blue  (with "List" or "Detail" sub-badge when set)
[Toolkit]   — gray
```

These badges sit alongside the existing Primary/Secondary/Footer nav badges.

### 4. Tagging UI

- **Inline**: Click a badge on any URL row to cycle or pick from a dropdown (`Custom` / `Template` / `Toolkit`)
- **Bulk**: In content types, tagging a whole content type group tags all its URLs (e.g., mark all "Blog Post" URLs as `template:detail`)
- **Nav structure**: Tag an entire nav section's children at once

### 5. Integration with Estimates

The `pageTags` data feeds into project scoping context. The AI research and observations cards can reference counts like "12 custom pages, 3 template types (blog, case studies, resources), 45 toolkit pages" to inform effort estimates.

## Technical Plan

### Database
- Add `page_tags` JSONB column to `crawl_sessions`

### New Shared Module
- Create `src/lib/pageTags.ts` — types, helpers, auto-seed logic, badge component
- Export a `PageTemplateBadge` component and a `usePageTags` hook that reads/writes from session state

### Component Updates
- **UrlDiscoveryCard**: Add `PageTemplateBadge` per URL row, clickable to change
- **ContentTypesCard / ExpandableUrlRows**: Add `PageTemplateBadge` per URL, plus bulk-tag button on each content type group header
- **NavStructureCard**: Add `PageTemplateBadge` on each nav item that has a URL
- **ResultsPage**: Thread `pageTags` state through all three cards, persist on change

### Auto-Seed Logic
- Runs after content types completes
- Homepage → `custom`
- URLs in a recognized content type → `template:detail`
- URLs matching `/{type}/` pattern with no slug → `template:list`
- Remaining → `toolkit`
- Never overwrites manual tags

