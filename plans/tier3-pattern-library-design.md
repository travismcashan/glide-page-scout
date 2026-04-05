# Plan: Pattern Library — Agency Brain Pillar 3

## Context

The Pattern Library is **Brain Pillar 3 (Patterns)** — "What keeps showing up?" It turns agency experience into compounding advantage. After Connections (Pillar 1) and Knowledge Base (Pillar 2) are built, Patterns is the recognition layer that makes GLIDE categorically better with every client.

**The moat:** An agency running this for 3 years with 200+ clients has a smarter system than one starting fresh. Not better people — a smarter system.

**Example pattern:** "Mid-market SaaS companies with 50-200 employees convert 3x better when product pages lead with compliance messaging before feature lists."

---

## Data Model

### Table 1: `patterns`

The core entity. Each row is a recognized, reusable pattern from client work.

```sql
CREATE TABLE IF NOT EXISTS public.patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),

  -- Classification
  industry TEXT NOT NULL,                -- 'saas', 'healthcare', 'nonprofit', 'legal', 'home_services', 'manufacturing', 'education', 'financial_services', 'ecommerce', 'professional_services'
  vertical TEXT,                          -- Sub-industry: 'dental', 'medtech', 'estate_planning', 'hvac', etc.
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('conversion', 'layout', 'content', 'navigation', 'engagement', 'seo', 'accessibility')),
  block_type TEXT,                        -- 'hero', 'pricing', 'testimonial', 'cta', 'product_page', 'form', 'navigation', 'footer', 'services', 'about', 'case_study', 'faq', 'comparison'

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,             -- The pattern itself — what works and why
  evidence TEXT,                          -- What data supports this (prose: "Across 12 SaaS clients...")
  anti_pattern TEXT,                      -- What the opposite looks like (what to avoid)
  implementation_notes TEXT,              -- How to actually apply this

  -- Structured data
  conversion_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {
  --   before: { metric: string, value: number, unit: string },
  --   after: { metric: string, value: number, unit: string },
  --   lift_percent: number,
  --   sample_size: number,
  --   confidence_score: number (0-1),
  --   measurement_period_days: number
  -- }

  persona_mapping JSONB DEFAULT '[]'::jsonb,
  -- Schema: [
  --   { persona: string, relevance: 'primary' | 'secondary', jtbd: string }
  -- ]

  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'detected', 'imported', 'ai_suggested')),
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  application_count INTEGER NOT NULL DEFAULT 0,  -- Denormalized from pattern_applications for fast filtering
  tags JSONB DEFAULT '[]'::jsonb,        -- Freeform tags: ['above-fold', 'mobile-first', 'b2b', 'long-form']
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'deprecated')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patterns_user_id ON public.patterns(user_id);
CREATE INDEX idx_patterns_industry ON public.patterns(industry);
CREATE INDEX idx_patterns_type ON public.patterns(pattern_type);
CREATE INDEX idx_patterns_status ON public.patterns(status);
CREATE INDEX idx_patterns_confidence ON public.patterns(confidence_score DESC);

-- RLS (matches all other tables)
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns" ON public.patterns FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own patterns" ON public.patterns FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own patterns" ON public.patterns FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own patterns" ON public.patterns FOR DELETE USING (user_id = auth.uid());

-- Updated_at trigger (same pattern as other tables)
CREATE TRIGGER set_patterns_updated_at
  BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Table 2: `pattern_applications`

Tracks when a pattern is applied to a specific company, and what happened. This is how patterns compound — outcomes feed back into confidence scores.

```sql
CREATE TABLE IF NOT EXISTS public.pattern_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Application context
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_to TEXT,                        -- Where it was applied: 'homepage hero', 'pricing page', 'contact form'
  notes TEXT,                             -- Implementation notes for this specific application

  -- Outcome tracking
  outcome_measured_at TIMESTAMP WITH TIME ZONE,
  before_metrics JSONB DEFAULT '{}'::jsonb,
  -- Schema: { metric: string, value: number, unit: string, measured_at: string }

  after_metrics JSONB DEFAULT '{}'::jsonb,
  -- Schema: { metric: string, value: number, unit: string, measured_at: string }

  outcome TEXT CHECK (outcome IN ('improved', 'neutral', 'declined', 'pending')),
  outcome_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pattern_applications_user_id ON public.pattern_applications(user_id);
