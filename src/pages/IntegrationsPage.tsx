import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Check, X, Wrench, Clock, Pause, Play } from 'lucide-react';
import { getPausedIntegrations, toggleIntegrationPause } from '@/lib/integrationState';

type Status = 'active' | 'coming-soon';

type Integration = {
  name: string;
  id: string; // stable key for pause state
  description: string;
  secretKey: string;
  configured: boolean;
  category: 'technology' | 'performance' | 'seo' | 'content' | 'ux' | 'security' | 'intelligence' | 'enrichment';
  status: Status;
};

const integrations: Integration[] = [
  { name: 'Firecrawl', id: 'firecrawl', description: 'Web scraping, content extraction, and sitemap discovery', secretKey: 'FIRECRAWL_API_KEY', configured: true, category: 'content', status: 'active' },
  { name: 'BuiltWith', id: 'builtwith', description: 'Technology stack detection with historical data', secretKey: 'BUILTWITH_API_KEY', configured: true, category: 'technology', status: 'active' },
  { name: 'Wappalyzer', id: 'wappalyzer', description: 'Real-time technology profiling with version detection', secretKey: 'WAPPALYZER_API_KEY', configured: true, category: 'technology', status: 'active' },
  { name: 'GTmetrix', id: 'gtmetrix', description: 'Lighthouse performance audits and Web Vitals', secretKey: 'GTMETRIX_API_KEY', configured: true, category: 'performance', status: 'active' },
  { name: 'Google PageSpeed Insights', id: 'psi', description: 'Mobile & desktop Lighthouse scores and Core Web Vitals', secretKey: 'GOOGLE_PSI_API_KEY', configured: true, category: 'performance', status: 'active' },
  { name: 'SEMrush', id: 'semrush', description: 'Domain overview, organic keywords, and backlinks', secretKey: 'SEMRUSH_API_KEY', configured: true, category: 'seo', status: 'active' },
  { name: 'Thum.io', id: 'thumio', description: 'Full-page website screenshots', secretKey: 'THUMIO_SECRET_KEY', configured: true, category: 'content', status: 'active' },
  { name: 'Website Carbon API', id: 'carbon', description: 'CO₂ footprint per page load — free, no API key required', secretKey: '', configured: true, category: 'performance', status: 'active' },

  { name: 'Applitools Eyes', id: 'applitools', description: 'Visual AI that critiques layout structure, detects visual gravity issues, and catches layout shifts that pass code checks but look wrong to humans', secretKey: '', configured: false, category: 'ux', status: 'coming-soon' },
  { name: 'Axe-core (Deque)', id: 'axe', description: 'Industry-standard WCAG accessibility audits with structured JSON reports and exact code-fix suggestions for every violation', secretKey: '', configured: false, category: 'ux', status: 'coming-soon' },
  { name: 'Ahrefs', id: 'ahrefs', description: 'Deep backlink profiles and internal link architecture analysis — see if a site\'s information architecture matches its business goals', secretKey: '', configured: false, category: 'seo', status: 'coming-soon' },
  { name: 'Similarweb', id: 'similarweb', description: 'Estimated traffic volume, bounce rates, and referral sources — the reality check for keyword data', secretKey: '', configured: false, category: 'intelligence', status: 'coming-soon' },
  { name: 'Mozilla Observatory', id: 'observatory', description: 'Security header checks, CSP analysis, and TLS version auditing — a site with a D- in security is a strategic liability', secretKey: '', configured: false, category: 'security', status: 'coming-soon' },
  { name: 'URLScan.io', id: 'urlscan', description: 'Sandbox every outbound request a site makes to expose 3rd-party tracker bloat and data leakage to questionable domains', secretKey: '', configured: false, category: 'security', status: 'coming-soon' },
  { name: 'Hunter.io', id: 'hunter', description: 'Find the people behind a site — technical leads, marketing managers — and build a persona of the team you\'re competing against', secretKey: '', configured: false, category: 'intelligence', status: 'coming-soon' },
  { name: 'Clay', id: 'clay', description: 'Waterfall enrichment across 150+ data providers with native AI that categorizes companies into specific niches, not just generic industries', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
  { name: 'Apollo.io', id: 'apollo', description: '275M+ contacts with firmographics and technographics — query "every company using Shopify but NOT Klaviyo" to find perfect prospects', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
  { name: 'Ocean.io', id: 'ocean', description: 'AI-powered lookalike search — provide ideal client websites and find semantically similar companies instead of relying on NAICS codes', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
  { name: 'Crunchbase', id: 'crunchbase', description: 'Funding rounds, acquisitions, and leadership changes — companies that just raised a Series B are 10x more likely to need a site overhaul', secretKey: '', configured: false, category: 'enrichment', status: 'coming-soon' },
];

const categoryLabels: Record<string, string> = {
  technology: '🔧 Technology Detection',
  performance: '⚡ Performance & Sustainability',
  seo: '🔍 SEO & Search',
  content: '📄 Content & Scraping',
  ux: '🎨 UX & Accessibility',
  security: '🛡️ Security & Compliance',
  intelligence: '📊 Competitive Intelligence',
  enrichment: '🧲 Enrichment & Prospecting',
};

const categoryOrder = ['technology', 'performance', 'seo', 'content', 'ux', 'security', 'intelligence', 'enrichment'];

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [pausedSet, setPausedSet] = useState(() => getPausedIntegrations());

  const handleToggle = (id: string) => {
    toggleIntegrationPause(id);
    setPausedSet(getPausedIntegrations());
  };

  const grouped = categoryOrder.map(cat => ({
    category: cat,
    label: categoryLabels[cat],
    items: integrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  const activeCount = integrations.filter(i => i.status === 'active' && !pausedSet.has(i.id)).length;
  const pausedCount = integrations.filter(i => i.status === 'active' && pausedSet.has(i.id)).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Integrations</h1>
            <p className="text-xs text-muted-foreground">
              {activeCount} active{pausedCount > 0 && <> · {pausedCount} paused</>}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {grouped.map(({ category, label, items }) => (
          <div key={category}>
            <h2 className="text-sm font-semibold mb-3">{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((integration) => {
                const isPaused = pausedSet.has(integration.id);
                return (
                  <Card key={integration.id} className={`p-4 flex items-start justify-between gap-3 ${isPaused ? 'opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium text-sm ${integration.status === 'coming-soon' ? 'text-muted-foreground' : ''}`}>{integration.name}</p>
                        {integration.status === 'coming-soon' ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">
                            <Clock className="h-3 w-3 mr-0.5" /> Coming soon
                          </Badge>
                        ) : isPaused ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30">
                            <Pause className="h-3 w-3 mr-0.5" /> Paused
                          </Badge>
                        ) : integration.configured ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            <Check className="h-3 w-3 mr-0.5" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <X className="h-3 w-3 mr-0.5" /> Not configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{integration.description}</p>
                    </div>
                    {integration.status === 'active' && (
                      <Switch
                        checked={!isPaused}
                        onCheckedChange={() => handleToggle(integration.id)}
                        className="shrink-0 mt-1"
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
