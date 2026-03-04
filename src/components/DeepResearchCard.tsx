import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Brain, Loader2, Upload, X, FileText, Play, RefreshCw, Globe, Search, BookOpen, PenTool, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/SectionCard';
import { isIntegrationPaused } from '@/lib/integrationState';
import { ScrollArea } from '@/components/ui/scroll-area';

type AttachedDoc = { name: string; content: string };

type ThinkingStep = {
  id: string;
  text: string;
  timestamp: number;
  type: 'thinking' | 'searching' | 'reading' | 'writing' | 'source';
};

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
  collapsed?: boolean;
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

function classifyStep(text: string): ThinkingStep['type'] {
  const lower = text.toLowerCase();
  if (lower.includes('searching') || lower.includes('search for') || lower.includes('querying')) return 'searching';
  if (lower.includes('reading') || lower.includes('browsing') || lower.includes('visiting') || lower.includes('looking at')) return 'reading';
  if (lower.includes('writing') || lower.includes('drafting') || lower.includes('composing') || lower.includes('finalizing')) return 'writing';
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'source';
  return 'thinking';
}

function StepIcon({ type }: { type: ThinkingStep['type'] }) {
  switch (type) {
    case 'searching': return <Search className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case 'reading': return <BookOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    case 'writing': return <PenTool className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'source': return <Globe className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    default: return <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-research`;

export function DeepResearchCard({ session, pages, collapsed }: Props) {
  const paused = isIntegrationPaused('deep-research');
  const [prompt, setPrompt] = useState('');
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prompt) {
      setPrompt(
        `Conduct a comprehensive competitive analysis and website audit for ${session.domain}. Include:\n\n1. Executive Summary\n2. Competitive Landscape (identify 3-5 key competitors)\n3. Strengths & Weaknesses analysis\n4. Technology stack comparison with competitors\n5. SEO & Content Strategy assessment\n6. UX/Design recommendations\n7. Actionable improvement roadmap`
      );
    }
  }, [session.domain]);

  // Auto-scroll steps
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

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

  const processSSEStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, '');
        buffer = buffer.slice(newlineIdx + 1);

        // SSE event type line
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
          continue;
        }

        // SSE data line
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            // Track event_id for resume
            if (parsed.event_id) {
              lastEventIdRef.current = parsed.event_id;
            }

            // interaction.start → capture interaction ID
            if (currentEventType === 'interaction.start' || parsed.name) {
              const id = parsed.name || parsed.id;
              if (id) {
                setInteractionId(id);
                console.log('Deep Research interaction ID:', id);
              }
            }

            // Thinking / progress updates
            if (currentEventType === 'interaction.thinking' || parsed.thinking_summary) {
              const text = parsed.thinking_summary || parsed.text || parsed.thought || '';
              if (text) {
                const step: ThinkingStep = {
                  id: `step-${Date.now()}-${Math.random()}`,
                  text,
                  timestamp: Date.now(),
                  type: classifyStep(text),
                };
                setSteps(prev => [...prev, step]);

                // Extract URLs as sources
                const urlMatches = text.match(/https?:\/\/[^\s)>\]"']+/g);
                if (urlMatches) {
                  setSources(prev => {
                    const next = new Set(prev);
                    urlMatches.forEach((u: string) => next.add(u));
                    return Array.from(next);
                  });
                }
              }
            }

            // Content updates (the agent is writing the report)
            if (currentEventType === 'interaction.content' || currentEventType === 'interaction.output') {
              const parts = parsed.output?.parts || parsed.parts || parsed.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  setReport(prev => (prev || '') + part.text);
                }
              }
              // Also check for delta/content style
              if (parsed.text) {
                setReport(prev => (prev || '') + parsed.text);
              }
            }

            // Completion
            if (currentEventType === 'interaction.complete' || parsed.state === 'completed' || parsed.state === 'COMPLETED') {
              // If no report was built up yet, extract from the final payload
              const finalParts = parsed.output?.parts || parsed.candidates?.[0]?.content?.parts || [];
              if (finalParts.length > 0) {
                const finalText = finalParts.map((p: any) => p.text || '').join('\n');
                if (finalText) setReport(finalText);
              }
              setStreaming(false);
              toast.success('Deep Research report ready!');
            }

            if (parsed.state === 'failed' || parsed.state === 'FAILED') {
              setStreaming(false);
              toast.error('Research task failed');
            }
          } catch {
            // Partial JSON — wait for more data
          }
          currentEventType = '';
          continue;
        }

        // Empty line resets event type
        if (line === '') {
          currentEventType = '';
        }
      }
    }

    // If stream ended without explicit completion, mark done
    setStreaming(false);
  }, []);

  const startResearch = async () => {
    if (!prompt.trim()) { toast.error('Enter a research prompt'); return; }
    setStarting(true);
    setReport(null);
    setSteps([]);
    setSources([]);
    setInteractionId(null);
    lastEventIdRef.current = null;

    try {
      const crawlContext = buildCrawlContext(session, pages);
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'start',
          prompt,
          crawlContext,
          documents,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || `Failed to start (${response.status})`);
        setStarting(false);
        return;
      }

      setStarting(false);
      setStreaming(true);

      // Check if we got SSE or JSON back
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await processSSEStream(response);
      } else {
        // Fallback to JSON response (shouldn't happen with new edge fn)
        const data = await response.json();
        if (data.interactionId) {
          setInteractionId(data.interactionId);
        }
        setStreaming(false);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      toast.error(e?.message || 'Failed to start research');
      setStarting(false);
      setStreaming(false);
    }
  };

  const resumeStream = useCallback(async () => {
    if (!interactionId) return;
    setStreaming(true);

    try {
      const response = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'resume',
          interactionId,
          lastEventId: lastEventIdRef.current,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to resume');
        setStreaming(false);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await processSSEStream(response);
      }
    } catch (e: any) {
      console.error('Resume failed:', e);
      setStreaming(false);
    }
  }, [interactionId, processSSEStream]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const reset = () => {
    abortRef.current?.abort();
    setInteractionId(null);
    setSteps([]);
    setReport(null);
    setStreaming(false);
    setSources([]);
    lastEventIdRef.current = null;
  };

  const isWorking = starting || streaming;

  return (
    <SectionCard
      title="Gemini Deep Research"
      icon={<Brain className="h-5 w-5 text-foreground" />}
      paused={paused}
      collapsed={collapsed}
      loading={false}
      headerExtra={
        (report || steps.length > 0) ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="New research">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        ) : undefined
      }
    >
      {paused ? null : report && !streaming ? (
        /* ── Final Report ── */
        <div className="space-y-4">
          {sources.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Sources ({sources.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {sources.slice(0, 30).map((url, i) => {
                  let label = url;
                  try { label = new URL(url).hostname; } catch {}
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]">
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
              <ReactMarkdown>{report}</ReactMarkdown>
            </Suspense>
          </div>
        </div>
      ) : isWorking || steps.length > 0 ? (
        /* ── Live Progress ── */
        <div className="space-y-4">
          {/* Thinking steps log */}
          {steps.length > 0 && (
            <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-2">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <StepIcon type={step.type} />
                    <span className="text-muted-foreground leading-snug">{step.text}</span>
                  </div>
                ))}
                {streaming && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Researching…</span>
                  </div>
                )}
                <div ref={stepsEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* Sources found so far */}
          {sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Sources found ({sources.length})</p>
              <div className="flex flex-wrap gap-1">
                {sources.slice(0, 20).map((url, i) => {
                  let label = url;
                  try { label = new URL(url).hostname; } catch {}
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground truncate max-w-[180px]">
                      <Globe className="h-2.5 w-2.5 shrink-0" />
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Report building up in real-time */}
          {report && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Report (writing…)</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Suspense fallback={null}>
                  <ReactMarkdown>{report}</ReactMarkdown>
                </Suspense>
              </div>
            </div>
          )}

          {!streaming && steps.length > 0 && !report && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Stream disconnected.</p>
              {interactionId && (
                <Button variant="outline" size="sm" onClick={resumeStream}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Reconnect
                </Button>
              )}
            </div>
          )}

          {starting && steps.length === 0 && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Starting Deep Research…</span>
            </div>
          )}
        </div>
      ) : (
        /* ── Input Form ── */
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
              Text files are read and included as context.
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
