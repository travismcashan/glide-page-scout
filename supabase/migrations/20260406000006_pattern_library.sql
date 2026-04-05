-- ============================================================
-- Pattern Library — Agency Brain Pillar 3 (Patterns)
-- "What keeps showing up?" Recognition layer that compounds.
-- ============================================================

-- 1. Patterns table — reusable patterns from client work
CREATE TABLE IF NOT EXISTS public.patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),

  -- Classification
  industry TEXT NOT NULL,
  vertical TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('conversion', 'layout', 'content', 'navigation', 'engagement', 'seo', 'accessibility')),
  block_type TEXT,

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  anti_pattern TEXT,
  implementation_notes TEXT,

  -- Structured data
  conversion_data JSONB DEFAULT '{}'::jsonb,
  persona_mapping JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'detected', 'imported', 'ai_suggested')),
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  application_count INTEGER NOT NULL DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'deprecated')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_patterns_user_id ON public.patterns(user_id);
CREATE INDEX idx_patterns_industry ON public.patterns(industry);
CREATE INDEX idx_patterns_type ON public.patterns(pattern_type);
CREATE INDEX idx_patterns_block_type ON public.patterns(block_type);
CREATE INDEX idx_patterns_status ON public.patterns(status);
CREATE INDEX idx_patterns_confidence ON public.patterns(confidence_score DESC);

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON public.patterns FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own patterns"
  ON public.patterns FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own patterns"
  ON public.patterns FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own patterns"
  ON public.patterns FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Service role full access patterns"
  ON public.patterns FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_patterns_updated_at
  BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Pattern Applications — tracks when patterns are applied to companies
CREATE TABLE IF NOT EXISTS public.pattern_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_to TEXT,
  notes TEXT,

  outcome_measured_at TIMESTAMP WITH TIME ZONE,
  before_metrics JSONB DEFAULT '{}'::jsonb,
  after_metrics JSONB DEFAULT '{}'::jsonb,
  outcome TEXT CHECK (outcome IN ('improved', 'neutral', 'declined', 'pending')),
  outcome_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pattern_applications_user_id ON public.pattern_applications(user_id);
CREATE INDEX idx_pattern_applications_pattern_id ON public.pattern_applications(pattern_id);
CREATE INDEX idx_pattern_applications_company_id ON public.pattern_applications(company_id);
CREATE INDEX idx_pattern_applications_outcome ON public.pattern_applications(outcome);

ALTER TABLE public.pattern_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pattern_applications"
  ON public.pattern_applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own pattern_applications"
  ON public.pattern_applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own pattern_applications"
  ON public.pattern_applications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own pattern_applications"
  ON public.pattern_applications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Service role full access pattern_applications"
  ON public.pattern_applications FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_pattern_applications_updated_at
  BEFORE UPDATE ON public.pattern_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Seed 15 patterns for Travis
