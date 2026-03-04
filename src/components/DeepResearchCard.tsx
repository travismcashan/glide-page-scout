import { useState, useRef, useCallback, useEffect, lazy, Suspense, useMemo } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Brain, Loader2, Upload, X, FileText, Play, RefreshCw, Globe, Search, BookOpen, PenTool, ExternalLink, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { loadDefaultDocs } from '@/lib/defaultResearchDocs';
import { supabase } from '@/integrations/supabase/client';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { downloadReportPdf } from '@/lib/downloadReportPdf';

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
  deep_research_data?: any;
};

type Props = {
  session: SessionData;
  pages?: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null }[];
  collapsed?: boolean;
};

// buildCrawlContext is now imported from @/lib/buildCrawlContext

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

/** Shows what buildCrawlContext will send, broken into labeled sections */
function ContextPreview({ session, pages, documents }: { session: SessionData; pages?: Props['pages']; documents: AttachedDoc[] }) {
  const context = useMemo(() => buildCrawlContext(session, pages), [session, pages]);
  const totalChars = context.length;
  const estTokens = Math.round(totalChars / 4);
  const docChars = documents.reduce((sum, d) => sum + d.content.length, 0);

  const sections = useMemo(() => {
    const parts: { label: string; content: string; chars: number }[] = [];
    const raw = context.split(/^## /m);
    for (const part of raw) {
      if (!part.trim()) continue;
      const newline = part.indexOf('\n');
      const label = newline > 0 ? part.slice(0, newline).replace(/^\[Source: (.+)\]$/, '$1').trim() : part.trim();
      const content = newline > 0 ? part.slice(newline + 1).trim() : '';
      parts.push({ label, content, chars: content.length });
    }
    return parts;
  }, [context]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Crawl context: <strong className="text-foreground">{totalChars.toLocaleString()}</strong> chars (~{estTokens.toLocaleString()} tokens)</span>
        {docChars > 0 && <span>Attached docs: <strong className="text-foreground">{docChars.toLocaleString()}</strong> chars (~{Math.round(docChars / 4).toLocaleString()} tokens)</span>}
        <span>Combined: ~<strong className="text-foreground">{Math.round((totalChars + docChars) / 4).toLocaleString()}</strong> / 100K tokens</span>
      </div>

      <div className="text-xs space-y-0.5">
        <p className="font-medium text-muted-foreground mb-1">What's included:</p>
        <ul className="space-y-0.5">
          {sections.map((s, i) => {
            const isPassthrough = s.label.includes('Avoma') || s.label.includes('Scraped Page');
            return (
              <li key={i} className="flex items-start gap-1.5">
                <span className={`shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full ${s.chars > 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-foreground/80">
                  <strong>{s.label}</strong>
                  <span className="text-muted-foreground ml-1">
                    ({s.chars.toLocaleString()} chars)
                    {isPassthrough && ' — passed in full'}
                    {!isPassthrough && s.chars > 0 && ' — key metrics extracted'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="raw" className="border-0">
          <AccordionTrigger className="py-1 text-[11px] text-muted-foreground hover:no-underline">
            Show raw context
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[300px] rounded border border-border bg-muted/30 p-2">
              <pre className="text-[11px] whitespace-pre-wrap font-mono text-foreground/70">{context}</pre>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function DeepResearchCard({ session, pages, collapsed }: Props) {
  const [prompt, setPrompt] = useState('');
  const [documents, setDocuments] = useState<AttachedDoc[]>([]);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [submittedDocs, setSubmittedDocs] = useState<AttachedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const reportRef = useRef<string | null>(null);

  // Keep reportRef in sync
  useEffect(() => { reportRef.current = report; }, [report]);

  const companyName = session.ocean_data?.companyName || session.domain;

  // Load persisted results from database on mount
  useEffect(() => {
    if (session.deep_research_data) {
      const data = session.deep_research_data;
      if (data.report) setReport(data.report);
      if (data.sources) setSources(data.sources);
      if (data.prompt) setSubmittedPrompt(data.prompt);
      if (data.documents) setSubmittedDocs(data.documents.map((d: any) => ({ name: d.name, content: '' })));
    }
  }, [session.id]);

  // Save results to database when report is finalized
  const saveToDatabase = useCallback(async (finalReport: string, finalSources: string[], finalPrompt: string | null, finalDocs: AttachedDoc[]) => {
    try {
      const payload = {
        report: finalReport,
        sources: finalSources,
        prompt: finalPrompt,
        documents: finalDocs.map(d => ({ name: d.name })),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from('crawl_sessions')
        .update({ deep_research_data: payload as any })
        .eq('id', session.id);
      console.log('Deep Research results saved to database');
    } catch (e) {
      console.error('Failed to save Deep Research results:', e);
    }
  }, [session.id]);

  useEffect(() => {
    if (!prompt) {
      setPrompt(
        `Complete the 5C diagnostic for ${companyName}, located at ${session.domain}. This is all in the context of a marketing engagement between ${companyName} and GLIDE®. I want to impress them with my thoughtful, consultative, knowledge of their world and their needs. But more importantly, I want to help them become successful.\n\nMake sure that when you write it, you're not derogatory toward their team. As I'm going to share this document with the client, so it should always be constructive, forward-looking, and exciting, but still authoritative and still willing to say the hard things, just not in a way that makes people feel upset.\n\nThe FIVE C's are:\n\n1. **Climate** — The macro environment: industry trends, regulatory landscape, economic forces, technological shifts, and market dynamics affecting ${companyName}.\n\n2. **Competition** — Identify 3-5 key competitors and analyze their positioning, strengths, digital presence, messaging, and where ${companyName} can differentiate.\n\n3. **Customers** — Who are ${companyName}'s ideal customers? What are their pain points, buying journey, content preferences, and how well does the current website serve them?\n\n4. **Company** — ${companyName}'s brand positioning, value proposition, technology stack, content strategy, SEO health, site performance, and digital maturity.\n\n5. **Culture** — The brand voice, tone, visual identity, team positioning, and how well the digital presence reflects the company's mission and values.\n\nConclude with a strategic roadmap that ties all 5 C's together into actionable next steps.`
      );
    }
  }, [session.domain, companyName]);

  // Pre-load default framework documents
  useEffect(() => {
    loadDefaultDocs().then(docs => {
      if (docs.length > 0) {
        setDocuments(prev => {
          if (prev.length > 0) return prev;
          return docs;
        });
      }
    });
  }, []);

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
    let sseEventType = '';
    let reportParts: string[] = [];
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, '');
        buffer = buffer.slice(newlineIdx + 1);

        if (line.startsWith('event: ')) {
          sseEventType = line.slice(7).trim();
          continue;
        }

        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.event_id) {
              lastEventIdRef.current = parsed.event_id;
            }

            if (sseEventType === 'content.delta' || parsed.event_type === 'content.delta') {
              const delta = parsed.delta || parsed;
              const deltaType = delta?.type;
              const content = delta?.content;

              if (deltaType === 'thought_summary' && content?.text) {
                const text = content.text.trim();
                if (text) {
                  const chunks = text.split(/\n\n+/).filter(Boolean);
                  for (const chunk of chunks) {
                    const cleanText = chunk.replace(/^\*\*.*?\*\*\n+/, '').trim() || chunk.trim();
                    if (cleanText) {
                      setSteps(prev => {
                        if (prev.some(s => s.text === cleanText)) return prev;
                        return [...prev, {
                          id: `step-${Date.now()}-${Math.random()}`,
                          text: cleanText,
                          timestamp: Date.now(),
                          type: classifyStep(cleanText),
                        }];
                      });
                    }
                  }
                  const urlMatches = text.match(/https?:\/\/[^\s)>\]"']+/g);
                  if (urlMatches) {
                    setSources(prev => {
                      const next = new Set(prev);
                      urlMatches.forEach((u: string) => next.add(u));
                      return Array.from(next);
                    });
                  }
                }
              } else if (deltaType === 'text' || (content?.type === 'text' && !delta?.type)) {
                const text = content?.text || delta?.text || '';
                if (text) reportParts.push(text);
              }

              const annotations = delta?.annotations || content?.annotations || parsed.annotations;
              if (annotations && Array.isArray(annotations)) {
                for (const ann of annotations) {
                  if (ann.source) {
                    setSources(prev => {
                      const next = new Set(prev);
                      next.add(ann.source);
                      return Array.from(next);
                    });
                  }
                }
              }
            }

            if (sseEventType === 'content.start' || parsed.event_type === 'content.start') {
              if (reportParts.length > 0) {
                const accumulated = reportParts.join('');
                if (accumulated.trim()) setReport(prev => (prev || '') + accumulated);
                reportParts = [];
              }
            }

            if (sseEventType === 'content.stop' || parsed.event_type === 'content.stop') {
              if (reportParts.length > 0) {
                const accumulated = reportParts.join('');
                if (accumulated.trim()) setReport(prev => (prev || '') + accumulated);
                reportParts = [];
              }
            }

            if (sseEventType === 'interaction.start' || parsed.name) {
              const id = parsed.name || parsed.id;
              if (id) setInteractionId(id);
            }
            if (sseEventType === 'interaction.thinking' || parsed.thinking_summary) {
              const text = parsed.thinking_summary || parsed.text || '';
              if (text) {
                setSteps(prev => [...prev, {
                  id: `step-${Date.now()}-${Math.random()}`,
                  text,
                  timestamp: Date.now(),
                  type: classifyStep(text),
                }]);
              }
            }

            if (sseEventType === 'interaction.complete' || parsed.state === 'completed' || parsed.state === 'COMPLETED') {
              const finalParts = parsed.output?.parts || parsed.candidates?.[0]?.content?.parts || [];
              if (finalParts.length > 0) {
                const finalText = finalParts.map((p: any) => p.text || '').join('\n');
                if (finalText) setReport(finalText);
              }
              completed = true;
            }

            if (parsed.state === 'failed' || parsed.state === 'FAILED') {
              setStreaming(false);
              toast.error('Research task failed');
              return;
            }
          } catch {
            // Partial JSON — wait for more data
          }
          sseEventType = '';
          continue;
        }

        if (line === '') sseEventType = '';
      }
    }

    // Flush any remaining report parts
    if (reportParts.length > 0) {
      const accumulated = reportParts.join('');
      if (accumulated.trim()) setReport(prev => (prev || '') + accumulated);
    }

    if (completed) {
      setStreaming(false);
      toast.success('Deep Research report ready!');
    }
  }, []);

  const connectToStream = useCallback(async (iId: string, lastEvt?: string | null) => {
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
          action: 'stream',
          interactionId: iId,
          lastEventId: lastEvt || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Stream connect failed:', errData);
        setStreaming(false);
        return false;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await processSSEStream(response);
        return true;
      }
      setStreaming(false);
      return false;
    } catch (e: any) {
      console.error('Stream error:', e);
      setStreaming(false);
      return false;
    }
  }, [processSSEStream]);

  const pollForResults = useCallback(async (iId: string) => {
    if (reportRef.current) {
      setStreaming(false);
      toast.success('Deep Research report ready!');
      return;
    }
    setStreaming(true);
    let attempts = 0;
    const maxAttempts = 120;
    while (attempts < maxAttempts) {
      if (reportRef.current) {
        setStreaming(false);
        toast.success('Deep Research report ready!');
        return;
      }
      attempts++;
      try {
        const response = await fetch(FUNC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'poll', interactionId: iId }),
        });

        if (!response.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data = await response.json();
        const state = data.status || data.state || '';

        const outputs = data.outputs || [];
        for (const output of outputs) {
          if (output.type === 'thought' && output.summary) {
            for (const item of output.summary) {
              if (item.text) {
                const cleanText = item.text.replace(/^\*\*.*?\*\*\n+/, '').trim();
                if (cleanText) {
                  setSteps(prev => {
                    if (prev.some(s => s.text === cleanText)) return prev;
                    return [...prev, {
                      id: `step-${Date.now()}-${Math.random()}`,
                      text: cleanText,
                      timestamp: Date.now(),
                      type: classifyStep(cleanText),
                    }];
                  });
                }
              }
            }
          }
          if (output.annotations && output.text) {
            setReport(output.text);
            if (Array.isArray(output.annotations)) {
              setSources(prev => {
                const next = new Set(prev);
                for (const ann of output.annotations) {
                  if (ann.source) next.add(ann.source);
                }
                return Array.from(next);
              });
            }
          }
        }

        if (data.output?.parts) {
          for (const part of data.output.parts) {
            if (part.thought && part.text) {
              const cleanText = part.text.replace(/^\*\*.*?\*\*\n+/, '').trim();
              setSteps(prev => {
                if (prev.some(s => s.text === cleanText)) return prev;
                return [...prev, {
                  id: `step-${Date.now()}-${Math.random()}`,
                  text: cleanText,
                  timestamp: Date.now(),
                  type: classifyStep(cleanText),
                }];
              });
            }
          }
        }

        if (state === 'completed' || state === 'COMPLETED') {
          const parts = data.output?.parts || [];
          const reportText = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('\n');
          if (reportText) setReport(prev => prev || reportText);
          setStreaming(false);
          toast.success('Deep Research report ready!');
          return;
        }

        if (state === 'failed' || state === 'FAILED') {
          setStreaming(false);
          toast.error('Research task failed');
          return;
        }

        if (attempts % 6 === 0) {
          setSteps(prev => {
            const lastText = prev[prev.length - 1]?.text;
            if (lastText === 'Still researching…') return prev;
            return [...prev, {
              id: `poll-${Date.now()}`,
              text: 'Still researching…',
              timestamp: Date.now(),
              type: 'thinking' as const,
            }];
          });
        }

        await new Promise(r => setTimeout(r, 5000));
      } catch {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    setStreaming(false);
    toast.error('Research timed out');
  }, []);

  const startResearch = async () => {
    if (!prompt.trim()) { toast.error('Enter a research prompt'); return; }
    setStarting(true);
    setReport(null);
    setSteps([]);
    setSources([]);
    setInteractionId(null);
    setSubmittedPrompt(prompt.trim());
    setSubmittedDocs([...documents]);
    lastEventIdRef.current = null;

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
          action: 'start',
          prompt,
          crawlContext,
          documents,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || `Failed to start (${response.status})`);
        setStarting(false);
        return;
      }

      const data = await response.json();
      const iId = data.interactionId;

      if (!iId) {
        toast.error('No interaction ID returned');
        setStarting(false);
        return;
      }

      console.log('Deep Research started, interaction:', iId);
      setInteractionId(iId);
      setStarting(false);
      setStreaming(true);

      const streamWorked = await connectToStream(iId);

      if (!streamWorked) {
        console.log('SSE stream unavailable, falling back to polling');
        await pollForResults(iId);
      } else {
        await new Promise(r => setTimeout(r, 1000));
        console.log('Stream ended, checking status via polling...');
        await pollForResults(iId);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Start research error:', e);
      toast.error(e?.message || 'Failed to start research');
      setStarting(false);
      setStreaming(false);
    }
  };

  // Save to DB when report is finalized (streaming done + report exists)
  useEffect(() => {
    if (report && !streaming && !starting && submittedPrompt) {
      // Only save if this is a fresh result (not loaded from DB)
      if (!session.deep_research_data?.report || session.deep_research_data.report !== report) {
        saveToDatabase(report, sources, submittedPrompt, submittedDocs);
      }
    }
  }, [report, streaming, starting]);

  const resumeStream = useCallback(async () => {
    if (!interactionId) return;
    const streamWorked = await connectToStream(interactionId, lastEventIdRef.current);
    if (!streamWorked) {
      await pollForResults(interactionId);
    }
  }, [interactionId, connectToStream, pollForResults]);

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
    setSubmittedPrompt(null);
    setSubmittedDocs([]);
    lastEventIdRef.current = null;
  };

  const isWorking = starting || streaming;

  return (
    <div className="space-y-4">
      {/* ── Submitted Prompt (chat-style) ── */}
      {submittedPrompt && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Brain className="h-3.5 w-3.5" />
                Research Prompt
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

          {report && !streaming ? (
            /* ── Final Report ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Research Report</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => report && downloadReportPdf(report, 'Deep Research Report', session.domain)} title="Download PDF">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="New research">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {(() => {
                const filteredSources = sources.filter(u => !u.includes('vertexaisearch.cloud.google.com'));
                return filteredSources.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Sources ({filteredSources.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredSources.slice(0, 30).map((url, i) => {
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
                ) : null;
              })()}
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground">
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
                  <ReactMarkdown>{report}</ReactMarkdown>
                </Suspense>
              </div>
            </div>
          ) : isWorking || steps.length > 0 ? (
            /* ── Live Progress ── */
            <div className="space-y-4">
              {steps.length > 0 && (
                <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/30 p-3">
                  <div className="space-y-2">
                    {steps.map((step) => (
                      <div key={step.id} className="flex items-start gap-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <StepIcon type={step.type} />
                        <span className="text-muted-foreground leading-snug">
                          <Suspense fallback={step.text}>
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <span>{children}</span>,
                                a: ({ href, children }) => (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{children}</a>
                                ),
                              }}
                            >
                              {step.text}
                            </ReactMarkdown>
                          </Suspense>
                        </span>
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

              {(() => {
                const filtered = sources.filter(u => !u.includes('vertexaisearch.cloud.google.com'));
                return filtered.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Sources found ({filtered.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {filtered.slice(0, 20).map((url, i) => {
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
                ) : null;
              })()}

              {report && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Report (writing…)</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground">
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

              {isWorking && steps.length === 0 && !report && (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {starting ? 'Starting Deep Research…' : 'Deep Research is running… waiting for first updates.'}
                  </span>
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

              {/* ── Context Preview ── */}
              <Accordion type="single" collapsible className="border rounded-lg">
                <AccordionItem value="context-preview" className="border-0">
                  <AccordionTrigger className="px-3 py-2 text-xs font-medium text-muted-foreground hover:no-underline">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      Preview AI Context
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <ContextPreview session={session} pages={pages} documents={documents} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button onClick={startResearch} disabled={starting || !prompt.trim()}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
                Start Deep Research
              </Button>
              <p className="text-xs text-muted-foreground">
                Estimated cost: ~$2-5 per research task. Takes 5-20 minutes.
              </p>
            </div>
          )}
    </div>
  );
}
