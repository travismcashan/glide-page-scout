

## Navigation Redesign: Consistent Header, No Hamburger

### Problem
- CrawlPage has one header style, ResultsPage has a different one with a hamburger menu
- The hamburger creates "mystery meat navigation" — users can't see options until they click
- No consistent brand presence (logo, wordmark) across pages
- Admin/account links are hidden in the hamburger or avatar dropdown inconsistently

### Design Principles (Nielsen heuristics)
1. **Consistency & standards** — same header on every page
2. **Recognition over recall** — visible nav items, not hidden behind a menu icon
3. **Visibility of system status** — show which section is active

### Proposed Header (all pages)

```text
┌──────────────────────────────────────────────────────────────┐
│ [⚡ Agency Atlas]     History  Integrations  Settings  [👤] │
└──────────────────────────────────────────────────────────────┘
```

- **Left**: Logo + "Agency Atlas" wordmark, links to home (/)
- **Center/Right nav**: History, Integrations, Settings — always visible as text links
- **Far right**: Avatar dropdown (Sign In button if logged out) with Account, Admin (if admin), Sign Out
- On the ResultsPage, the domain name + crawl date move below the header into the page content area (not part of the shared header)

### Implementation

1. **Create `src/components/AppHeader.tsx`** — shared header component
   - Accepts no page-specific props; uses `useAuth()` and `useNavigate()`
   - Brand: Zap icon + "Agency Atlas" text
   - Nav links: History, Integrations, Settings (use NavLink for active state highlighting)
   - Avatar dropdown: display name, email, Admin (conditional), Sign Out
   - Sign In button when logged out

2. **Update `src/pages/CrawlPage.tsx`** — replace inline header with `<AppHeader />`

3. **Update `src/pages/ResultsPage.tsx`**:
   - Replace the entire hamburger Sheet + inline header with `<AppHeader />`
   - Keep domain/date info as page content below the header
   - Remove Sheet import and all hamburger-related code

4. **Update `src/pages/HistoryPage.tsx`**, **SettingsPage.tsx**, **AdminPage.tsx** — add `<AppHeader />` for consistency (currently some have back-arrow patterns)

5. **Fix build error** in `src/integrations/lovable/index.ts` — remove `"microsoft"` from the OAuth provider union since it's not supported by the Supabase SDK type

### Technical Details
- `AppHeader` uses `NavLink` component (already exists) for active-state highlighting
- Mobile: nav items stay visible (5 items fit); if needed later, collapse to a compact bar
- The sticky tab bar on ResultsPage remains unchanged (it's content-level navigation, not app-level)
- Connections, Wishlist move into Settings sub-sections or remain accessible from their existing routes via Settings page links

