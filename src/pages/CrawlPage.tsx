import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Globe, Loader2, Search, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
        .insert({ domain, base_url: formattedUrl, status: 'analyzing' })
        .select()
        .single();

      if (error) throw error;

      navigate(`/results/${session.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to start analysis');
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">Glide Sales Prep</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/integrations')}>
              Integrations
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              History
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Prep for your next sales call
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Paste a prospect's URL — we'll run a full site analysis and discover all their pages.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com"
                className="pl-10 h-12 text-base"
                disabled={isStarting}
              />
            </div>
            <Button type="submit" size="lg" disabled={isStarting || !url.trim()}>
              {isStarting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Analyze Site</>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