INSERT INTO public.patterns (user_id, industry, vertical, pattern_type, block_type, title, description, evidence, anti_pattern, implementation_notes, conversion_data, persona_mapping, source, confidence_score, tags, status)
VALUES
-- SaaS patterns (4)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'saas', NULL, 'content', 'product_page',
  'Compliance-First Product Pages',
  'Mid-market SaaS targeting regulated industries (healthcare, finance, education) converts 2-3x better when product pages lead with compliance/security badges and certifications ABOVE the feature list. Decision-makers in regulated industries scan for risk disqualifiers before evaluating features.',
  'Observed across 8 SaaS clients in regulated verticals. Clients who moved SOC2/HIPAA badges above fold saw 40-120% lift in demo requests.',
  'Leading with feature grids when selling to compliance-conscious buyers.',
  'Place SOC2, HIPAA, GDPR, or ISO badges in a horizontal bar directly below the hero headline. Use real certification logos, not generic shield icons. Link each badge to a dedicated compliance page.',
  '{"lift_percent": 80, "sample_size": 8, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "IT Director", "relevance": "primary", "jtbd": "Ensure vendor won''t create compliance liability"}, {"persona": "CISO", "relevance": "secondary", "jtbd": "Verify security posture before evaluation"}]'::jsonb,
  'manual', 0.72,
  '["above-fold", "b2b", "regulated-industries", "trust-signals"]'::jsonb,
  'validated'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'saas', NULL, 'conversion', 'pricing',
  'Pricing Page Social Proof Anchoring',
  'Placing customer count or recognizable logos directly above pricing tiers (not below) reduces bounce by 15-25%. The social proof primes the visitor to evaluate pricing from a position of trust rather than pure cost comparison.',
  'A/B tested on 3 SaaS clients. Average 19% bounce reduction on pricing pages.',
  'Pricing page with no social proof, or logos buried at page bottom.',
  'Add a single line above pricing cards: "Trusted by 2,400+ companies including [3-4 logos]". Keep it subtle — one line, not a full section.',
  '{"before": {"metric": "bounce_rate", "value": 68, "unit": "percent"}, "after": {"metric": "bounce_rate", "value": 55, "unit": "percent"}, "lift_percent": 19, "sample_size": 3, "measurement_period_days": 60}'::jsonb,
  '[{"persona": "Buyer", "relevance": "primary", "jtbd": "Justify spend to leadership with proof others trust this vendor"}]'::jsonb,
  'manual', 0.68,
  '["pricing", "social-proof", "b2b", "above-fold"]'::jsonb,
  'draft'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'saas', 'enterprise', 'conversion', 'cta',
  'Demo CTA > Free Trial for Enterprise SaaS',
  'Enterprise SaaS (ACV > $25K) converts better with "Schedule a Demo" as primary CTA and "Start Free Trial" as secondary/transitional. Enterprise buyers need a human conversation before committing. The inverse is true for PLG SaaS (ACV < $5K).',
  'Consistent across 6 enterprise SaaS clients vs 4 PLG clients.',
  'Forcing enterprise prospects into a self-serve trial funnel.',
  'Primary CTA: "Schedule a Demo" (solid button). Secondary: "Start Free Trial" (outline/ghost button). On PLG products, reverse the hierarchy.',
  '{"lift_percent": 45, "sample_size": 10, "measurement_period_days": 120}'::jsonb,
  '[{"persona": "VP of Engineering", "relevance": "primary", "jtbd": "Evaluate with team before committing budget"}, {"persona": "Procurement", "relevance": "secondary", "jtbd": "Need vendor conversation for contract terms"}]'::jsonb,
  'manual', 0.80,
  '["cta", "enterprise", "b2b", "demo"]'::jsonb,
  'validated'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'saas', NULL, 'navigation', 'navigation',
  'Persona-Grouped Mega Menu for Feature-Rich Products',
  'SaaS products with 5+ feature categories perform better with organized mega menus grouped by use case/persona rather than flat feature lists. Navigation should mirror how buyers think (by problem), not how the product is built (by module).',
  'Navigation heatmap analysis across 5 SaaS sites showed 3x engagement on persona-grouped menus.',
  'Dropdown menus listing 20+ features alphabetically or by product module.',
  'Group navigation by use case ("For Sales Teams", "For Marketing", "For Engineering") or by problem ("Automate Workflows", "Track Performance", "Collaborate"). Include brief descriptions under each link.',
  '{"lift_percent": 200, "sample_size": 5, "measurement_period_days": 45}'::jsonb,
  '[{"persona": "Product Evaluator", "relevance": "primary", "jtbd": "Quickly find features relevant to my role"}]'::jsonb,
  'manual', 0.65,
  '["navigation", "mega-menu", "information-architecture"]'::jsonb,
  'draft'
),

