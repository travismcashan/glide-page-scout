import React, { useMemo, useState } from 'react';
import { Check, X, Minus, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FullBleedTable } from './FullBleedTable';

const MIN_VISIBLE_SITES = 3;

type SessionData = { id: string; domain: string; [key: string]: any };

type Props = {
  sessions: SessionData[];
  minPct?: number;
  checkedItems?: Set<string>;
  onCheckedChange?: (items: Set<string>) => void;
};

type TechEntry = {
  name: string;
  category: string;
  sites: Set<string>;
};

function extractTechs(session: any): { name: string; category: string }[] {
  const techs: { name: string; category: string }[] = [];

  const bw = session.builtwith_data;
  if (bw?.grouped) {
    for (const [category, items] of Object.entries(bw.grouped)) {
      if (Array.isArray(items)) {
        for (const t of items as any[]) {
          if (t.name) techs.push({ name: t.name, category });
        }
      }
    }
  } else if (bw?.technologies) {
    for (const t of bw.technologies) {
      if (t.name) techs.push({ name: t.name, category: t.categories?.[0] || t.tag || 'Other' });
    }
  }

  return techs;
}

// Super-groups: ordered from most foundational → least foundational
// minor = true means hidden by default (less relevant for proposals/comparisons)
const SUPER_GROUPS: { label: string; categories: string[]; minor?: boolean }[] = [
  {
    label: 'CMS & Platform',
    categories: ['Open Source', 'Framework', 'Hosted Solution', 'Non Platform',
      'WordPress Theme', 'Shopify Theme', 'WordPress Plugins', 'CMS'],
  },
  {
    label: 'eCommerce & Payments',
    categories: ['eCommerce', 'Payment Acceptance', 'Payments Processor',
      'Checkout Buttons', 'Currency', 'Shopify Currency', 'Financial'],
  },
  {
    label: 'Frontend & UX',
    categories: ['JavaScript Library', 'jQuery Plugin', 'UI', 'Compatibility',
      'Mobile', 'JavaScript frameworks', 'Web frameworks', 'Animation', 'Fonts',
      'Font scripts', 'Image Provider'],
  },
  {
    label: 'Analytics & Marketing',
    categories: ['Audience Measurement', 'Visitor Count Tracking', 'Tag Management',
      'Analytics', 'Tag managers', 'Marketing Automation', 'Conversion Optimization',
      'A/B Testing', 'Lead Generation', 'Marketing',
      'Retargeting / Remarketing', 'Contextual Advertising',
      'Ad Exchange', 'Advertiser Tracking'],
  },
  {
    label: 'Communication & Support',
    categories: ['Live Chat', 'Ticketing System', 'Feedback Forms and Surveys',
      'Comment System', 'Transactional Email', 'Business Email Hosting',
      'CRM', 'Bookings'],
  },
  {
    label: 'Social & Content',
    categories: ['Social Management', 'Social Sharing',
      'Online Video Platform', 'Site Search'],
  },
  // --- Less relevant for proposals / hidden by default ---
  {
    label: 'Hosting & Infrastructure',
    minor: true,
    categories: ['Cloud Hosting', 'Cloud PaaS', 'Dedicated Hosting',
      'Edge Delivery Network', 'Server Location', 'US hosting',
      'Australian hosting', 'Indian hosting', 'Irish hosting',
      'UK Agency', 'US Agency', 'CDN', 'Hosting'],
  },
  {
    label: 'Dev Tools & Performance',
    minor: true,
    categories: ['Application Performance', 'Error Tracking', 'Schema', 'AI Bot'],
  },
  {
    label: 'Security & Compliance',
    minor: true,
    categories: ['SSL Seals', 'Root Authority', 'CAPTCHA', 'Bot Detection',
      'Privacy Compliance', 'Policy', 'DMARC', 'Login', 'Security'],
  },
];

// Build a lookup: lowercase category name → super-group label
const CATEGORY_TO_GROUP = new Map<string, string>();
SUPER_GROUPS.forEach((group) => {
  for (const cat of group.categories) {
    CATEGORY_TO_GROUP.set(cat.toLowerCase(), group.label);
  }
});

