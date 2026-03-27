

## Brand Architecture Plan: Hybrid Approach for Glide Platform

### Strategic Decision

Adopt the **Hybrid model** — branded house for internal tools, flexible branding for client-facing surfaces.

### Product Lines & Names

| Product | Name | Audience | White-label? |
|---|---|---|---|
| Sales Prospecting | **Glide Scout** | Your sales team | No |
| Marketing Audit | **Glide Audit** | Shared with clients | Optional |
| Client Portal | **Lens** (by Glide, or unbranded) | End clients | Yes |
| Agency Operations | **Glide Command** | Delivery team | No |
| Parent Platform | **Glide** | Everyone | N/A |

### Naming Theme: Navigation

"Glide" implies movement — the navigation family (Scout, Compass, Lens, Command) reinforces that. All names are short, memorable, and not trademarked in this space.

### Implementation Phases

**Phase 1 — Rebrand current app as Glide Scout**
- Update `AppHeader.tsx`: replace "Agency Atlas" with "Glide Scout" wordmark + new icon
- Update `CrawlPage.tsx` homepage greeting and tagline
- Update `index.html` title and meta tags
- Update favicon/logo assets

**Phase 2 — Add product switcher**
- Add a dropdown or segmented control in the header (next to brand) showing available products
- For now, only "Scout" is active; others show as "Coming Soon"
- Store selected product in context/localStorage
- This sets the groundwork for showing different nav items and features per product

**Phase 3 — Prepare multi-product routing (future)**
- Namespace routes: `/scout/...`, `/audit/...`, `/command/...`
- Product context determines which tabs, integrations, and features are visible
- Lens (client portal) would be a separate deployed instance or subdomain

### Technical Details

- New `ProductContext` wrapping the app to track active product
- `AppHeader` reads product context to show correct brand name and available nav links
- Product switcher uses a `DropdownMenu` with product icons and labels
- No database changes needed for Phase 1-2; product association with sessions comes in Phase 3

