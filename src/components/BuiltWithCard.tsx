import { Badge } from '@/components/ui/badge';
import { Code, CreditCard, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type Technology = {
  name: string;
  description?: string;
  link?: string;
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
// Order = most relevant first. Each maps BuiltWith subcategories into a group.
const superGroups: { label: string; icon: string; subcategories: string[] }[] = [
  {
    label: 'CMS & Platform',
    icon: '🏗️',
    subcategories: [
      'Framework', 'Hosted Solution', 'Non Platform', 'Open Source',
      'WordPress Theme', 'Shopify Theme', 'WordPress Plugins',
    ],
  },
  {
    label: 'eCommerce & Payments',
    icon: '🛒',
    subcategories: [
      'eCommerce', 'Payment Acceptance', 'Payments Processor', 'Checkout Buttons',
      'Currency', 'Shopify Currency', 'Financial',
    ],
  },
  {
    label: 'Analytics & Marketing',
    icon: '📊',
    subcategories: [
      'Audience Measurement', 'Visitor Count Tracking', 'Tag Management',
      'Marketing Automation', 'Conversion Optimization', 'A/B Testing',
      'Lead Generation', 'Retargeting / Remarketing', 'Contextual Advertising',
      'Ad Exchange', 'Advertiser Tracking', 'Social Management', 'Social Sharing',
    ],
  },
  {
    label: 'UX & Frontend',
    icon: '🎨',
    subcategories: [
      'JavaScript Library', 'jQuery Plugin', 'UI', 'Animation',
      'Fonts', 'Image Provider', 'Compatibility', 'Mobile',
      'Online Video Platform', 'Site Search',
    ],
  },
  {
    label: 'Hosting & Infrastructure',
    icon: '☁️',
    subcategories: [
      'Cloud Hosting', 'Cloud PaaS', 'Dedicated Hosting', 'Edge Delivery Network',
      'Server Location', 'US hosting', 'Australian hosting', 'Indian hosting',
      'Irish hosting', 'UK Agency', 'US Agency',
    ],
  },
  {
    label: 'Security & Compliance',
    icon: '🔒',
    subcategories: [
      'SSL Seals', 'Root Authority', 'CAPTCHA', 'Bot Detection',
      'Privacy Compliance', 'Policy', 'DMARC', 'Login',
    ],
  },
  {
    label: 'Communication & Support',
    icon: '💬',
    subcategories: [
      'Live Chat', 'Ticketing System', 'Feedback Forms and Surveys',
      'Comment System', 'Transactional Email', 'Business Email Hosting',
      'CRM', 'Bookings',
    ],
  },
  {
    label: 'Dev Tools & Performance',
    icon: '⚙️',
    subcategories: [
      'Application Performance', 'Error Tracking', 'Schema',
      'AI Bot',
    ],
  },
];

// Anything not mapped above falls here
const UNCATEGORIZED_LABEL = 'Other';

type SuperGroupData = {
  label: string;
  icon: string;
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
      result.push({ label: sg.label, icon: sg.icon, subcategories: subs, totalTechs: total });
    }
  }

  // Collect unmapped categories
  const otherSubs: { name: string; techs: Technology[] }[] = [];
  let otherTotal = 0;
  for (const [cat, techs] of Object.entries(grouped)) {
    if (!usedCategories.has(cat) && techs.length > 0) {
      otherSubs.push({ name: cat, techs });
      otherTotal += techs.length;
    }
  }
  if (otherSubs.length > 0) {
    result.push({ label: UNCATEGORIZED_LABEL, icon: '📦', subcategories: otherSubs, totalTechs: otherTotal });
  }

  return result;
}

function SuperGroupSection({ group, defaultOpen }: { group: SuperGroupData; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
        <span className="text-sm">{group.icon}</span>
        <span className="text-sm font-medium flex-1">{group.label}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.totalTechs}</Badge>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pt-1 pb-2 space-y-2">
        {group.subcategories.map(({ name, techs }) => (
          <div key={name}>
            <p className="text-[11px] text-muted-foreground font-medium mb-1">{name}</p>
            <div className="flex flex-wrap gap-1">
              {techs.map((tech) => (
                <Badge key={tech.name} variant="outline" className="text-[11px] font-normal">
                  {tech.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BuiltWithCard({ grouped, totalCount, isLoading, credits }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Code className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Detecting technology stack...</span>
      </div>
    );
  }

  const hasCredits = credits && (credits.remaining != null || credits.available != null);
  const superGroupData = grouped ? buildSuperGroups(grouped) : [];

  return (
    <div className="space-y-3">
      {hasCredits && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          <span>Credits: <strong className="text-foreground">{credits.remaining ?? '?'}</strong> remaining of {credits.available ?? '?'}</span>
          {credits.used && <span>({credits.used} used)</span>}
        </div>
      )}

      {(!grouped || totalCount === 0) ? (
        <p className="text-sm text-muted-foreground">No technologies detected for this domain.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Technology Stack</span>
            <Badge variant="secondary">{totalCount} technologies</Badge>
          </div>
          <div className="space-y-1">
            {superGroupData.map((group, i) => (
              <SuperGroupSection key={group.label} group={group} defaultOpen={i < 3} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