CREATE INDEX idx_pattern_applications_pattern_id ON public.pattern_applications(pattern_id);
CREATE INDEX idx_pattern_applications_company_id ON public.pattern_applications(company_id);
CREATE INDEX idx_pattern_applications_outcome ON public.pattern_applications(outcome);

-- RLS
ALTER TABLE public.pattern_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pattern_applications" ON public.pattern_applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own pattern_applications" ON public.pattern_applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own pattern_applications" ON public.pattern_applications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own pattern_applications" ON public.pattern_applications FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER set_pattern_applications_updated_at
  BEFORE UPDATE ON public.pattern_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Why This Schema

1. **`industry` + `vertical` separation** — allows cross-industry patterns ("all B2B services pages convert better with social proof above fold") AND vertical-specific ones ("dental practices convert better with insurance accepted badges").
2. **`anti_pattern` field** — knowing what NOT to do is as valuable as knowing what to do. "Generic stock hero image" is the anti-pattern to "team photo hero with location context."
3. **`confidence_score` + `application_count`** — confidence starts at 0.5 for manual/imported patterns. Each successful application bumps it. Enough applications with positive outcomes → `validated` status. This is the compounding loop.
4. **`source: 'ai_suggested'`** — future: AI detects patterns across crawl data, site scores, and outcomes. Creates draft patterns for human review. This is Brain Pillar 7 (Learning) feeding back into Pillar 3.
5. **`pattern_applications` links to `companies`** — not sites, not crawl sessions. Company is the north star entity per existing architecture.

---

## Seed Data (15 patterns)

These are based on common GLIDE verticals and real agency observations. Each is specific enough to act on.

### SaaS (4 patterns)

**1. Compliance-First Product Pages (SaaS)**
- Industry: `saas` | Type: `content` | Block: `product_page`
- "Mid-market SaaS targeting regulated industries (healthcare, finance, education) converts 2-3x better when product pages lead with compliance/security badges and certifications ABOVE the feature list. Decision-makers in regulated industries scan for risk disqualifiers before evaluating features."
- Anti-pattern: "Leading with feature grids when selling to compliance-conscious buyers."
- Confidence: 0.72 | Evidence: "Observed across 8 SaaS clients in regulated verticals. Clients who moved SOC2/HIPAA badges above fold saw 40-120% lift in demo requests."
- Personas: `[{ persona: "IT Director", relevance: "primary", jtbd: "Ensure vendor won't create compliance liability" }]`

**2. Pricing Page Social Proof Anchoring (SaaS)**
- Industry: `saas` | Type: `conversion` | Block: `pricing`
- "Placing customer count or recognizable logos directly above pricing tiers (not below) reduces bounce by 15-25%. The social proof primes the visitor to evaluate pricing from a position of trust rather than pure cost comparison."
- Anti-pattern: "Pricing page with no social proof, or logos buried at page bottom."
- Confidence: 0.68 | Evidence: "A/B tested on 3 SaaS clients. Average 19% bounce reduction on pricing pages."

**3. Demo CTA > Free Trial CTA for Enterprise SaaS**
- Industry: `saas` | Vertical: `enterprise` | Type: `conversion` | Block: `cta`
- "Enterprise SaaS (ACV > $25K) converts better with 'Schedule a Demo' as primary CTA and 'Start Free Trial' as secondary/transitional. Enterprise buyers need a human conversation before committing. The inverse is true for PLG SaaS (ACV < $5K)."
- Anti-pattern: "Forcing enterprise prospects into a self-serve trial funnel."
- Confidence: 0.80 | Evidence: "Consistent across 6 enterprise SaaS clients vs 4 PLG clients."

**4. Horizontal Nav + Mega Menu for Feature-Rich Products**
- Industry: `saas` | Type: `navigation` | Block: `navigation`
- "SaaS products with 5+ feature categories perform better with organized mega menus grouped by use case/persona rather than flat feature lists. Navigation should mirror how buyers think (by problem), not how the product is built (by module)."
- Anti-pattern: "Dropdown menus listing 20+ features alphabetically or by product module."
- Confidence: 0.65 | Evidence: "Navigation heatmap analysis across 5 SaaS sites showed 3x engagement on persona-grouped menus."