// Tech name → super-group label override (rescues miscategorized techs from "Other")
const TECH_NAME_OVERRIDES = new Map<string, string>([
  // Analytics & Marketing
  ['google analytics', 'Analytics & Marketing'],
  ['google analytics 4', 'Analytics & Marketing'],
  ['google universal analytics', 'Analytics & Marketing'],
  ['facebook pixel', 'Analytics & Marketing'],
  ['meta pixel', 'Analytics & Marketing'],
  ['google tag manager', 'Analytics & Marketing'],
  ['google webmaster', 'Analytics & Marketing'],
  ['google search console', 'Analytics & Marketing'],
  ['hotjar', 'Analytics & Marketing'],
  ['hubspot analytics', 'Analytics & Marketing'],
  ['microsoft clarity', 'Analytics & Marketing'],
  ['google ads', 'Analytics & Marketing'],
  ['google ads conversion tracking', 'Analytics & Marketing'],
  ['google remarketing', 'Analytics & Marketing'],
  ['linkedin insight tag', 'Analytics & Marketing'],
  ['pinterest tag', 'Analytics & Marketing'],
  ['tiktok pixel', 'Analytics & Marketing'],
  ['bing ads', 'Analytics & Marketing'],
  ['crazy egg', 'Analytics & Marketing'],
  ['lucky orange', 'Analytics & Marketing'],
  ['matomo', 'Analytics & Marketing'],
  ['plausible', 'Analytics & Marketing'],
  ['fathom', 'Analytics & Marketing'],
  ['mixpanel', 'Analytics & Marketing'],
  ['segment', 'Analytics & Marketing'],
  ['amplitude', 'Analytics & Marketing'],
  ['pardot', 'Analytics & Marketing'],
  ['marketo', 'Analytics & Marketing'],
  ['activecampaign', 'Analytics & Marketing'],
  ['mailchimp', 'Analytics & Marketing'],
  ['klaviyo', 'Analytics & Marketing'],
  ['constant contact', 'Analytics & Marketing'],
  ['convertkit', 'Analytics & Marketing'],

  // Security & Compliance
  ['recaptcha', 'Security & Compliance'],
  ['google recaptcha', 'Security & Compliance'],
  ['recaptcha v3', 'Security & Compliance'],
  ['recaptcha v2', 'Security & Compliance'],
  ['hcaptcha', 'Security & Compliance'],
  ['cloudflare turnstile', 'Security & Compliance'],
  ['google sign-in', 'Security & Compliance'],
  ['lets encrypt', 'Security & Compliance'],
  ["let's encrypt", 'Security & Compliance'],
  ['sectigo', 'Security & Compliance'],
  ['digicert', 'Security & Compliance'],
  ['sucuri', 'Security & Compliance'],
  ['wordfence', 'Security & Compliance'],

  // eCommerce & Payments
  ['woocommerce', 'eCommerce & Payments'],
  ['stripe', 'eCommerce & Payments'],
  ['paypal', 'eCommerce & Payments'],
  ['square', 'eCommerce & Payments'],
  ['shopify', 'eCommerce & Payments'],
  ['bigcommerce', 'eCommerce & Payments'],

  // Social & Content
  ['google maps', 'Social & Content'],
  ['google maps api', 'Social & Content'],
  ['youtube', 'Social & Content'],
  ['vimeo', 'Social & Content'],
  ['wistia', 'Social & Content'],
  ['instagram feed', 'Social & Content'],
  ['twitter feed', 'Social & Content'],
  ['facebook like', 'Social & Content'],
  ['addtoany', 'Social & Content'],
  ['sharethis', 'Social & Content'],

  // CMS & Platform
  ['elementor', 'CMS & Platform'],
  ['divi', 'CMS & Platform'],
  ['wpbakery', 'CMS & Platform'],
  ['beaver builder', 'CMS & Platform'],
  ['oxygen builder', 'CMS & Platform'],
  ['bricks builder', 'CMS & Platform'],
  ['advanced custom fields', 'CMS & Platform'],
  ['acf', 'CMS & Platform'],
  ['gravity forms', 'CMS & Platform'],
  ['contact form 7', 'CMS & Platform'],
  ['wpforms', 'CMS & Platform'],
  ['ninja forms', 'CMS & Platform'],
  ['formidable forms', 'CMS & Platform'],
  ['yoast seo', 'CMS & Platform'],
  ['rank math', 'CMS & Platform'],
  ['all in one seo', 'CMS & Platform'],
  ['wordpress', 'CMS & Platform'],
  ['drupal', 'CMS & Platform'],
  ['joomla', 'CMS & Platform'],
  ['squarespace', 'CMS & Platform'],
  ['wix', 'CMS & Platform'],
  ['webflow', 'CMS & Platform'],
  ['contentful', 'CMS & Platform'],
  ['sanity', 'CMS & Platform'],
  ['strapi', 'CMS & Platform'],

  // Frontend & UX
  ['jquery', 'Frontend & UX'],
  ['react', 'Frontend & UX'],
  ['vue.js', 'Frontend & UX'],
  ['angular', 'Frontend & UX'],
  ['next.js', 'Frontend & UX'],
  ['nuxt.js', 'Frontend & UX'],
  ['bootstrap', 'Frontend & UX'],
  ['tailwind css', 'Frontend & UX'],
  ['font awesome', 'Frontend & UX'],
  ['google fonts', 'Frontend & UX'],
  ['google font api', 'Frontend & UX'],
  ['gsap', 'Frontend & UX'],
  ['slick', 'Frontend & UX'],
  ['swiper', 'Frontend & UX'],
  ['owl carousel', 'Frontend & UX'],
  ['lightbox', 'Frontend & UX'],
  ['fancybox', 'Frontend & UX'],
  ['lodash', 'Frontend & UX'],
  ['underscore.js', 'Frontend & UX'],
  ['modernizr', 'Frontend & UX'],

  // Hosting & Infrastructure
  ['cloudflare', 'Hosting & Infrastructure'],
  ['amazon s3', 'Hosting & Infrastructure'],
  ['amazon cloudfront', 'Hosting & Infrastructure'],
  ['aws', 'Hosting & Infrastructure'],
  ['google cloud', 'Hosting & Infrastructure'],
  ['azure', 'Hosting & Infrastructure'],
  ['nginx', 'Hosting & Infrastructure'],
  ['apache', 'Hosting & Infrastructure'],
  ['wp engine', 'Hosting & Infrastructure'],
  ['flywheel', 'Hosting & Infrastructure'],
  ['kinsta', 'Hosting & Infrastructure'],
  ['siteground', 'Hosting & Infrastructure'],
  ['godaddy', 'Hosting & Infrastructure'],
  ['netlify', 'Hosting & Infrastructure'],
  ['vercel', 'Hosting & Infrastructure'],
  ['fastly', 'Hosting & Infrastructure'],
  ['akamai', 'Hosting & Infrastructure'],
  ['wp rocket', 'Hosting & Infrastructure'],
  ['w3 total cache', 'Hosting & Infrastructure'],
  ['litespeed cache', 'Hosting & Infrastructure'],

  // Communication & Support
  ['zendesk', 'Communication & Support'],
  ['intercom', 'Communication & Support'],
  ['hubspot', 'Communication & Support'],
  ['hubspot crm', 'Communication & Support'],
  ['salesforce', 'Communication & Support'],
  ['drift', 'Communication & Support'],
  ['tidio', 'Communication & Support'],
  ['livechat', 'Communication & Support'],
  ['tawk.to', 'Communication & Support'],
  ['crisp', 'Communication & Support'],
  ['freshdesk', 'Communication & Support'],
  ['calendly', 'Communication & Support'],
]);

