import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Globe, Loader2, ArrowRight, BarChart3, Brain, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import AppHeader from '@/components/AppHeader';

export default function CrawlPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsStarting(true);
    try {
      const formattedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      const domain = new URL(formattedUrl).hostname;

      const { data: session, error } = await supabase
        .from('crawl_sessions')
        .insert({ domain, base_url: formattedUrl, status: 'analyzing' } as any)
        .select()
        .single();

      if (error) throw error;

      const { count } = await supabase
        .from('crawl_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('domain', domain);
      const needsTimestamp = (count ?? 0) > 1;
      navigate(buildSitePath(domain, session.created_at, needsTimestamp));
    } catch (error) {
      console.error(error);
      toast.error('Failed to start analysis');
      setIsStarting(false);
    }
  };

  const features = [
    { icon: BarChart3, title: '30+ Integrations', desc: 'SEO, performance, security, and tech stack analysis in one sweep.' },
    { icon: Brain, title: 'AI Knowledge Base', desc: 'Chat with your findings using RAG-powered research across all crawl data.' },
    { icon: Shield, title: 'Prospect Intel', desc: 'Pull contacts, company data, and CRM history before your next call.' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Sales prep, automated
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Know everything
            <br />
            <span className="text-primary">before the call</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Paste any URL — Agency Atlas runs 30+ analyses, builds a knowledge base, and gives you an AI research partner for your sales prep.
          </p>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
            <div className="flex gap-2 p-2 rounded-2xl border border-border bg-card shadow-lg shadow-primary/5">
              <div className="relative flex-1">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  className="pl-10 h-12 text-base border-0 bg-transparent shadow-none focus-visible:ring-0"
                  disabled={isStarting}
                />
              </div>
              <Button type="submit" size="lg" disabled={isStarting || !url.trim()} className="rounded-xl px-6 gap-2">
                {isStarting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</>
                ) : (
                  <>Analyze<ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </form>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-3 gap-4 pt-8">
            {features.map(f => (
              <div key={f.title} className="text-left rounded-xl border border-border bg-card/50 p-5 space-y-2">
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