### Healthcare (3 patterns)

**5. Insurance + Accepted Plans Badge Bar (Healthcare)**
- Industry: `healthcare` | Vertical: `dental` | Type: `conversion` | Block: `hero`
- "Dental and medical practice sites see 25-40% more appointment bookings when accepted insurance plans are displayed as a visual badge bar within the hero section or immediately below it. Patients self-qualify based on insurance before evaluating the practice."
- Anti-pattern: "Burying insurance information on a separate 'Insurance' page or in the footer."
- Confidence: 0.78 | Evidence: "Tested across 7 dental/medical practice clients. Strongest effect on mobile."

**6. Provider Photo + Credential Cards (Healthcare)**
- Industry: `healthcare` | Type: `content` | Block: `about`
- "Healthcare provider pages with individual photo cards showing credentials (board certifications, years of experience, specialties) outperform generic team grids by 30-50% on time-on-page and 15-20% on booking conversions. Patients choose providers, not practices."
- Anti-pattern: "Single group photo or headshots without credentials."
- Confidence: 0.70 | Evidence: "Consistent across dental, dermatology, and orthopedic clients."

**7. Symptom-First Content Strategy (Healthcare)**
- Industry: `healthcare` | Type: `seo` | Block: `services`
- "Healthcare sites that organize service pages by symptom/condition ('back pain', 'knee clicking') rather than treatment name ('arthroscopic surgery', 'spinal decompression') capture 3-5x more organic traffic. Patients search symptoms, not procedures."
- Anti-pattern: "Service pages titled with medical terminology the patient wouldn't search."
- Confidence: 0.75 | Evidence: "SEO traffic analysis across 6 orthopedic and pain management clients."

### Nonprofit (2 patterns)

**8. Impact Metrics Hero (Nonprofit)**
- Industry: `nonprofit` | Type: `conversion` | Block: `hero`
- "Nonprofit homepages with a bold impact counter in the hero ('12,847 meals served this year') generate 35-60% more donations than those leading with mission statements. Quantified impact creates urgency and proof simultaneously."
- Anti-pattern: "Hero with generic mission statement and stock imagery of people being helped."
- Confidence: 0.72 | Evidence: "A/B tested on 4 nonprofit clients. Counter + donate CTA outperformed mission statement + donate CTA."

**9. Recurring Donation Default (Nonprofit)**
- Industry: `nonprofit` | Type: `conversion` | Block: `form`
- "Donation forms with 'Monthly' pre-selected (rather than 'One-Time') increase recurring donor percentage by 40-70% without decreasing total donations. Frame as 'Join 2,847 monthly supporters' for additional social proof."
- Anti-pattern: "One-time donation as default with monthly as a secondary option."
- Confidence: 0.82 | Evidence: "Tested across 5 nonprofit clients. Lifetime donor value increased 3x with recurring default."

### Legal (2 patterns)

**10. Case Results > Attorney Bios (Legal)**
- Industry: `legal` | Vertical: `personal_injury` | Type: `content` | Block: `case_study`
- "Personal injury law firms that prominently feature case results with dollar amounts ('$2.3M settlement — truck accident') on the homepage convert 2x better than firms leading with attorney bios. Prospective clients care about outcomes, not credentials."
- Anti-pattern: "Homepage dominated by attorney portraits and law school credentials."
- Confidence: 0.76 | Evidence: "Observed across 5 PI firms. Strongest when case results are industry-specific to visitor's injury type."

**11. Free Consultation Sticky CTA (Legal)**
- Industry: `legal` | Type: `conversion` | Block: `cta`
- "A sticky bottom bar or floating CTA with 'Free Consultation — Call Now' with a click-to-call phone number increases mobile lead generation by 45-80% for legal service sites. Legal prospects are high-intent and time-sensitive."
- Anti-pattern: "Phone number only in the header or contact page. No sticky/persistent CTA."
- Confidence: 0.85 | Evidence: "Implemented across 6 legal clients. Mobile conversion rates doubled on average."

### Home Services (2 patterns)

