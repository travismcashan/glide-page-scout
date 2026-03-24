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

// Priority-ordered super-groups for a web design / dev / marketing agency.
const superGroups: { label: string; subcategories: string[] }[] = [
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
    label: 'Hosting & Infrastructure',
    subcategories: [
      'Cloud Hosting', 'Cloud PaaS', 'Dedicated Hosting', 'Edge Delivery Network',
      'Server Location', 'US hosting', 'Australian hosting', 'Indian hosting',
      'Irish hosting', 'UK Agency', 'US Agency',
    ],
  },
  {
    label: 'Security & Compliance',
    subcategories: [
      'SSL Seals', 'Root Authority', 'CAPTCHA', 'Bot Detection',
      'Privacy Compliance', 'Policy', 'DMARC', 'Login',
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
];

type SuperGroupData = {
  label: string;
  subcategories: { name: string; techs: Technology[] }[];
  totalTechs: number;
};

function buildSuperGroups(grouped: Record<string, Technology[]>): SuperGroupData[] {
  const usedCategories = new Set<string>();
  const result: SuperGroupData[] = [];

  for (const sg of superGroups) {
    const subs: { name: string; techs: Technology[] }[] = [];
    let total = 0;
    for (const sub of sg.subcategories) {
      if (grouped[sub]?.length) {
        subs.push({ name: sub, techs: grouped[sub] });
        total += grouped[sub].length;
        usedCategories.add(sub);
      }
    }
    if (subs.length > 0) {
      result.push({ label: sg.label, subcategories: subs, totalTechs: total });
    }
  }

  const otherSubs: { name: string; techs: Technology[] }[] = [];
  let otherTotal = 0;
  for (const [cat, techs] of Object.entries(grouped)) {
    if (!usedCategories.has(cat) && techs.length > 0) {
      otherSubs.push({ name: cat, techs });
      otherTotal += techs.length;
    }
  }
  if (otherSubs.length > 0) {
    result.push({ label: 'Other', subcategories: otherSubs, totalTechs: otherTotal });
  }

  return result;
}

export function BuiltWithCard({ grouped, totalCount, isLoading, credits }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [hideOld, setHideOld] = useState(true);

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

      <div className="flex items-center gap-4 flex-wrap">
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
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="w-[150px] shrink-0 text-xs font-medium text-muted-foreground">Technology</span>
          <span className="w-[110px] shrink-0 text-xs font-medium text-muted-foreground">Subcategory</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">First Seen</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">Last Seen</span>
          <span className="w-[70px] shrink-0 text-center text-xs font-medium text-muted-foreground">Tag</span>
          <span className="flex-1 text-xs font-medium text-muted-foreground min-w-0">Description</span>
        </div>

        {superGroupData.map((group) => {
          const isCollapsed = collapsedSections.has(group.label);
          const rows = group.subcategories.flatMap(sub =>
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
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{group.totalTechs}</Badge>
              </button>

              {!isCollapsed && rows.map((row, idx) => (
                <ExpandableRow key={`${row.name}-${idx}`} row={row} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
