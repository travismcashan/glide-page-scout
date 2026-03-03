import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X, Wrench } from 'lucide-react';

type Integration = {
  name: string;
  description: string;
  secretKey: string;
  configured: boolean;
  category: 'technology' | 'performance' | 'seo' | 'content';
};

const integrations: Integration[] = [
  { name: 'Firecrawl', description: 'Web scraping, content extraction, and sitemap discovery', secretKey: 'FIRECRAWL_API_KEY', configured: true, category: 'content' },
  { name: 'BuiltWith', description: 'Technology stack detection with historical data', secretKey: 'BUILTWITH_API_KEY', configured: true, category: 'technology' },
  { name: 'Wappalyzer', description: 'Real-time technology profiling with version detection', secretKey: 'WAPPALYZER_API_KEY', configured: true, category: 'technology' },
  { name: 'GTmetrix', description: 'Lighthouse performance audits and Web Vitals', secretKey: 'GTMETRIX_API_KEY', configured: true, category: 'performance' },
  { name: 'Google PageSpeed Insights', description: 'Mobile & desktop Lighthouse scores and Core Web Vitals', secretKey: 'GOOGLE_PSI_API_KEY', configured: true, category: 'performance' },
  { name: 'SEMrush', description: 'Domain overview, organic keywords, and backlinks', secretKey: 'SEMRUSH_API_KEY', configured: true, category: 'seo' },
  { name: 'Thum.io', description: 'Full-page website screenshots', secretKey: 'THUMIO_SECRET_KEY', configured: true, category: 'content' },
];

const categoryLabels: Record<string, string> = {
  technology: '🔧 Technology Detection',
  performance: '⚡ Performance',
  seo: '🔍 SEO & Search',
  content: '📄 Content & Scraping',
};

const categoryOrder = ['technology', 'performance', 'seo', 'content'];

export default function IntegrationsPage() {
  const navigate = useNavigate();

  const grouped = categoryOrder.map(cat => ({
    category: cat,
    label: categoryLabels[cat],
    items: integrations.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Integrations</h1>
            <p className="text-xs text-muted-foreground">{integrations.filter(i => i.configured).length} of {integrations.length} configured</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {grouped.map(({ category, label, items }) => (
          <div key={category}>
            <h2 className="text-sm font-semibold mb-3">{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((integration) => (
                <Card key={integration.name} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{integration.name}</p>
                      {integration.configured ? (
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
                  <Wrench className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