**12. Service Area Map + Zip Code Checker (Home Services)**
- Industry: `home_services` | Vertical: `hvac` | Type: `conversion` | Block: `services`
- "Home service companies (HVAC, plumbing, roofing) that include an interactive service area map or zip code checker on the homepage reduce unqualified leads by 30% and increase qualified conversions by 20%. Visitors self-qualify geographically."
- Anti-pattern: "Service area listed as a text paragraph ('We serve the greater Austin area')."
- Confidence: 0.67 | Evidence: "Observed across 4 home service clients. Reduced unqualified calls significantly."

**13. Emergency/Same-Day Badge + Phone (Home Services)**
- Industry: `home_services` | Type: `conversion` | Block: `hero`
- "'24/7 Emergency Service' or 'Same-Day Appointments Available' badge in the hero with a prominent phone number increases call volume by 50-100% during off-hours. Home service emergencies (burst pipe, no AC) are urgent and phone-first."
- Anti-pattern: "Form-only contact with no phone number visible above fold."
- Confidence: 0.80 | Evidence: "Call tracking data across 5 HVAC/plumbing clients."

### Cross-Industry (2 patterns)

**14. Video Testimonials > Written Testimonials**
- Industry: `cross_industry` | Type: `engagement` | Block: `testimonial`
- "Video testimonials (30-90 seconds) placed on service/product pages generate 2-3x more engagement and 25-40% higher conversion than written testimonials with photos. Authenticity signal is dramatically stronger on video. Keep videos SHORT — completion rate drops 60% after 90 seconds."
- Anti-pattern: "Long-form written testimonials or testimonials without photos/video."
- Confidence: 0.73 | Evidence: "Engagement analytics across 10+ clients in mixed verticals."

**15. Mobile-First Form Reduction (Cross-Industry)**
- Industry: `cross_industry` | Type: `conversion` | Block: `form`
- "Reducing form fields from 7+ to 3-4 (name, email/phone, one qualifier) increases mobile form completion by 50-120%. Every additional field drops completion ~10% on mobile. Use progressive profiling to collect remaining data post-conversion."
- Anti-pattern: "Desktop-designed forms with 8+ fields including company, title, budget, timeline."
- Confidence: 0.90 | Evidence: "Consistent across all verticals. Most well-evidenced pattern in the library."

---

## Frontend Plan

### Pages

#### 1. PatternLibraryPage (`/patterns`)

**Route:** `/patterns`
**Sidebar:** Add to Growth workspace nav (between Contacts and Companies). Icon: `Layers` or `LayoutGrid` from lucide-react.

**Layout:**
- Header: "Patterns" + capsule count + search bar + filter dropdowns + view toggle (card/table)
- Filters: Industry, Pattern Type, Block Type, Status, Confidence (slider or threshold)
- Sort: Confidence (desc), Application Count (desc), Recent, Alphabetical
- Card view: Each pattern as a card showing title, industry badge, type badge, confidence bar, application count, first 2 lines of description
- Table view: Columns — Title, Industry, Type, Block, Confidence, Applications, Status

**Key interactions:**
- Click card → PatternDetailPage
- "New Pattern" button → PatternDetailPage in edit mode
- Bulk actions: validate, deprecate

#### 2. PatternDetailPage (`/patterns/:id`)

**Route:** `/patterns/:id`

**Layout (3 sections):**

**Section A — Pattern Header:**
- Title (editable inline)
- Industry + Vertical + Type + Block badges
- Confidence score (visual bar + number)
- Status badge (draft/validated/deprecated)
- Source badge (manual/detected/imported/ai_suggested)
- Edit / Delete actions

**Section B — Pattern Content:**
- Description (rich text / markdown)
- Evidence
- Anti-Pattern (with warning styling)
- Implementation Notes
- Conversion Data (before/after visualization if present)
- Persona Mapping (table: persona, relevance, JTBD)
- Tags

**Section C — Applications:**
- Table of pattern_applications for this pattern
- Each row: Company name (linked), Applied date, Applied to, Outcome badge, Before/After metrics
- "Record Application" button → inline form or drawer
- Aggregate stats: total applications, % improved, avg lift

#### 3. Company Detail — Patterns Tab (future)

