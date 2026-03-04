import { useState, useRef, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Lightbulb, Loader2, Upload, X, FileText, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type AttachedDoc = { name: string; content: string };

type SessionData = {
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
  crux_data?: any;
  ssllabs_data?: any;
  httpstatus_data?: any;
  linkcheck_data?: any;
  w3c_data?: any;
  schema_data?: any;
  yellowlab_data?: any;
  gtmetrix_grade?: string | null;
  gtmetrix_scores?: any;
};

type Props = {
  session: SessionData;
  pages?: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null }[];
};

function buildCrawlContext(session: SessionData, pages?: Props['pages']): string {
  const sections: string[] = [];
  sections.push(`# Website Audit Data: ${session.domain}\nURL: ${session.base_url}\n`);

  const add = (label: string, data: any) => {
    if (!data) return;
    try {
      sections.push(`## ${label}\n\`\`\`json\n${JSON.stringify(data, null, 1)}\n\`\`\``);
    } catch { /* skip */ }
  };

  add('Ocean.io Firmographics', session.ocean_data);
  add('SEMrush Domain Analysis', session.semrush_data);
  add('PageSpeed Insights (Lighthouse)', session.psi_data);
  add('BuiltWith Technology Stack', session.builtwith_data);
  add('Wappalyzer Technology Profiling', session.wappalyzer_data);
  add('Chrome UX Report (CrUX)', session.crux_data);
  add('WAVE Accessibility', session.wave_data);
  add('Mozilla Observatory Security', session.observatory_data);
  add('SSL Labs TLS Assessment', session.ssllabs_data);
  add('HTTP Status & Redirects', session.httpstatus_data);
  add('Broken Link Check', session.linkcheck_data);
  add('W3C HTML/CSS Validation', session.w3c_data);
  add('Schema.org Structured Data', session.schema_data);
  add('Readable.com Readability', session.readable_data);
  add('Website Carbon Sustainability', session.carbon_data);
  add('Yellow Lab Tools Front-End Quality', session.yellowlab_data);

  if (session.gtmetrix_grade || session.gtmetrix_scores) {
    add('GTmetrix Performance', { grade: session.gtmetrix_grade, scores: session.gtmetrix_scores });
  }

  if (pages?.length) {
    const pageSection: string[] = ['## Scraped Page Content\n'];
    for (const p of pages) {
      pageSection.push(`### ${p.title || p.url}\nURL: ${p.url}`);
      if (p.ai_outline) {
        pageSection.push(p.ai_outline);
      } else if (p.raw_content) {
        pageSection.push(p.raw_content.substring(0, 3000));
      }
      pageSection.push('');
    }
    sections.push(pageSection.join('\n'));
  }

  return sections.join('\n\n');
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/observations-insights`;

export function ObservationsInsightsCard({ session, pages }: Props) {
  const defaultPrompt = `Review Company (${session.domain}) as it relates to all the documents, transcripts, URLs, site scrape data, and research provided, and give me:\n\n30 observations\n20 insights\n10 recommendations\n5 strategies\n3 keys to success\n1 north star`;

  const [prompt, setPrompt] = useState(defaultPrompt);
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [submittedDocs, setSubmittedDocs] = useState<AttachedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} too large`); continue; }
      try {
        const text = await file.text();
        setDocuments(prev => [...prev, { name: file.name, content: text }]);
      } catch { toast.error(`Failed to read ${file.name}`); }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDoc = (idx: number) => setDocuments(prev => prev.filter((_, i) => i !== idx));

  const runAnalysis = async () => {
    if (!prompt.trim()) { toast.error('Enter a prompt'); return; }
    setLoading(true);
    setResult(null);
    setSubmittedPrompt(prompt.trim());
    setSubmittedDocs([...documents]);

    try {
      const crawlContext = buildCrawlContext(session, pages);

      const response = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          domain: session.domain,
          crawlContext,
          documents,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || `Failed (${response.status})`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success && data.result) {
        setResult(data.result);
        toast.success('Analysis complete!');
      } else {
        toast.error(data.error || 'No result returned');
      }
    } catch (e: any) {
      console.error('Observations & Insights error:', e);
      toast.error(e?.message || 'Failed to run analysis');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSubmittedPrompt(null);
    setSubmittedDocs([]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Submitted prompt */}
      {submittedPrompt && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            Analysis Prompt
          </div>
          <p className="text-sm whitespace-pre-wrap">{submittedPrompt}</p>
          {submittedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {submittedDocs.map((doc, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[11px]">
                  <FileText className="h-3 w-3" />
                  {doc.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {result && !loading ? (
        /* Final result */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Strategic Pyramid</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="New analysis">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </Suspense>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Generating strategic analysis… this may take a minute.</span>
        </div>
      ) : (
        /* Input Form */
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Analysis Prompt</label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={6}
              placeholder="What should the analysis focus on?"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              All crawl data is automatically included as context.
            </p>
          </div>

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
          </div>

          <Button onClick={runAnalysis} disabled={loading || !prompt.trim()}>
            <Play className="h-4 w-4 mr-1.5" />
            Generate Analysis
          </Button>
        </div>
      )}
    </div>
  );
}