// Techs to hide entirely — plumbing/noise that tells you nothing about scope
const HIDDEN_TECHS = new Set([
  'php', 'mysql', 'apache', 'nginx', 'perl', 'python', 'ruby', 'java',
  'utf-8', 'viewport meta', 'meta viewport',
  'open graph', 'og meta tags', 'twitter cards', 'schema.org',
  'rss', 'gravatar', 'emoji',
  'covid-19', 'covid',
  'http/2', 'http/3', 'http2', 'http3', 'spdy',
  'ipv6', 'dns',
  'x-powered-by',
  'content-type-options', 'x-frame-options', 'x-xss-protection',
  'strict-transport-security', 'hsts',
  'doctype html5', 'html5',
  'windows server', 'ubuntu', 'debian', 'centos', 'linux',
]);

type CategoryWithTechs = { name: string; techs: TechEntry[] };
type SuperGroupWithCategories = { label: string; minor?: boolean; categories: CategoryWithTechs[] };

export function GroupTechMatrix({ sessions, minPct = 0, checkedItems, onCheckedChange }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedBelowSections, setExpandedBelowSections] = useState<Set<string>>(new Set());
  const [showSmallCategories, setShowSmallCategories] = useState(false);
  const [showMinorGroups, setShowMinorGroups] = useState(false);

  const { techMap, superGroups, sharedTechs, uniqueTechs } = useMemo(() => {
    const map = new Map<string, TechEntry>();

    for (const session of sessions) {
      const techs = extractTechs(session);
      for (const t of techs) {
        const key = t.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name: t.name, category: t.category, sites: new Set() });
        }
        map.get(key)!.sites.add(session.id);
      }
    }

    // Filter out noise techs and reclassify via name overrides
    for (const [key, entry] of map.entries()) {
      if (HIDDEN_TECHS.has(entry.name.toLowerCase())) {
        map.delete(key);
        continue;
      }
      // Check if tech name has a super-group override
      const override = TECH_NAME_OVERRIDES.get(entry.name.toLowerCase());
      if (override) {
        // Find a category name within that super-group to assign it to
        const sg = SUPER_GROUPS.find(g => g.label === override);
        if (sg && sg.categories.length > 0) {
          // Use the first category in the super-group as the bucket
          entry.category = sg.categories[0];
        }
      }
    }

    // Group techs by category
    const catMap = new Map<string, TechEntry[]>();
    for (const entry of map.values()) {
      const cat = entry.category;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(entry);
    }

    // Sort within categories by adoption
    for (const entries of catMap.values()) {
      entries.sort((a, b) => b.sites.size - a.sites.size);
    }

    // Build super-groups
    const groups: SuperGroupWithCategories[] = [];
    const placed = new Set<string>();

    for (const sg of SUPER_GROUPS) {
      const cats: CategoryWithTechs[] = [];
      for (const catName of sg.categories) {
        // Find matching category (case-insensitive)
        for (const [actualCat, techs] of catMap.entries()) {
          if (actualCat.toLowerCase() === catName.toLowerCase() && !placed.has(actualCat)) {
            cats.push({ name: actualCat, techs });
            placed.add(actualCat);
          }
        }
      }
      if (cats.length > 0) {
        groups.push({ label: sg.label, minor: sg.minor, categories: cats });
      }
    }

    // Catch any categories not in super-groups → "Other" (hidden by default)
    const uncategorized: CategoryWithTechs[] = [];
    for (const [catName, techs] of catMap.entries()) {
      if (!placed.has(catName)) {
        uncategorized.push({ name: catName, techs });
      }
    }
    if (uncategorized.length > 0) {
      groups.push({ label: 'Other', minor: true, categories: uncategorized });
    }

    const shared = Array.from(map.values()).filter(t => t.sites.size === sessions.length);
    const unique = Array.from(map.values()).filter(t => t.sites.size === 1);

    return {
      techMap: map,
      superGroups: groups,
      sharedTechs: shared,
      uniqueTechs: unique,
    };
  }, [sessions]);

  const sessionsWithData = sessions.filter(s => {
    const bw = s.builtwith_data;
    return bw?.grouped || bw?.technologies;
  });
  const minSites = Math.max(1, Math.ceil(sessionsWithData.length * minPct / 100));

  const toggleCollapse = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleExpandBelow = (key: string) => {
    setExpandedBelowSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (techMap.size === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No technology data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Technology</h3>
        <p className="text-sm text-muted-foreground">Technologies and platforms detected across sites</p>
      </div>

      {sessions.length > 1 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{sharedTechs.length}</span>
            <span className="text-muted-foreground">shared across all sites</span>
          </div>
          {uniqueTechs.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-medium">{uniqueTechs.length}</span>
              <span className="text-muted-foreground">unique to one site</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium">{techMap.size}</span>
            <span className="text-muted-foreground">technologies detected</span>
          </div>
        </div>
      )}

      {(() => {
        // Flatten all categories across super-groups for major/minor split
        const allCategories = superGroups.flatMap(sg => sg.categories);
        const minorCategoryNames = new Set(allCategories.filter(cat => cat.techs.length < 2).map(c => c.name));

        const renderCategory = (cat: CategoryWithTechs) => {
          const isCollapsed = collapsedSections.has(cat.name);
          const isExpandedBelow = expandedBelowSections.has(cat.name);

          const aboveThreshold = cat.techs.filter(t => t.sites.size >= MIN_VISIBLE_SITES);
          const belowThreshold = cat.techs.filter(t => t.sites.size < MIN_VISIBLE_SITES);
          const inScopeCount = checkedItems?.size
            ? cat.techs.filter(t => checkedItems.has(t.name)).length
            : cat.techs.filter(t => t.sites.size >= minSites).length;
          const hasBelowItems = belowThreshold.length > 0;

          return (
            <React.Fragment key={cat.name}>
              <tr
                className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => toggleCollapse(cat.name)}
              >
                <td colSpan={sessions.length + 2} className="py-1.5 px-3">
                  <div className="flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    }
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {inScopeCount}/{cat.techs.length}
                    </Badge>
                  </div>
                </td>
              </tr>

              {!isCollapsed && aboveThreshold.map(tech => {
                const isChecked = checkedItems?.size ? checkedItems.has(tech.name) : tech.sites.size >= minSites;
                const toggleCheck = () => {
                  if (!onCheckedChange) return;
                  const next = new Set(checkedItems);
                  next.has(tech.name) ? next.delete(tech.name) : next.add(tech.name);
                  onCheckedChange(next);
                };
                return (
                  <tr key={tech.name} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isChecked} onCheckedChange={toggleCheck} className="h-3.5 w-3.5 shrink-0 cursor-pointer" />
                        <span className={`text-sm whitespace-nowrap ${isChecked ? '' : 'line-through text-muted-foreground'}`}>{tech.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`text-xs font-medium ${isChecked ? (tech.sites.size === sessions.length ? 'text-emerald-600' : 'text-foreground') : 'text-destructive'}`}>
                        {tech.sites.size}/{sessions.length}
                      </span>
                    </td>
                    {sessions.map(s => (
                      <td key={s.id} className="text-center py-2 px-3">
                        {tech.sites.has(s.id) ? (
                          isChecked ? (
                            <Check className="h-4 w-4 mx-auto text-emerald-500" />
                          ) : (
                            <X className="h-4 w-4 mx-auto text-destructive" />
                          )
                        ) : (
                          <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {!isCollapsed && hasBelowItems && !isExpandedBelow && (
                <tr className="border-b border-border/30">
                  <td colSpan={sessions.length + 2}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpandBelow(cat.name); }}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronsUpDown className="h-3 w-3" />
                      Show {belowThreshold.length} more on fewer than {MIN_VISIBLE_SITES} sites
                    </button>
                  </td>
                </tr>
              )}

              {!isCollapsed && isExpandedBelow && belowThreshold.map(tech => (
                <tr key={tech.name} className="border-b border-border/30 transition-colors hover:bg-muted/20 opacity-30">
                  <td className="py-2 px-3 text-sm whitespace-nowrap line-through">{tech.name}</td>
                  <td className="text-center py-2 px-2">
                    <span className="text-xs font-medium text-muted-foreground/40">
                      {tech.sites.size}/{sessions.length}
                    </span>
                  </td>
                  {sessions.map(s => (
                    <td key={s.id} className="text-center py-2 px-3">
                      {tech.sites.has(s.id) ? (
                        <Check className="h-4 w-4 mx-auto text-muted-foreground/30" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground/20" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {!isCollapsed && isExpandedBelow && hasBelowItems && (
                <tr className="border-b border-border/30">
                  <td colSpan={sessions.length + 2}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpandBelow(cat.name); }}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronsUpDown className="h-3 w-3" />
                      Hide items on fewer than {MIN_VISIBLE_SITES} sites
                    </button>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        };

        // Count minor categories (1 tech) and minor super-groups for buttons
        const minorCategoryCount = minorCategoryNames.size;
        const majorGroups = superGroups.filter(sg => !sg.minor);
        const minorGroups = superGroups.filter(sg => sg.minor);
        const minorGroupTechCount = minorGroups.reduce(
          (sum, sg) => sum + sg.categories.reduce((s, c) => s + c.techs.length, 0), 0
        );

        const visibleGroups = showMinorGroups ? superGroups : majorGroups;

        return (
          <>
            <FullBleedTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Technology</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Sites</th>
                    {sessions.map(s => (
                      <th key={s.id} className="text-center py-3 px-3 font-medium text-xs max-w-[100px]">
                        <span className="truncate block">{s.domain.replace('www.', '')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map(sg => {
                    const majorCats = sg.categories.filter(c => !minorCategoryNames.has(c.name));
                    const visibleCats = showSmallCategories ? sg.categories : majorCats;

                    // Skip entire super-group if nothing to show
                    if (visibleCats.length === 0) return null;

                    return (
                      <React.Fragment key={sg.label}>
                        {/* Super-group header */}
                        <tr>
                          <td colSpan={sessions.length + 2} className="pt-10 pb-4 px-3 first:pt-4">
                            <h3 className="text-4xl font-light tracking-tight text-foreground">{sg.label}</h3>
                          </td>
                        </tr>
                        {visibleCats.map(renderCategory)}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </FullBleedTable>

            {(minorCategoryCount > 0 || minorGroups.length > 0) && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                {minorCategoryCount > 0 && (
                  <button
                    onClick={() => setShowSmallCategories(prev => !prev)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                    {showSmallCategories
                      ? `Hide ${minorCategoryCount} categories with 1 technology`
                      : `Show ${minorCategoryCount} more categories with 1 technology`
                    }
                  </button>
                )}
                {minorGroups.length > 0 && (
                  <button
                    onClick={() => setShowMinorGroups(prev => !prev)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                    {showMinorGroups
                      ? `Hide ${minorGroups.length} infrastructure & compliance sections`
                      : `Show ${minorGroups.length} more sections (infrastructure, compliance & other)`
                    }
                  </button>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