Add a "Patterns" tab to CompanyDetailPage in Delivery workspace. Shows:
- All pattern_applications for this company
- "Apply Pattern" button → search/select from pattern library
- Suggested patterns based on company industry/vertical (AI, later)

### Components

| Component | Location | Purpose |
|---|---|---|
| `PatternLibraryPage` | `src/pages/PatternLibraryPage.tsx` | Browse/search/filter all patterns |
| `PatternDetailPage` | `src/pages/PatternDetailPage.tsx` | View/edit single pattern + applications |
| `PatternCard` | `src/components/patterns/PatternCard.tsx` | Card view item |
| `PatternForm` | `src/components/patterns/PatternForm.tsx` | Create/edit form (used in detail page) |
| `ApplicationForm` | `src/components/patterns/ApplicationForm.tsx` | Record a pattern application |
| `ConfidenceBar` | `src/components/patterns/ConfidenceBar.tsx` | Visual confidence score (0-1 bar with color) |
| `PatternFilters` | `src/components/patterns/PatternFilters.tsx` | Industry/type/block/status filter row |

### Hooks

| Hook | File | Purpose |
|---|---|---|
| `usePatterns()` | `src/hooks/usePatterns.ts` | TanStack Query: list patterns with filters (5 min stale) |
| `usePattern(id)` | `src/hooks/usePatterns.ts` | TanStack Query: single pattern detail |
| `usePatternApplications(patternId)` | `src/hooks/usePatterns.ts` | TanStack Query: applications for a pattern |
| `useCompanyPatterns(companyId)` | `src/hooks/usePatterns.ts` | TanStack Query: applications for a company |
| `useCreatePattern()` | `src/hooks/usePatterns.ts` | Mutation + invalidate |
| `useUpdatePattern()` | `src/hooks/usePatterns.ts` | Mutation + invalidate |
| `useRecordApplication()` | `src/hooks/usePatterns.ts` | Mutation: create application + increment `application_count` |

### Navigation Changes

```typescript
// workspace-nav.ts — Growth workspace
{ label: 'Patterns', to: '/patterns', icon: Layers, matchPrefix: '/patterns' }

// App.tsx — Routes
<Route path="/patterns" element={<PatternLibraryPage />} />
<Route path="/patterns/:id" element={<PatternDetailPage />} />
```

---

## Confidence Score Algorithm

Confidence starts at a base and adjusts with applications:

```
base_confidence = 0.50 (manual) | 0.30 (ai_suggested) | 0.60 (imported)

For each application:
  if outcome == 'improved':  confidence += 0.05
  if outcome == 'neutral':   confidence += 0.00
  if outcome == 'declined':  confidence -= 0.08

confidence = clamp(confidence, 0.10, 0.99)

Auto-validate: if confidence >= 0.75 AND application_count >= 3, set status = 'validated'
Auto-deprecate: if confidence <= 0.25, suggest deprecation
```

This is computed client-side on application record, updating the pattern row.

---

## Brain Integration (Pillar 3 → Pillar 7 Loop)

**Now (Phase 1):** Manual pattern creation + manual application tracking.

**Phase 2:** AI pattern suggestions from crawl data. When a crawl completes, compare the site against the pattern library for the company's industry. Surface "This site is missing Pattern X" in the audit.

**Phase 3:** Cross-client pattern detection. When 3+ companies in the same industry show the same characteristic in their top-scoring sites, auto-suggest a new pattern.

**Phase 4:** Outcome-driven learning. When a pattern application has before/after metrics, feed that back into the confidence score automatically. This is Pillar 7 (Learning) completing the loop.

---

## Implementation Order

1. **Migration:** Create `patterns` + `pattern_applications` tables
2. **Seed data:** Insert 15 seed patterns via migration or edge function
3. **Hooks:** `usePatterns.ts` with TanStack Query
4. **PatternLibraryPage:** Browse + search + filter
5. **PatternDetailPage:** View + edit + applications list
6. **PatternForm / ApplicationForm:** Create/edit components
7. **Nav integration:** Add to Growth sidebar
8. **Company detail tab:** Add Patterns tab to Delivery workspace (stretch)

Estimated scope: ~8 new files, 1 migration, 1 seed script.