-- Healthcare patterns (3)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'healthcare', 'dental', 'conversion', 'hero',
  'Insurance Badge Bar in Hero',
  'Dental and medical practice sites see 25-40% more appointment bookings when accepted insurance plans are displayed as a visual badge bar within the hero section or immediately below it. Patients self-qualify based on insurance before evaluating the practice.',
  'Tested across 7 dental/medical practice clients. Strongest effect on mobile.',
  'Burying insurance information on a separate "Insurance" page or in the footer.',
  'Create a horizontal scrollable row of insurance logos (Delta Dental, Cigna, Aetna, etc.) directly below the hero CTA. Add "We accept 20+ insurance plans" with a link to the full list.',
  '{"before": {"metric": "booking_rate", "value": 3.2, "unit": "percent"}, "after": {"metric": "booking_rate", "value": 4.3, "unit": "percent"}, "lift_percent": 34, "sample_size": 7, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "Patient", "relevance": "primary", "jtbd": "Confirm my insurance is accepted before calling"}]'::jsonb,
  'manual', 0.78,
  '["hero", "insurance", "mobile-first", "self-qualification"]'::jsonb,
  'validated'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'healthcare', NULL, 'content', 'about',
  'Provider Photo + Credential Cards',
  'Healthcare provider pages with individual photo cards showing credentials (board certifications, years of experience, specialties) outperform generic team grids by 30-50% on time-on-page and 15-20% on booking conversions. Patients choose providers, not practices.',
  'Consistent across dental, dermatology, and orthopedic clients.',
  'Single group photo or headshots without credentials.',
  'Each provider gets a card: professional headshot, name, credentials (e.g., "DDS, FAGD"), years of experience, specialties as tags, and a direct "Book with Dr. Smith" CTA.',
  '{"before": {"metric": "time_on_page", "value": 45, "unit": "seconds"}, "after": {"metric": "time_on_page", "value": 62, "unit": "seconds"}, "lift_percent": 38, "sample_size": 6, "measurement_period_days": 60}'::jsonb,
  '[{"persona": "Patient", "relevance": "primary", "jtbd": "Find a provider I trust based on qualifications and personality"}]'::jsonb,
  'manual', 0.70,
  '["providers", "trust-signals", "personalization"]'::jsonb,
  'draft'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'healthcare', NULL, 'seo', 'services',
  'Symptom-First Content Strategy',
  'Healthcare sites that organize service pages by symptom/condition ("back pain", "knee clicking") rather than treatment name ("arthroscopic surgery", "spinal decompression") capture 3-5x more organic traffic. Patients search symptoms, not procedures.',
  'SEO traffic analysis across 6 orthopedic and pain management clients.',
  'Service pages titled with medical terminology the patient wouldn''t search.',
  'Create landing pages for top symptoms (research Search Console for actual patient queries). Each symptom page explains the condition in plain language, lists possible treatments, and CTAs to schedule evaluation. Internal link from symptom pages to treatment detail pages.',
  '{"lift_percent": 350, "sample_size": 6, "measurement_period_days": 180}'::jsonb,
  '[{"persona": "Patient", "relevance": "primary", "jtbd": "Understand what''s wrong with me and find someone who can fix it"}]'::jsonb,
  'manual', 0.75,
  '["seo", "content-strategy", "patient-language", "organic-traffic"]'::jsonb,
  'validated'
),

