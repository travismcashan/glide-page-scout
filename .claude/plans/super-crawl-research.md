# SUPER CRAWL Research Notes

**Date:** April 5, 2026
**Session:** vigorous-mccarthy
**Computer:** iMac (this session's worktree)

---

## Agent 1: Crawl Scoring & Grading System (Complete Analysis)

### Overall Architecture

The Glide Page Scout scoring system normalizes 30+ diverse integrations to a 0-100 scale, groups into 7 weighted categories, computes category scores via averaging, and produces an overall site grade through weighted category roll-up.

### Grade Conversion & Thresholds

**Letter Grade Mapping (scoreToGrade):**
- A: 90-100 (emerald green #10b981)
- B: 80-89 (blue #3b82f6)
- C: 70-79 (yellow #eab308)
- D: 60-69 (orange #f97316)
- F: 0-59 (red #ef4444)

**Letter-to-Score Map (LETTER_MAP):**
- A+: 100, A: 95, A-: 90
- B+: 85, B: 82, B-: 78
- C+: 75, C: 72, C-: 68
- D+: 65, D: 62, D-: 58
- E: 40, F: 20, T: 10

**Clamping:** `clamp(n) = Math.max(0, Math.min(100, Math.round(n)))`

### THE 7 SCORING CATEGORIES (Current v0.45)

#### 1. Performance (Weight: 27%)
**Integrations (6):**
- GTmetrix: Extracts `scores.performance` (0-100) or converts letter grade
- PageSpeed Performance: Averages mobile/desktop Lighthouse performance category (0-1 → 0-100)
- Best Practices: Averages mobile/desktop Lighthouse bestPractices category
- CrUX: Averages "good" percentage from metric histograms
- YellowLab: Global performance score or scoreProfiles.generic.globalScore
- Website Carbon: Cleaner than percentage (0-1 → 0-100)

#### 2. SEO & Search (Weight: 20%)
**Integrations (5):**
- SEMrush: Authority score (0-100)
- PageSpeed SEO: Lighthouse seo category score
- Schema.org: 100 - (errors × 10) - (warnings × 3)
- XML Sitemap: Complex scoring (exists +20, coverage +25, structure +8-15, content types +3-15, URL health +5-10, link bonus +12)
- Google Search Console: Multi-factor (CTR normalized to 8%, position inverted 1-50, indexed ratio, impressions log scale)

#### 3. Accessibility (Weight: 18%)
**Integrations (3):**
- Lighthouse: Accessibility category score
- WAVE: 100 - (errors × 5) - (contrast issues × 3) - (alerts × 1)
- W3C: 100 - (HTML/CSS errors × 5) - (warnings × 1)

#### 4. Security (Weight: 14%)
**Integrations (2):**
- Mozilla Observatory: Letter grade conversion or raw score
- SSL Labs: Endpoint grade conversion or root grade

#### 5. Content (Weight: 12%)
**Integrations (2):**
- Readability: Flesch reading ease (0-100) or grade_level conversion
- GA4 Engagement: Multi-factor average (engagement rate, bounce inverted, sessions/user normalized, duration normalized)

#### 6. URL Health (Weight: 8%)
**Integrations (1):**
- HTTP Status: Final 2xx (+35), no 5xx (+25), no 4xx (+20), redirect efficiency (+1-10), TTFB (+1-10)

#### 7. Technology (Weight: 5%)
**Integrations (1):**
- Tech Coverage: Checks 6 infrastructure categories in BuiltWith (analytics, CDN, CMS, security, performance, marketing)

### Overall Score Computation

1. Extract score for each integration in each category
2. Category score = flat average of integration scores (only if ≥1 present)
3. Weighted roll-up: totalWeight = sum(present weights), weightedSum = sum(score × weight/totalWeight)
4. Missing categories excluded from denominator (weight redistributes proportionally)

### Known Problems Identified

1. **Navigation scoring exists but disconnected** — `extractNavigation()` at lines 334-435 is fully implemented but not in CATEGORY_DEFS
2. **Content category too thin** — only Readability + GA4
3. **URL Health is one URL** — only homepage redirect chain
4. **Technology scoring is crude** — just 6 keyword checks
5. **No link health scoring** — link-checker runs but results unused
6. **No forms scoring** — forms integration runs but unused
7. **No content types scoring** — content-types integration runs but unused
8. **Design/template analysis unscored** — page-tags produces data but no score
9. **SEO missing on-page fundamentals** — no meta title/description scoring
10. **Business intelligence integrations mixed in** — Apollo, Ocean, HubSpot, Avoma run in crawl but aren't site health
11. **Equal weight within categories** — GTmetrix = Website Carbon in Performance
12. **No strengths vs gaps** — single number, no breakdown

---

## Agent 2: Crawl Integration Registry (Complete Mapping)

### 27 Total Integrations organized in 3 phases

**Batch 1 (20 integrations) — Independent, run in parallel (concurrency: 4):**
1. BuiltWith (key: `builtwith`, column: `builtwith_data`)
2. SEMrush (key: `semrush`, column: `semrush_data`)
3. PageSpeed Insights (key: `psi`, column: `psi_data`)
4. DetectZeStack (key: `detectzestack`, column: `detectzestack_data`)
5. GTmetrix (key: `gtmetrix`, column: `gtmetrix_scores`)
6. Website Carbon (key: `carbon`, column: `carbon_data`)
7. CrUX (key: `crux`, column: `crux_data`)
8. WAVE (key: `wave`, column: `wave_data`)
9. Mozilla Observatory (key: `observatory`, column: `observatory_data`)
10. HTTP Status (key: `httpstatus`, column: `httpstatus_data`)
11. W3C Validation (key: `w3c`, column: `w3c_data`)
12. Schema Validation (key: `schema`, column: `schema_data`)
13. Readability (key: `readable`, column: `readable_data`)
14. YellowLab (key: `yellowlab`, column: `yellowlab_data`)
15. Ocean (key: `ocean`, column: `ocean_data`)
16. HubSpot (key: `hubspot`, column: `hubspot_data`)
17. XML Sitemap (key: `sitemap`, column: `sitemap_data`)
18. Navigation Extract (key: `nav-structure`, column: `nav_structure`)
19. Firecrawl Map (key: `firecrawl-map`, column: `discovered_urls`)
20. Avoma (key: `avoma`, column: `avoma_data`)
21. Apollo (key: `apollo`, column: `apollo_data`)

**Batch 2 (4 integrations) — Depends on discovered_urls or BuiltWith:**
1. Tech Analysis (key: `tech-analysis`, column: `tech_analysis_data`, waitFor: `builtwith_data`)
2. Content Types (key: `content-types`, column: `content_types_data`)
3. Forms Detect (key: `forms`, column: `forms_data`)
4. Link Checker (key: `link-checker`, column: `linkcheck_data`)

**Batch 3 (2 integrations) — Depends on Batch 2:**
1. Apollo Team Search (key: `apollo-team`, column: `apollo_team_data`, waitFor: `apollo_data`)
2. Page Tag Orchestrate (key: `page-tags`, column: `page_tags`, waitFor: `content_types_data`)

### Pipeline Architecture

- **crawl-start**: Entry point, firecrawl-map direct call, dispatch phase1
- **crawl-phase1**: Runs batch 1 integrations, dispatches phase2
- **crawl-phase2**: Runs batch 2 integrations, dispatches phase3
- **crawl-phase3**: Runs batch 3 integrations, marks session complete

### Database Schema

- **crawl_sessions**: 30+ JSONB columns for integration results
- **integration_runs**: Status tracking (pending→running→done/failed)
- **integration_settings**: Pause state per integration

### Key Files

- Integration definitions: `supabase/functions/crawl-start/index.ts`
- Phase functions: `crawl-phase{1,2,3}/index.ts`
- Orchestration: `_shared/orchestration.ts`, `_shared/phase-runner.ts`
- Frontend state: `src/lib/integrationState.ts`

---

## Agent 3: Crawl Result Cards UI (Complete Inventory)

### 8 Result Page Sections × 24+ Cards

#### Section 1: URL Analysis
| Card | Data Field | Scoring |
|---|---|---|
| SitemapCard | `sitemap_data` | Complex rubric (100 pts) |
| UrlDiscoveryCard | `discovered_urls` | No direct scoring (dependency) |
| HttpStatusCard | `httpstatus_data` | HTTP Status Detailed (100 pts) |

#### Section 2: Content Analysis
| Card | Data Field | Scoring |
|---|---|---|
| RedesignEstimateCard | `page_tags` + `content_types_data` | **NOT SCORED** |
| ContentTypesCard | `content_types_data` | **NOT SCORED** |
| NavStructureCard | `nav_structure` | **NOT SCORED** (extractor exists) |
| ContentSectionCard | pages[] | No scoring |
| ReadableCard | `readable_data` | Flesch ease (0-100) |
| FormsCard | `forms_data` | **NOT SCORED** |

#### Section 3: Design Analysis
| Card | Data Field | Scoring |
|---|---|---|
| TemplatesCard | `page_tags` + `nav_structure` | **NOT SCORED** |
| ScreenshotGallery | Screenshots | No scoring |

#### Section 4: Technology Detection
| Card | Data Field | Scoring |
|---|---|---|
| TechAnalysisCard | `tech_analysis_data` + `builtwith_data` + `detectzestack_data` | Tech Coverage (6 categories) |
| BuiltWithCard | `builtwith_data` | Raw enumeration |
| DetectZeStackCard | `detectzestack_data` | Cross-check only |

#### Section 5: Performance & Sustainability
| Card | Data Field | Scoring |
|---|---|---|
| GtmetrixCard | `gtmetrix_grade` + `gtmetrix_scores` | Performance score (0-100) |
| PageSpeedCard | `psi_data` (mobile + desktop) | Lighthouse avg (0-100) |
| CruxCard | `crux_data` | CrUX "good" avg (0-100) |
| YellowLabCard | `yellowlab_data` | Global score (0-100) |
| WebsiteCarbonCard | `carbon_data` | cleanerThan × 100 |

#### Section 6: SEO & Search
| Card | Data Field | Scoring |
|---|---|---|
| SemrushCard | `semrush_data` | Authority score (0-100) |
| SearchConsoleCard | `search_console_data` | Multi-factor avg |
| GA4Card | `ga4_data` | Engagement multi-factor |
| SchemaCard | `schema_data` | 100 - errors×10 - warnings×3 |

#### Section 7: UX & Accessibility
| Card | Data Field | Scoring |
|---|---|---|
| LighthouseAccessibilityCard | `psi_data` | Lighthouse a11y (0-100) |
| WaveCard | `wave_data` | 100 - errors×5 - contrast×3 - alerts×1 |
| W3CCard | `w3c_data` | 100 - errors×5 - warnings×1 |

#### Section 8: Security & Compliance
| Card | Data Field | Scoring |
|---|---|---|
| ObservatoryCard | `observatory_data` | Letter grade → numeric |
| SslLabsCard | `ssllabs_data` | Letter grade → numeric |

### Score Display Components

- **ScoreOverview.tsx**: Ring gauge + 7 category pills + progress state
- **GradeBadge.tsx**: Inline grade + score display (sm/md sizes)
- **SectionCard.tsx**: Universal card wrapper with grade, loading, error, pause, rerun
- **CollapsibleSection.tsx**: Section header with category grade badge

### Integration Score Reference Table

| Integration | Category | Extraction | Score Range |
|---|---|---|---|
| gtmetrix | Performance | performance score or letter | 0-100 |
| psi-performance | Performance | Lighthouse mobile/desktop avg | 0-100 |
| psi-best-practices | Performance | Lighthouse mobile/desktop avg | 0-100 |
| crux | Performance | Average "good" % from metrics | 0-100 |
| yellowlab | Performance | Global score | 0-100 |
| carbon | Performance | cleanerThan × 100 | 0-100 |
| semrush | SEO | Authority score | 0-100 |
| psi-seo | SEO | Lighthouse mobile/desktop avg | 0-100 |
| schema | SEO | 100 - errors×10 - warnings×3 | 0-100 |
| sitemap | SEO | Complex rubric | 0-100 |
| search-console | SEO | Multi-factor (CTR, position, indexed, impressions) | 0-100 |
| psi-accessibility | Accessibility | Lighthouse mobile/desktop avg | 0-100 |
| wave | Accessibility | 100 - errors×5 - contrast×3 - alerts×1 | 0-100 |
| w3c | Accessibility | 100 - errors×5 - warnings×1 | 0-100 |
| observatory | Security | Letter → score or raw | 0-100 |
| ssllabs | Security | Letter → score | 0-100 |
| readable | Content | Flesch ease or inverted grade level | 0-100 |
| ga4 | Content | Multi-factor engagement | 0-100 |
| httpstatus | URL Health | Status+redirects+TTFB rubric | 0-100 |
| tech-coverage | Technology | Infrastructure categories / 6 × 100 | 0-100 |

### Data Flow

```
User creates session → crawl-start
  → Batch 1: 19 parallel + firecrawl-map blocking
  → discovered_urls populated → Batch 2: content-types, forms, link-checker, tech-analysis
  → Batch 2 complete → Batch 3: apollo-team, page-tags
  → All done → computeOverallScore runs
  → UI: ScoreOverview + 8 sections + 24+ cards
```

---

## Agent 4: Wishlist & Sidebar Navigation (Plans Page Context)

### Wishlist Pattern (to replicate for Plans)

**WishlistPage:** `/src/pages/WishlistPage.tsx` (~340 lines)
- Kanban board with status columns (wishlist/planned/in-progress/done)
- Search, category/priority filters, sort
- Detail modal for editing items
- Brain dump input with AI parsing
- Sub-components in `src/components/wishlist/`

**Supabase table:** `wishlist_items` — id, title, description, category, status, priority, effort_estimate, cover_image_url, source, page_url, created_at, updated_at

### Sidebar Integration Points

**User dropdown menu** in `src/components/AppSidebar.tsx` (lines 283-290):
- Connections, Wishlist, Services, Usage, Project Mapping, Company Mapping, Cleanup
- Plans would go after Wishlist with `ScrollText` icon

**Settings group active check** (line 217-245):
- Pattern: `location.pathname === '/plans'` added to active detection

**Routing** in `src/App.tsx` (line 113 area):
- Pattern: `<Route path="/plans" element={<PlansPage />} />`

### No existing app-level plans page

Roadmap infrastructure exists for client projects (roadmaps table), but no development plans page. This is a net-new feature.

---

## Source Code: siteScore.ts (714 lines)

The complete scoring engine was read and analyzed. Key sections:

- Lines 1-53: Grade helpers, letter-to-score mapping
- Lines 55-211: 13 individual integration extractors
- Lines 214-272: XML Sitemap scoring (complex rubric)
- Lines 277-330: HTTP Status detailed scoring
- Lines 334-435: Navigation scoring (EXISTS BUT DISCONNECTED)
- Lines 437-469: Tech Coverage scoring
- Lines 471-542: GA4 and Search Console scoring
- Lines 544-639: Category definitions (CATEGORY_DEFS array)
- Lines 641-695: computeOverallScore and getIntegrationScore
- Lines 697-714: getCategoryScore and SECTION_TO_CATEGORY map

## Source Code: ScoreOverview.tsx (172 lines)

Ring gauge component with category pills. ScoreRing renders SVG circle with animated progress. CategoryPill renders grade + score per category. Shows placeholder state during analysis with optional progress percentage.
