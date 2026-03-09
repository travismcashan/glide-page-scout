import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Lightbulb, Loader2, Upload, X, FileText, Play, RefreshCw, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { downloadReportPdf } from '@/lib/downloadReportPdf';
import { loadDefaultDocs } from '@/lib/defaultResearchDocs';
import { ContextPreview } from '@/components/ContextPreview';

type AttachedDoc = { name: string; content: string };

type SessionData = {
  id: string;
  domain: string;
  base_url: string;
  avoma_data?: any;
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
  observations_data?: any;
};

type Props = {
  session: SessionData;
  pages?: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null; screenshot_url?: string | null }[];
};

// buildCrawlContext is now imported from @/lib/buildCrawlContext

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/observations-insights`;

export function ObservationsInsightsCard({ session, pages }: Props) {
  const [screenshots, setScreenshots] = useState<{ url: string; screenshot_url: string; title?: string }[]>([]);

  // Fetch completed screenshots from crawl_screenshots table
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('crawl_screenshots')
        .select('url, screenshot_url, status')
        .eq('session_id', session.id)
        .eq('status', 'done');
      if (data) {
        setScreenshots(
          data
            .filter(s => s.screenshot_url)
            .map(s => {
              const page = (pages || []).find(p => p.url === s.url);
              return { url: s.url, screenshot_url: s.screenshot_url!, title: page?.title || s.url };
            })
        );
      }
    })();
  }, [session.id, pages]);
  const companyName = session.ocean_data?.companyName || session.domain;
  const defaultPrompt = `Review ${companyName}, located at ${session.domain}, as it relates to all the documents, transcripts, URLs, site scrape data, and research provided, and give me:\r\n\r\n30 observations as bullet points grouped under: Technology & Infrastructure, User Experience & Design, Content & SEO, Performance & Analytics, Organizational Context, and Competitive Landscape & Market Position\r\n\r\n20 insights as bullet points grouped under: Strategic Opportunities, Risk Areas, and Patterns & Correlations\r\n\r\n10 recommendations, each with Action, Why, and Impact (diagnose before prescribe)\r\n\r\n5 strategies\r\n3 keys to success\r\n1 north star`;

  const [prompt, setPrompt] = useState(defaultPrompt);
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [submittedDocs, setSubmittedDocs] = useState<AttachedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted results from database on mount
  useEffect(() => {
    if (session.observations_data) {
      const data = session.observations_data;
      if (data.result) setResult(data.result);
      if (data.prompt) setSubmittedPrompt(data.prompt);
      if (data.documents) setSubmittedDocs(data.documents.map((d: any) => ({ name: d.name, content: '' })));
    }
  }, [session.id]);

  // Pre-load default framework documents
  useEffect(() => {
    let cancelled = false;
    loadDefaultDocs().then(docs => {
      if (!cancelled && docs.length > 0) {
        setDocuments(prev => {
          const existingNames = new Set(prev.map(d => d.name));
          const newDocs = docs.filter(d => !existingNames.has(d.name));
          return [...prev, ...newDocs];
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Save results to database
  const saveToDatabase = useCallback(async (finalResult: string, finalPrompt: string | null, finalDocs: AttachedDoc[]) => {
    try {
      const payload = {
        result: finalResult,
        prompt: finalPrompt,
        documents: finalDocs.map(d => ({ name: d.name })),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from('crawl_sessions')
        .update({ observations_data: payload as any })
        .eq('id', session.id);
      console.log('Observations & Insights results saved to database');
    } catch (e) {
      console.error('Failed to save Observations & Insights results:', e);
    }
  }, [session.id]);

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

      // Collect screenshot URLs from crawl_screenshots (cap at 10)
      const screenshotUrls = screenshots
        .slice(0, 10)
        .map(s => ({ url: s.screenshot_url, title: s.title || s.url }));

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
          screenshotUrls,
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
        // Save to database
        await saveToDatabase(data.result, prompt.trim(), documents);
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => result && downloadReportPdf(result, 'Observations & Insights', session.domain)} title="Download PDF">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="New analysis">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
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

          {/* AI Context Preview */}
          <Accordion type="single" collapsible className="border rounded-lg">
            <AccordionItem value="context-preview" className="border-0">
              <AccordionTrigger className="px-3 py-2 text-xs font-medium text-muted-foreground hover:no-underline">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Preview AI Context
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <ContextPreview session={session} pages={pages} documents={documents} screenshotCount={screenshots.length} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button onClick={runAnalysis} disabled={loading || !prompt.trim()}>
            <Play className="h-4 w-4 mr-1.5" />
            Generate Analysis
          </Button>
        </div>
      )}
    </div>
  );
}