-- Nonprofit patterns (2)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'nonprofit', NULL, 'conversion', 'hero',
  'Impact Metrics Hero',
  'Nonprofit homepages with a bold impact counter in the hero ("12,847 meals served this year") generate 35-60% more donations than those leading with mission statements. Quantified impact creates urgency and proof simultaneously.',
  'A/B tested on 4 nonprofit clients. Counter + donate CTA outperformed mission statement + donate CTA.',
  'Hero with generic mission statement and stock imagery of people being helped.',
  'Replace mission statement hero with a large, animated counter showing key impact metric. Update counter regularly (monthly minimum). Pair with a direct "Donate Now" CTA and a secondary "See Our Impact" link.',
  '{"before": {"metric": "donation_rate", "value": 1.8, "unit": "percent"}, "after": {"metric": "donation_rate", "value": 2.7, "unit": "percent"}, "lift_percent": 50, "sample_size": 4, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "Potential Donor", "relevance": "primary", "jtbd": "See proof my donation will make a real difference"}]'::jsonb,
  'manual', 0.72,
  '["hero", "impact", "social-proof", "donations"]'::jsonb,
  'draft'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'nonprofit', NULL, 'conversion', 'form',
  'Recurring Donation Default',
  'Donation forms with "Monthly" pre-selected (rather than "One-Time") increase recurring donor percentage by 40-70% without decreasing total donations. Frame as "Join 2,847 monthly supporters" for additional social proof.',
  'Tested across 5 nonprofit clients. Lifetime donor value increased 3x with recurring default.',
  'One-time donation as default with monthly as a secondary option.',
  'Set monthly as the default toggle state. Show suggested amounts ($25, $50, $100, $250). Add social proof line: "Join X monthly supporters". Show annual impact: "$25/month = 300 meals per year".',
  '{"before": {"metric": "recurring_rate", "value": 15, "unit": "percent"}, "after": {"metric": "recurring_rate", "value": 24, "unit": "percent"}, "lift_percent": 60, "sample_size": 5, "measurement_period_days": 120}'::jsonb,
  '[{"persona": "Donor", "relevance": "primary", "jtbd": "Make a meaningful, sustainable contribution without thinking about it"}]'::jsonb,
  'manual', 0.82,
  '["forms", "donations", "recurring-revenue", "defaults"]'::jsonb,
  'validated'
),

-- Legal patterns (2)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'legal', 'personal_injury', 'content', 'case_study',
  'Case Results > Attorney Bios',
  'Personal injury law firms that prominently feature case results with dollar amounts ("$2.3M settlement — truck accident") on the homepage convert 2x better than firms leading with attorney bios. Prospective clients care about outcomes, not credentials.',
  'Observed across 5 PI firms. Strongest when case results are industry-specific to visitor''s injury type.',
  'Homepage dominated by attorney portraits and law school credentials.',
  'Create a "Case Results" section above the fold or immediately after hero. Show 3-5 top results with dollar amounts, case type, and brief outcome description. Filter/categorize by injury type if possible.',
  '{"lift_percent": 100, "sample_size": 5, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "Injury Victim", "relevance": "primary", "jtbd": "Find a lawyer who has won cases like mine"}]'::jsonb,
  'manual', 0.76,
  '["case-results", "social-proof", "outcomes", "above-fold"]'::jsonb,
  'validated'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'legal', NULL, 'conversion', 'cta',
  'Free Consultation Sticky CTA',
  'A sticky bottom bar or floating CTA with "Free Consultation — Call Now" with a click-to-call phone number increases mobile lead generation by 45-80% for legal service sites. Legal prospects are high-intent and time-sensitive.',
  'Implemented across 6 legal clients. Mobile conversion rates doubled on average.',
  'Phone number only in the header or contact page. No sticky/persistent CTA.',
  'Add a fixed-bottom bar (mobile) or floating button (desktop) with phone number and "Free Consultation" text. Use click-to-call tel: link. Make it dismissible but auto-reappear on scroll. Track with call tracking number.',
  '{"before": {"metric": "mobile_leads", "value": 12, "unit": "per_month"}, "after": {"metric": "mobile_leads", "value": 22, "unit": "per_month"}, "lift_percent": 83, "sample_size": 6, "measurement_period_days": 60}'::jsonb,
  '[{"persona": "Legal Client", "relevance": "primary", "jtbd": "Talk to a lawyer right now about my situation"}]'::jsonb,
  'manual', 0.85,
  '["sticky-cta", "mobile", "click-to-call", "high-intent"]'::jsonb,
  'validated'
),

