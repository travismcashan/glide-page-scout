import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, CreditCard, ChevronRight, ChevronDown, EyeOff, Eye } from 'lucide-react';
import { useState, useMemo } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';

function formatEpoch(epoch?: number): string {
  if (!epoch) return '—';
  // BuiltWith uses milliseconds
  const d = new Date(epoch);
  if (isNaN(d.getTime())) return '—';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${year}`;
}

type Technology = {
  name: string;
  description?: string;
  link?: string;
  firstDetected?: number;
  lastDetected?: number;
  tag?: string;
  isPremium?: boolean;
};

type Credits = {
  available?: string | null;
  used?: string | null;
  remaining?: string | null;
};

type Props = {
  grouped: Record<string, Technology[]> | null;
  totalCount: number;
  isLoading: boolean;
  credits?: Credits | null;
};

// Techs to hide entirely — plumbing/noise
const HIDDEN_TECHS = new Set([
  'php', 'mysql', 'apache', 'nginx', 'perl', 'python', 'ruby', 'java',
  'utf-8', 'viewport meta', 'meta viewport',
  'open graph', 'og meta tags', 'twitter cards', 'schema.org',
  'rss', 'gravatar', 'emoji',
  'http/2', 'http/3', 'http2', 'http3', 'spdy',
  'ipv6', 'dns', 'x-powered-by',
  'content-type-options', 'x-frame-options', 'x-xss-protection',
  'strict-transport-security', 'hsts',
  'doctype html5', 'html5',
  'windows server', 'ubuntu', 'debian', 'centos', 'linux',
]);

// Priority-ordered super-groups for a web design / dev / marketing agency.
// minor: true = hidden by default (infrastructure plumbing)
const superGroups: { label: string; subcategories: string[]; minor?: boolean }[] = [
  {
    label: 'CMS & Platform',
    subcategories: [
      'Framework', 'Hosted Solution', 'Non Platform', 'Open Source',
      'WordPress Theme', 'Shopify Theme', 'WordPress Plugins',
    ],
  },
  {
    label: 'eCommerce & Payments',
    subcategories: [
      'eCommerce', 'Payment Acceptance', 'Payments Processor', 'Checkout Buttons',
      'Currency', 'Shopify Currency', 'Financial',
    ],
  },
  {
    label: 'Analytics & Marketing',
    subcategories: [
      'Audience Measurement', 'Visitor Count Tracking', 'Tag Management',
      'Marketing Automation', 'Conversion Optimization', 'A/B Testing',
      'Lead Generation', 'Retargeting / Remarketing', 'Contextual Advertising',
      'Ad Exchange', 'Advertiser Tracking', 'Social Management', 'Social Sharing',
    ],
  },
  {
    label: 'UX & Frontend',
    subcategories: [
      'JavaScript Library', 'jQuery Plugin', 'UI', 'Animation',
      'Fonts', 'Image Provider', 'Compatibility', 'Mobile',
      'Online Video Platform', 'Site Search',
    ],
  },
  {
    label: 'Communication & Support',
    subcategories: [
      'Live Chat', 'Ticketing System', 'Feedback Forms and Surveys',
      'Comment System', 'Transactional Email', 'Business Email Hosting',
      'CRM', 'Bookings',
    ],
  },
  {
    label: 'Dev Tools & Performance',
    subcategories: [
      'Application Performance', 'Error Tracking', 'Schema',
      'AI Bot',
    ],
  },
  {
    label: 'Hosting & Infrastructure',
    minor: true,
    subcategories: [
      'Cloud Hosting', 'Cloud PaaS', 'Dedicated Hosting', 'Edge Delivery Network',
      'Server Location', 'US hosting', 'Australian hosting', 'Indian hosting',
      'Irish hosting', 'UK Agency', 'US Agency',
    ],
  },
  {
    label: 'Security & Compliance',
    minor: true,
    subcategories: [
      'SSL Seals', 'Root Authority', 'CAPTCHA', 'Bot Detection',
      'Privacy Compliance', 'Policy', 'DMARC', 'Login',
    ],
  },
];

type SuperGroupData = {
  label: string;
  subcategories: { name: string; techs: Technology[] }[];
  totalTechs: number;
};

function buildSuperGroups(grouped: Record<string, Technology[]>): (SuperGroupData & { minor?: boolean })[] {
  const usedCategories = new Set<string>();
  const result: (SuperGroupData & { minor?: boolean })[] = [];

  // Filter hidden techs from all categories first
  const filtered: Record<string, Technology[]> = {};
  for (const [cat, techs] of Object.entries(grouped)) {
    const clean = techs.filter(t => !HIDDEN_TECHS.has(t.name.toLowerCase()));
    if (clean.length > 0) filtered[cat] = clean;
  }

  for (const sg of superGroups) {
    const subs: { name: string; techs: Technology[] }[] = [];
    let total = 0;
    for (const sub of sg.subcategories) {
      if (filtered[sub]?.length) {
        subs.push({ name: sub, techs: filtered[sub] });
        total += filtered[sub].length;
        usedCategories.add(sub);
      }
    }
    if (subs.length > 0) {
      result.push({ label: sg.label, subcategories: subs, totalTechs: total, minor: sg.minor });
    }
  }

  const otherSubs: { name: string; techs: Technology[] }[] = [];
  let otherTotal = 0;
  for (const [cat, techs] of Object.entries(filtered)) {
    if (!usedCategories.has(cat) && techs.length > 0) {
      otherSubs.push({ name: cat, techs });
      otherTotal += techs.length;
    }
  }
  if (otherSubs.length > 0) {
    result.push({ label: 'Other', subcategories: otherSubs, totalTechs: otherTotal, minor: true });
  }

  return result;
}
type RowData = Technology & { subcategory: string };

function ExpandableRow({ row }: { row: RowData }) {
  const [expanded, setExpanded] = useState(false);
  const desc = row.description || '—';
  const isLong = desc.length > 60;

  return (
    <div
      className="flex items-start gap-3 px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors cursor-default"
      onClick={isLong ? () => setExpanded(!expanded) : undefined}
    >
      <span className="w-[180px] shrink-0 text-xs leading-5 truncate">{row.name}</span>
      <span className="w-[110px] shrink-0 text-xs leading-5 text-muted-foreground truncate">{row.subcategory}</span>
      <span className="w-[70px] shrink-0 text-center text-xs leading-5 text-muted-foreground">{formatEpoch(row.firstDetected)}</span>
      <span className="w-[70px] shrink-0 text-center text-xs leading-5 text-muted-foreground">{formatEpoch(row.lastDetected)}</span>
      <span className="w-[70px] shrink-0 text-center text-xs leading-5 text-muted-foreground">{row.tag || '—'}</span>
      <span className={`flex-1 text-xs leading-5 text-muted-foreground min-w-0 ${expanded ? '' : 'truncate'} ${isLong ? 'cursor-pointer' : ''}`}>
        {desc}
      </span>
    </div>
  );
}

export function BuiltWithCard({ grouped, totalCount, isLoading, credits }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [hideOld, setHideOld] = useState(true);
  const [showMinorGroups, setShowMinorGroups] = useState(false);
  const [showSmallCategories, setShowSmallCategories] = useState(false);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const hasCredits = credits && (credits.remaining != null || credits.available != null);
  const allSuperGroups = useMemo(() => grouped ? buildSuperGroups(grouped) : [], [grouped]);

  // "Current" = lastDetected within the last 6 months from now
  const recencyCutoff = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return sixMonthsAgo.getTime();
  }, []);

  const isCurrent = (t: Technology) => !!(t.lastDetected && t.lastDetected >= recencyCutoff);

  const superGroupData = useMemo(() => {
    if (!hideOld) return allSuperGroups;
    return allSuperGroups.map(g => ({
      ...g,
      subcategories: g.subcategories.map(sub => ({
        ...sub,
        techs: sub.techs.filter(isCurrent),
      })).filter(sub => sub.techs.length > 0),
      totalTechs: g.subcategories.reduce((sum, sub) => sum + sub.techs.filter(isCurrent).length, 0),
    })).filter(g => g.totalTechs > 0);
  }, [allSuperGroups, hideOld, recencyCutoff]);

  const visibleCount = superGroupData.reduce((sum, g) => sum + g.totalTechs, 0);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Code className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Detecting technology stack...</span>
      </div>
    );
  }

  if (!grouped || totalCount === 0) {
    return <p className="text-sm text-muted-foreground">No technologies detected for this domain.</p>;
  }

  return (
    <div className="space-y-4">
      {hasCredits && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          <span>Credits: <strong className="text-foreground text-sm">{credits.remaining ?? '?'}</strong> remaining of {credits.available ?? '?'}</span>
          {credits.used && <span>({credits.used} used)</span>}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <MetaStat value={visibleCount} label="Technologies" />
        <MetaStatDivider />
        <MetaStat value={superGroupData.length} label="Categories" />
        <div className="ml-auto">
          <Button
            variant={hideOld ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setHideOld(!hideOld)}
          >
            {hideOld ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideOld ? 'Show all' : 'Hide old technologies'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header — matches all other tables */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center gap-3 px-3 py-1.5 border-b border-border">
          <span className="w-[180px] shrink-0 text-xs font-medium text-muted-foreground">Technology</span>
          <span className="w-[110px] shrink-0 text-xs font-medium text-muted-foreground">Subcategory</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">First Seen</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">Last Seen</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">Tag</span>
          <span className="flex-1 text-xs font-medium text-muted-foreground min-w-0">Description</span>
        </div>

        {superGroupData
          .filter(group => showMinorGroups || !group.minor)
          .map((group) => {
            const isCollapsed = collapsedSections.has(group.label);
            // Filter subcategories with only 1 tech unless toggled
            const visibleSubs = showSmallCategories
              ? group.subcategories
              : group.subcategories.filter(sub => sub.techs.length >= 2);
            if (visibleSubs.length === 0) return null;

            const rows = visibleSubs.flatMap(sub =>
              sub.techs.map(tech => ({ ...tech, subcategory: sub.name }))
            );

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleSection(group.label)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  }
                  <span className="text-xs font-semibold text-foreground">{group.label}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{rows.length}</Badge>
                </button>

                {!isCollapsed && rows.map((row, idx) => (
                  <ExpandableRow key={`${row.name}-${idx}`} row={row} />
                ))}
              </div>
            );
          })}
      </div>

      {/* Toggle buttons for hidden content */}
      <div className="flex flex-wrap gap-2">
        {(() => {
          const smallCatCount = superGroupData
            .filter(g => showMinorGroups || !g.minor)
            .reduce((sum, g) => sum + g.subcategories.filter(s => s.techs.length < 2).length, 0);
          const minorGroupCount = superGroupData.filter(g => g.minor).length;
          return (
            <>
              {smallCatCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowSmallCategories(!showSmallCategories)}
                >
                  {showSmallCategories
                    ? `Hide ${smallCatCount} categories with 1 technology`
                    : `Show ${smallCatCount} more categories with 1 technology`}
                </Button>
              )}
              {minorGroupCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setShowMinorGroups(!showMinorGroups)}
                >
                  {showMinorGroups
                    ? `Hide ${minorGroupCount} infrastructure & compliance sections`
                    : `Show ${minorGroupCount} more sections…`}
                </Button>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
