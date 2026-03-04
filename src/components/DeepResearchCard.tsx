import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Brain, Loader2, Upload, X, FileText, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/SectionCard';
import { deepResearchApi } from '@/lib/api/firecrawl';
import { isIntegrationPaused } from '@/lib/integrationState';

type AttachedDoc = { name: string; content: string };

type Props = {
  session: {
    id: string;
    domain: string;
    base_url: string;
    builtwith_data?: any;
    semrush_data?: any;
    psi_data?: any;
    wappalyzer_data?: any;
    ocean_data?: any;
    carbon_data?: any;
    wave_data?: any;
    observatory_data?: any;
    readable_data?: any;
  };
  collapsed?: boolean;
};

function buildCrawlContext(session: Props['session']): string {
  const parts: string[] = [];
  parts.push(`Domain: ${session.domain}`);
  parts.push(`URL: ${session.base_url}`);

  if (session.ocean_data) {
    const o = session.ocean_data;
    parts.push(`\nCompany: ${o.companyName || session.domain}`);
    if (o.industries?.length) parts.push(`Industries: ${o.industries.join(', ')}`);
    if (o.companySize) parts.push(`Size: ${o.companySize}`);
    if (o.revenue) parts.push(`Revenue: ${o.revenue}`);
    if (o.description) parts.push(`Description: ${o.description}`);
  }

  if (session.semrush_data?.overview?.length) {
    const ov = session.semrush_data.overview[0];
    parts.push(`\nSEMrush Overview:\n- Organic traffic: ${ov.Or || 'N/A'}\n- Keywords: ${ov.Ot || 'N/A'}\n- Domain rank: ${ov.Rk || 'N/A'}`);
  }

  if (session.psi_data) {
    const mob = session.psi_data.mobile;
    const desk = session.psi_data.desktop;
    if (mob?.scores) parts.push(`\nPageSpeed Mobile: Performance ${mob.scores.performance}, SEO ${mob.scores.seo}, Accessibility ${mob.scores.accessibility}`);
    if (desk?.scores) parts.push(`PageSpeed Desktop: Performance ${desk.scores.performance}, SEO ${desk.scores.seo}`);
  }

  if (session.builtwith_data?.grouped) {
    const techs = Object.entries(session.builtwith_data.grouped)
      .map(([cat, items]: [string, any]) => `${cat}: ${items.map((t: any) => t.name).join(', ')}`)
      .join('\n');
    parts.push(`\nTechnology Stack:\n${techs}`);
  }

  if (session.wappalyzer_data?.grouped) {
    const techs = Object.entries(session.wappalyzer_data.grouped)
      .map(([cat, items]: [string, any]) => `${cat}: ${items.map((t: any) => t.name).join(', ')}`)
      .join('\n');
    parts.push(`\nWappalyzer:\n${techs}`);
  }

  if (session.wave_data?.summary) {
    const s = session.wave_data.summary;
    parts.push(`\nWAVE Accessibility: ${s.errors} errors, ${s.alerts} alerts, ${s.contrast} contrast issues`);
  }

  if (session.observatory_data) {
    parts.push(`\nMozilla Observatory: Grade ${session.observatory_data.grade}, Score ${session.observatory_data.score}/100`);
  }

  if (session.carbon_data) {
    parts.push(`\nWebsite Carbon: ${session.carbon_data.rating || 'N/A'}, Cleaner than ${Math.round((session.carbon_data.cleanerThan || 0) * 100)}% of sites`);
  }

  if (session.readable_data) {
    const r = session.readable_data;
    parts.push(`\nReadability: Score ${r.readabilityScore || 'N/A'}, Grade Level ${r.gradeLevel || 'N/A'}`);
  }

  return parts.join('\n');
}

export function DeepResearchCard({ session, collapsed }: Props) {
  const paused = isIntegrationPaused('deep-research');
  const [prompt, setPrompt] = useState('');
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-generate a default prompt
  useEffect(() => {
    if (!prompt) {
      setPrompt(
        `Conduct a comprehensive competitive analysis and website audit for ${session.domain}. Include:\n\n1. Executive Summary\n2. Competitive Landscape (identify 3-5 key competitors)\n3. Strengths & Weaknesses analysis\n4. Technology stack comparison with competitors\n5. SEO & Content Strategy assessment\n6. UX/Design recommendations\n7. Actionable improvement roadmap`
      );
    }
  }, [session.domain]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      try {
        const text = await file.text();
        setDocuments(prev => [...prev, { name: file.name, content: text }]);
        toast.success(`Attached: ${file.name}`);
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDoc = (idx: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== idx));
  };

  const startResearch = async () => {
    if (!prompt.trim()) { toast.error('Enter a research prompt'); return; }
    setStarting(true);
    setReport(null);
    setState(null);

    try {
      const crawlContext = buildCrawlContext(session);
      const result = await deepResearchApi.start(prompt, crawlContext, documents);
      if (!result.success || !result.interactionId) {
        toast.error(result.error || 'Failed to start research');
        setStarting(false);
        return;
      }
      setInteractionId(result.interactionId);
      setState('in_progress');
      toast.success('Deep Research started — this may take several minutes');
      startPolling(result.interactionId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start research');
    }
    setStarting(false);
  };

  const startPolling = useCallback((id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPolling(true);

    const poll = async () => {
      try {
        const result = await deepResearchApi.poll(id);
        if (!result.success) {
          console.error('Poll error:', result.error);
          return;
        }
        setState(result.state || 'unknown');

        if (result.state === 'completed' || result.state === 'COMPLETED') {
          setReport(result.report || 'Research completed but no report was generated.');
          setPolling(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          toast.success('Deep Research report ready!');
        } else if (result.state === 'failed' || result.state === 'FAILED') {
          setPolling(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          toast.error('Research task failed');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    };

    // Poll immediately, then every 15s
    poll();
    pollTimerRef.current = setInterval(poll, 15000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const reset = () => {
    setInteractionId(null);
    setState(null);
    setReport(null);
    setPolling(false);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  };

  return (
    <SectionCard
      title="Gemini Deep Research"
      icon={<Brain className="h-5 w-5 text-foreground" />}
      paused={paused}
      collapsed={collapsed}
      loading={false}
      headerExtra={
        report ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="New research">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        ) : undefined
      }
    >
      {paused ? null : report ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
            <ReactMarkdown>{report}</ReactMarkdown>
          </Suspense>
        </div>
      ) : polling || state === 'in_progress' ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Deep Research is working — this typically takes 5-15 minutes...</p>
          <p className="text-xs text-muted-foreground">Polling every 15 seconds. You can leave this page and come back.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Research Prompt</label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={6}
              placeholder="What should Deep Research investigate?"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              All crawl data (tech stack, SEO, performance, accessibility, etc.) is automatically included as context.
            </p>
          </div>

          {/* Document attachments */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Attach Documents (optional)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {documents.map((doc, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                  <FileText className="h-3 w-3" />
                  {doc.name}
                  <button onClick={() => removeDoc(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Attach Files
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Text files are read and included as context. PDFs/DOCX will be sent as text content.
            </p>
          </div>

          <Button onClick={startResearch} disabled={starting || !prompt.trim()}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
            Start Deep Research
          </Button>
          <p className="text-xs text-muted-foreground">
            Estimated cost: ~$2-5 per research task. Takes 5-20 minutes.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