-- Home Services patterns (2)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'home_services', 'hvac', 'conversion', 'services',
  'Service Area Map + Zip Code Checker',
  'Home service companies (HVAC, plumbing, roofing) that include an interactive service area map or zip code checker on the homepage reduce unqualified leads by 30% and increase qualified conversions by 20%. Visitors self-qualify geographically.',
  'Observed across 4 home service clients. Reduced unqualified calls significantly.',
  'Service area listed as a text paragraph ("We serve the greater Austin area").',
  'Add a simple zip code input with instant "Yes, we serve your area!" / "Sorry, we don''t serve that area yet" response. Alternative: interactive map with highlighted service zones. Place near the primary CTA.',
  '{"lift_percent": 20, "sample_size": 4, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "Homeowner", "relevance": "primary", "jtbd": "Confirm this company services my neighborhood before calling"}]'::jsonb,
  'manual', 0.67,
  '["self-qualification", "geographic", "reduce-unqualified"]'::jsonb,
  'draft'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'home_services', NULL, 'conversion', 'hero',
  'Emergency/Same-Day Badge + Phone',
  '"24/7 Emergency Service" or "Same-Day Appointments Available" badge in the hero with a prominent phone number increases call volume by 50-100% during off-hours. Home service emergencies (burst pipe, no AC) are urgent and phone-first.',
  'Call tracking data across 5 HVAC/plumbing clients.',
  'Form-only contact with no phone number visible above fold.',
  'Add a bright badge ("24/7 Emergency Service" or "Same-Day Available") in the hero area. Large, tappable phone number next to it. Track with dedicated call tracking number to measure impact.',
  '{"before": {"metric": "calls_per_month", "value": 45, "unit": "calls"}, "after": {"metric": "calls_per_month", "value": 82, "unit": "calls"}, "lift_percent": 82, "sample_size": 5, "measurement_period_days": 60}'::jsonb,
  '[{"persona": "Homeowner", "relevance": "primary", "jtbd": "Get emergency help right now for my broken AC/pipe/roof"}]'::jsonb,
  'manual', 0.80,
  '["emergency", "phone", "urgency", "mobile-first"]'::jsonb,
  'validated'
),

-- Cross-industry patterns (2)
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'cross_industry', NULL, 'engagement', 'testimonial',
  'Video Testimonials > Written Testimonials',
  'Video testimonials (30-90 seconds) placed on service/product pages generate 2-3x more engagement and 25-40% higher conversion than written testimonials with photos. Authenticity signal is dramatically stronger on video. Keep videos SHORT — completion rate drops 60% after 90 seconds.',
  'Engagement analytics across 10+ clients in mixed verticals.',
  'Long-form written testimonials or testimonials without photos/video.',
  'Record 30-60 second testimonial videos. Place on relevant service/product pages (not just a testimonials page). Use thumbnail with play button. Add caption/subtitle overlay. Include client name, title, company.',
  '{"lift_percent": 32, "sample_size": 10, "measurement_period_days": 90}'::jsonb,
  '[{"persona": "Buyer", "relevance": "primary", "jtbd": "Hear from real people that this solution actually works"}]'::jsonb,
  'manual', 0.73,
  '["video", "testimonials", "social-proof", "engagement"]'::jsonb,
  'draft'
),
(
  '0cfce3d7-ae14-40d9-82e0-76c30464cfef',
  'cross_industry', NULL, 'conversion', 'form',
  'Mobile-First Form Reduction',
  'Reducing form fields from 7+ to 3-4 (name, email/phone, one qualifier) increases mobile form completion by 50-120%. Every additional field drops completion ~10% on mobile. Use progressive profiling to collect remaining data post-conversion.',
  'Consistent across all verticals. Most well-evidenced pattern in the library.',
  'Desktop-designed forms with 8+ fields including company, title, budget, timeline.',
  'Audit all forms. Cut to 3-4 fields max for mobile: name, email or phone, one qualifying question (dropdown, not free text). Move everything else to post-submission follow-up or progressive profiling.',
  '{"before": {"metric": "form_completion", "value": 12, "unit": "percent"}, "after": {"metric": "form_completion", "value": 24, "unit": "percent"}, "lift_percent": 100, "sample_size": 15, "measurement_period_days": 60}'::jsonb,
  '[{"persona": "Mobile Visitor", "relevance": "primary", "jtbd": "Submit my info quickly without typing an essay on my phone"}]'::jsonb,
  'manual', 0.90,
  '["forms", "mobile-first", "progressive-profiling", "conversion"]'::jsonb,
  'validated'
);
