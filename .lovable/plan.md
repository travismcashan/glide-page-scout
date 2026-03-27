

# Unified Scoring System for Site Analysis

## Concept: Hierarchical Score Rollup

The scoring model works in three tiers:

```text
┌─────────────────────────────────┐
│        OVERALL SITE SCORE       │  ← Single number (0-100) + letter grade
│           e.g. B (78)           │
├─────────────────────────────────┤
│  Category Scores (sections)     │  ← One score per CollapsibleSection
│  Performance: A (91)            │
│  Security: B (82)               │
│  SEO: C (67)                    │
│  Accessibility: B (75)          │
│  Content: B+ (84)               │
│  Technology: A (90)             │
├─────────────────────────────────┤
│  Integration Scores (cards)     │  ← Individual 0-100 from each tool
│  GTmetrix: 85                   │
│  PageSpeed Mobile: 62           │
│  WAVE: 91                       │
│  Observatory: A+ → 97           │
│  SSL Labs: A → 93               │
│  ...                            │
└─────────────────────────────────┘
```

## Scoring Approach

**Everything normalizes to 0-100.** Letter grades are derived from that:

| Range | Grade |
|-------|-------|
| 90-100 | A |
| 80-89 | B |
| 70-79 | C |
| 60-69 | D |
| 0-59 | F |

### Integration-Level Score Extraction

| Integration | Raw Output | Normalization |
|---|---|---|
| **GTmetrix** | Grade A-F + performance % | Use performance score directly (0-100) |
| **PageSpeed (mobile)** | Categories: performance, SEO, accessibility, best-practices (0-100 each) | Use each category score directly; contributes to multiple sections |
| **PageSpeed (desktop)** | Same as mobile | Average mobile+desktop per category |
| **CrUX** | LCP, FID, CLS, INP with good/needs-improvement/poor | Map: good=100, needs-improvement=60, poor=20; average across metrics |
| **YellowLab** | globalScore 0-100 | Use directly |
| **Website Carbon** | Cleaner than X% | Use the percentile directly |
| **SEMrush** | Authority score, organic traffic, keywords | Use authority score (0-100) |
| **Schema.org** | Valid/invalid/warnings count | Formula: `100 - (errors * 10) - (warnings * 3)`, floor 0 |
| **WAVE** | Errors, alerts, contrast errors | Formula: `max(0, 100 - (errors * 5) - (contrast * 3) - (alerts * 1))` |
| **Lighthouse Accessibility** | Score 0-100 | Use directly |
| **W3C** | Error/warning counts | Formula: `max(0, 100 - (errors * 5) - (warnings * 1))` |
| **Observatory** | Letter grade A+ to F | Map: A+=100, A=95, A-=90, B+=85... F=20 |
| **SSL Labs** | Letter grade A+ to F | Same letter-to-number map |
| **Readable** | Flesch score or grade level | Normalize to 0-100 based on grade level |
| **HTTP Status** | % of 200 responses | Use directly as percentage |
| **Broken Links** | Count of broken vs total | `(1 - broken/total) * 100` |
| **BuiltWith / Wappalyzer / DetectZeStack** | Tech count + categories | No inherent "score" — contribute to a "tech coverage" heuristic (e.g., has analytics? has CDN? has security headers?) |
| **Screenshots** | Visual only | Excluded from scoring (informational) |
| **Ocean / Apollo / HubSpot / Avoma / Gmail** | Prospecting data | Excluded — separate tab, not a site quality metric |

### Category Rollup (Weighted Average)

Each section averages its available integration scores. Only integrations with data contribute — missing ones are excluded, not penalized.

| Category | Integrations | Weight in Overall |
|---|---|---|
| **Performance** | GTmetrix, PSI performance, CrUX, YellowLab, Carbon | 25% |
| **SEO & Search** | SEMrush authority, PSI SEO, Schema | 20% |
| **Accessibility** | PSI accessibility, WAVE, W3C | 20% |
| **Security** | Observatory, SSL Labs | 15% |
| **Content** | Readable, HTTP status, broken links | 15% |
| **Technology** | Tech coverage heuristic (has CDN, analytics, CMS, security) | 5% |

### Overall Score
Weighted average of available category scores. If a category has no data, its weight redistributes proportionally to the others.

## Implementation Plan

### 1. Create scoring utility (`src/lib/siteScore.ts`)
- Pure functions: `extractIntegrationScore(integrationKey, data) → number | null`
- `computeCategoryScores(session) → Record<Category, { score: number, grade: string, integrations: {...} }>`
- `computeOverallScore(session) → { score: number, grade: string, categories: {...} }`
- Letter grade helper: `scoreToGrade(n: number) → string`

### 2. Create ScoreOverview component (`src/components/ScoreOverview.tsx`)
- Hero card at top of Decide Analysis tab showing overall grade + score
- Category breakdown row with mini grade badges
- Expandable detail showing which integrations fed each category

### 3. Add score badges to CollapsibleSection headers
- Each section header gets a small grade badge (e.g., "B · 82") when data is available
- Uses the category score from the scoring utility

### 4. Add score badges to individual SectionCard headers
- Each integration card header shows its normalized score as a subtle badge
- Only shown when the integration has returned data

### Technical Details

- All scoring logic is client-side, computed from data already in the session object — no new API calls or database changes
- Scores recompute reactively when session state updates via `updateSession`
- The scoring utility is a pure module with no React dependencies, making it testable and reusable for future PDF report generation
- Grade color scheme: A=green, B=blue, C=yellow, D=orange, F=red

