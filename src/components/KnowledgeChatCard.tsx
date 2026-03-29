import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, Loader2, BookOpen, MessageSquare, Sparkles, Plus, FileText, Globe, ChevronDown, ChevronRight, SlidersHorizontal, Copy, Check, Pencil, Brain, BookmarkPlus, Heart, ExternalLink, Search, Upload, Gauge, Download, Square, Telescope, BarChart3, X, Presentation } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { downloadReportPdf } from '@/lib/downloadReportPdf';
import { supabase } from '@/integrations/supabase/client';
import { ChatFileUpload, type ChatAttachment } from '@/components/chat/ChatFileUpload';
import { ChatInput, type ChatInputHandle } from '@/components/chat/ChatInput';
import { ChatProviderPicker, ChatReasoningPicker, type ReasoningEffort, type ModelProvider, MODEL_OPTIONS, VERSIONS } from '@/components/chat/ChatModelSelector';

import { ingestChatUploads, ingestChatConversation } from '@/lib/ragIngest';
import { ChatThreadSidebar } from '@/components/chat/ChatThreadSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

type RagDocument = { name: string; source_type: string };
type CouncilModel = { key: string; name: string; status: 'thinking' | 'done' | 'error'; response?: string };
type Message = { role: 'user' | 'assistant'; content: string | any[]; sources?: string[]; attachmentNames?: string[]; thinking?: string; webCitations?: string[]; ragDocuments?: RagDocument[]; isDeepResearch?: boolean; deepResearchSteps?: string[]; councilModels?: CouncilModel[] };

type SessionData = {
  id: string;
  domain: string;
  base_url: string;
  [key: string]: any;
};

type PageData = {
  url: string;
  title: string | null;
  ai_outline: string | null;
  raw_content: string | null;
  screenshot_url?: string | null;
};

type AttachedSite = { session_id: string; domain: string };

type Props = {
  session: SessionData;
  pages?: PageData[];
  selectedModel: string;
  provider: ModelProvider;
  reasoning: ReasoningEffort;
  onProviderChange: (provider: ModelProvider) => void;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  onDocumentsChanged?: () => void;
  stickyTabVisible?: boolean;
  /** When set, auto-fills the prompt and optionally enables deep research mode */
  pendingPrompt?: { text: string; deepResearch: boolean } | null;
  onPendingPromptConsumed?: () => void;
  /** Global chat mode: no crawl context by default, multi-session RAG */
  globalMode?: boolean;
  /** Additional session IDs to include in RAG search (for attached sites) */
  attachedSessionIds?: string[];
  /** Attached site metadata for display */
  attachedSites?: AttachedSite[];
  /** Callback to attach a site by session ID + domain */
  onSelectSite?: (sessionId: string, domain: string) => void;
  onDetachSite?: (sessionId: string) => void;
};

const DEEP_RESEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-research`;
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-chat`;
const COUNCIL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/council-chat`;

const SUGGESTED_QUESTIONS = [
  "What are the biggest performance issues on this site?",
  "Summarize the SEO findings and opportunities.",
  "What security vulnerabilities were detected?",
  "What technology stack is this site built on?",
  "What are the top accessibility issues?",
  "Give me a high-level executive summary of all findings.",
];

const GLOBAL_SUGGESTED_QUESTIONS = [
  "What do you know about my uploaded documents?",
  "Help me draft a strategy document.",
  "Summarize the key themes across my sources.",
  "What insights can you find in my attached knowledge?",
  "Help me brainstorm ideas.",
  "What questions should I be asking?",
];

const SOURCE_LABELS: Record<string, string> = {
  semrush: 'SEMrush', psi: 'PageSpeed', crux: 'CrUX', builtwith: 'BuiltWith',
  wappalyzer: 'Wappalyzer', detectzestack: 'DetectZeStack', wave: 'WAVE',
  observatory: 'Observatory', ssllabs: 'SSL Labs', httpstatus: 'HTTP Status',
  w3c: 'W3C', schema: 'Schema', readable: 'Readable',
  carbon: 'Carbon', yellowlab: 'Yellow Lab', gtmetrix: 'GTmetrix',
  avoma: 'Avoma', apollo: 'Apollo', ocean: 'Ocean.io', hubspot: 'HubSpot',
  nav: 'Navigation', sitemap: 'Sitemap', forms: 'Forms', content_types: 'Content Types',
  tech_analysis: 'Tech Analysis', pages: 'Scraped Pages',
};

/** Maps source keys to the tab and sectionId they live on */
const SOURCE_TAB_MAP: Record<string, { tab: string; sectionId: string }> = {
  semrush: { tab: 'raw-data', sectionId: 'semrush' },
  psi: { tab: 'raw-data', sectionId: 'pagespeed' },
  crux: { tab: 'raw-data', sectionId: 'crux' },
  builtwith: { tab: 'raw-data', sectionId: 'builtwith' },
  wappalyzer: { tab: 'raw-data', sectionId: 'wappalyzer' },
  detectzestack: { tab: 'raw-data', sectionId: 'detectzestack' },
  wave: { tab: 'raw-data', sectionId: 'wave' },
  observatory: { tab: 'raw-data', sectionId: 'observatory' },
  ssllabs: { tab: 'raw-data', sectionId: 'ssllabs' },
  httpstatus: { tab: 'raw-data', sectionId: 'httpstatus' },
  
  w3c: { tab: 'raw-data', sectionId: 'w3c' },
  schema: { tab: 'raw-data', sectionId: 'schema' },
  readable: { tab: 'raw-data', sectionId: 'readable' },
  carbon: { tab: 'raw-data', sectionId: 'carbon' },
  yellowlab: { tab: 'raw-data', sectionId: 'yellowlab' },
  gtmetrix: { tab: 'raw-data', sectionId: 'gtmetrix' },
  tech_analysis: { tab: 'raw-data', sectionId: 'tech-analysis' },
  nav: { tab: 'raw-data', sectionId: 'nav-structure' },
  sitemap: { tab: 'raw-data', sectionId: 'sitemap' },
  forms: { tab: 'raw-data', sectionId: 'forms' },
  content_types: { tab: 'raw-data', sectionId: 'content-types' },
  avoma: { tab: 'prospecting', sectionId: 'avoma' },
  apollo: { tab: 'prospecting', sectionId: 'apollo' },
  ocean: { tab: 'prospecting', sectionId: 'ocean' },
  hubspot: { tab: 'prospecting', sectionId: 'hubspot' },
  pages: { tab: 'raw-data', sectionId: 'content-audit' },
};

function detectSources(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const patterns: [string, string[]][] = [
    ['semrush', ['semrush']],
    ['psi', ['pagespeed', 'psi', 'lighthouse']],
    ['crux', ['crux', 'chrome ux']],
    ['builtwith', ['builtwith']],
    ['wappalyzer', ['wappalyzer']],
    ['detectzestack', ['detectzestack', 'zestack']],
    ['wave', ['wave accessibility', 'wave scan', 'wave found', 'wave report']],
    ['observatory', ['observatory', 'mozilla observatory']],
    ['ssllabs', ['ssl labs', 'ssllabs', 'ssl grade']],
    ['httpstatus', ['http status', 'httpstatus', 'redirect chain']],
    
    ['w3c', ['w3c valid']],
    ['schema', ['schema valid', 'structured data', 'json-ld']],
    ['readable', ['readabil', 'flesch']],
    ['carbon', ['website carbon', 'carbon footprint']],
    ['yellowlab', ['yellow lab']],
    ['gtmetrix', ['gtmetrix']],
    ['avoma', ['avoma']],
    ['apollo', ['apollo']],
    ['ocean', ['ocean.io', 'ocean data']],
    ['hubspot', ['hubspot']],
    ['tech_analysis', ['tech analysis', 'technology analysis']],
  ];
  for (const [key, terms] of patterns) {
    if (terms.some(t => lower.includes(t))) found.push(key);
  }
  return found;
}

// countSources removed — no longer displayed (RAG replaces full-context stats)

function UserBubbleContent({ content, attachmentNames }: { content: string; attachmentNames?: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const MAX_HEIGHT = 72; // ~3 lines
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > MAX_HEIGHT);
    }
  }, [content]);

  return (
    <>
      <div
        ref={contentRef}
        className={`whitespace-pre-wrap overflow-hidden transition-all ${!expanded && isOverflowing ? 'max-h-[72px]' : ''}`}
        style={!expanded && isOverflowing ? { WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' } : undefined}
      >
        {content}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] mt-1 opacity-80 hover:opacity-100 underline underline-offset-2"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {attachmentNames && attachmentNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {attachmentNames.map((name, j) => (
            <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-primary-foreground/20">
              📎 {name}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

function UserBubbleWrapper({ content, attachmentNames, onEdit, disabled }: { content: string; attachmentNames?: string[]; onEdit: (newText: string) => void; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEdit = () => {
    setEditText(content);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const submitEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === content) {
      setEditing(false);
      return;
    }
    setEditing(false);
    onEdit(trimmed);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitEdit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="max-w-[85%] w-full">
        <Textarea
          ref={editRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          className="min-h-[60px] text-sm"
          rows={2}
        />
        <div className="flex gap-1.5 mt-1.5 justify-end">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-6 px-2 text-xs" onClick={submitEdit}>
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] group/userbubble">
      <div className="bg-muted text-secondary-foreground rounded-[24px] rounded-tr-none px-5 py-4 text-base">
        <UserBubbleContent content={content} attachmentNames={attachmentNames} />
      </div>
      <div className="flex items-center gap-1 mt-1.5 justify-end opacity-0 group-hover/userbubble:opacity-100 transition-opacity">
        {!disabled && (
          <button
            onClick={startEdit}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Edit prompt"
          >
            <Pencil className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          title="Copy prompt"
        >
          {copied ? <Check className="h-5 w-5 text-accent" /> : <Copy className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

function AnimatedThinkingText({ label = 'Thinking' }: { label?: string }) {
  const [dotCount, setDotCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDotCount(d => (d + 1) % 4), 400);
    return () => clearInterval(interval);
  }, []);
  return <span className="text-base text-foreground">{label}{'.'.repeat(dotCount || 0)}</span>;
}

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="flex-shrink-0 animate-spin text-foreground" style={{ width: 28, height: 28 }} />
        ) : (
          <Brain className="flex-shrink-0 text-muted-foreground" style={{ width: 28, height: 28 }} />
        )}
        <span className="text-base text-foreground">Show Thinking</span>
        {expanded ? <ChevronDown className="h-5 w-5 -ml-1" strokeWidth={3} /> : <ChevronRight className="h-5 w-5 -ml-1" strokeWidth={3} />}
      </button>
      {expanded && (
        <div className="mt-2 border-l-2 border-primary/20 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed" style={{ marginLeft: 13, paddingLeft: 22 }}>
          {thinking}
        </div>
      )}
    </div>
  );
}

function CouncilThinkingBlock({ models, isStreaming }: { models: CouncilModel[]; isStreaming?: boolean }) {
  // Each model can be: 'collapsed' | 'capped' | 'full'
  type ViewState = 'collapsed' | 'capped' | 'full';
  const [modelStates, setModelStates] = useState<Record<string, ViewState>>({});
  const allDone = models.every(m => m.status !== 'thinking');

  // Default state: while streaming show capped, after done show collapsed
  const getState = (key: string): ViewState => {
    if (modelStates[key]) return modelStates[key];
    return isStreaming ? 'capped' : 'capped';
  };

  const toggleHeader = (key: string) => {
    setModelStates(prev => {
      const current = prev[key] || (isStreaming ? 'capped' : 'capped');
      // Header click: if showing content → collapse. If collapsed → show capped.
      const next = current === 'collapsed' ? 'capped' : 'collapsed';
      return { ...prev, [key]: next };
    });
  };

  const toggleFull = (key: string) => {
    setModelStates(prev => {
      const current = prev[key] || 'capped';
      const next = current === 'full' ? 'capped' : 'full';
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        {isStreaming ? (
          <Loader2 className="h-5 w-5 animate-spin text-foreground shrink-0" />
        ) : (
          <Sparkles className="h-5 w-5 text-foreground shrink-0" />
        )}
        <span className="text-base text-foreground font-medium">
          {isStreaming && !allDone
            ? `Model Council — ${models.filter(m => m.status === 'done').length}/${models.length} complete`
            : isStreaming
              ? <AnimatedThinkingText label="Model Council — Synthesizing" />
              : 'Model Council'}
        </span>
      </div>
      {models.map(m => {
        const state = getState(m.key);
        const isOpen = state !== 'collapsed';
        const isFull = state === 'full';
        const statusIcon = m.status === 'done' ? '✅' : m.status === 'error' ? '❌' : undefined;
        return (
          <div key={m.key} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleHeader(m.key)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              {m.status === 'thinking' ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <span className="text-sm shrink-0">{statusIcon}</span>
              )}
              <span className="text-sm font-medium text-foreground">{m.name}</span>
              <span className="text-xs text-muted-foreground">
                {m.status === 'thinking' ? 'Thinking…' : m.status === 'done' ? 'Complete' : 'Error'}
              </span>
              <span className="ml-auto">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </span>
            </button>
            {isOpen && m.response && (
              <div className="px-4 py-3 text-sm border-t border-border">
              <div className="relative">
                <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
                  <div
                    className={`chat-prose max-w-none text-sm transition-all ${isFull ? '' : 'max-h-[15rem] overflow-hidden'}`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.response}</ReactMarkdown>
                  </div>
                </Suspense>
                {!isFull && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFull(m.key); }}
                  className="relative z-10 text-xs text-foreground/70 hover:text-foreground flex items-center gap-1 mx-auto mt-2 justify-center w-full font-medium"
                >
                  {isFull ? (
                    <><ChevronDown className="h-3 w-3" /> Show less</>
                  ) : (
                    <><ChevronRight className="h-3 w-3" /> Show more</>
                  )}
                </button>
              </div>
              </div>
            )}
            {isOpen && m.status === 'thinking' && !m.response && (
              <div className="px-4 py-3 border-t border-border">
                <AnimatedThinkingText label="Thinking" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function classifyResearchStep(text: string): 'searching' | 'reading' | 'writing' | 'source' | 'thinking' {
  const lower = text.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'source';
  if (lower.includes('searching') || lower.includes('search for') || lower.includes('querying') || lower.includes('looking up')) return 'searching';
  if (lower.includes('reading') || lower.includes('browsing') || lower.includes('visiting') || lower.includes('looking at') || lower.includes('reviewing')) return 'reading';
  if (lower.includes('writing') || lower.includes('drafting') || lower.includes('composing') || lower.includes('finalizing') || lower.includes('summariz')) return 'writing';
  return 'thinking';
}

function ResearchStepIcon({ type }: { type: ReturnType<typeof classifyResearchStep> }) {
  switch (type) {
    case 'searching': return <Search className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case 'reading': return <BookOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    case 'writing': return <FileText className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'source': return <Globe className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    default: return <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function DeepResearchStepsBlock({ steps, sources, isStreaming }: { steps: string[]; sources?: string[]; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const lastSteps = steps.slice(-3);
  const sourceCount = sources?.length || 0;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="flex-shrink-0 animate-spin text-foreground" style={{ width: 24, height: 24 }} />
        ) : (
          <Telescope className="flex-shrink-0 text-muted-foreground" style={{ width: 24, height: 24 }} />
        )}
        <span className="text-sm text-foreground">
          {isStreaming ? `Researching… (${steps.length} steps)` : `Deep Research (${steps.length} steps)`}
        </span>
        {sourceCount > 0 && (
          <span className="text-xs font-normal text-muted-foreground/70">
            · {sourceCount} source{sourceCount !== 1 ? 's' : ''}
          </span>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 -ml-1" strokeWidth={3} /> : <ChevronRight className="h-4 w-4 -ml-1" strokeWidth={3} />}
      </button>
      {!expanded && isStreaming && lastSteps.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/70 leading-relaxed" style={{ marginLeft: 32 }}>
          <ResearchStepIcon type={classifyResearchStep(lastSteps[lastSteps.length - 1])} />
          <span>{lastSteps[lastSteps.length - 1]}</span>
        </div>
      )}
      {expanded && (
        <div className="mt-2 border-l-2 border-primary/20 text-xs text-muted-foreground leading-relaxed space-y-1.5" style={{ marginLeft: 11, paddingLeft: 20 }}>
          {steps.map((step, i) => {
            const type = classifyResearchStep(step);
            return (
              <div key={i} className="flex items-start gap-1.5 animate-in fade-in duration-200">
                <ResearchStepIcon type={type} />
                {type === 'source' ? (
                  <a href={step} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[400px]">
                    {(() => { try { return new URL(step).hostname; } catch { return step; } })()}
                  </a>
                ) : (
                  <span>{step}</span>
                )}
              </div>
            );
          })}
          {sources && sources.length > 0 && (
            <div className="mt-3 pt-2 border-t border-primary/10">
              <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">Sources Found</p>
              {sources.map((url, i) => {
                let hostname = url;
                try { hostname = new URL(url).hostname; } catch {}
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                  >
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate max-w-[350px]">{hostname}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantBubbleWrapper({ content, thinking, isStreamingThis, onSaveNote, onToggleFavorite, isFavorited }: { content: string; thinking?: string; isStreamingThis?: boolean; onSaveNote?: (content: string) => void; onToggleFavorite?: () => void; isFavorited?: boolean }) {
  return <AssistantBubbleInner content={content} thinking={thinking} isStreamingThis={isStreamingThis} onSaveNote={onSaveNote} onToggleFavorite={onToggleFavorite} isFavorited={isFavorited} />;
}

function WebCitationsBlock({ citations, isSearching }: { citations: string[]; isSearching?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!citations.length && !isSearching) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Search className="h-3 w-3" />
        <span>
          {isSearching && !citations.length
            ? 'Searching the web…'
            : `Searched ${citations.length} site${citations.length !== 1 ? 's' : ''}`}
        </span>
        {isSearching && (
          <span className="flex gap-0.5 ml-1">
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </button>
      {expanded && citations.length > 0 && (
        <div className="mt-1.5 ml-5 space-y-1">
          {citations.map((url, i) => {
            let displayUrl = url;
            try { displayUrl = new URL(url).hostname; } catch {}
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{displayUrl}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Renders text nodes, transforming [N] citation references into styled superscript links */
function CitationText({ children, citations }: { children: React.ReactNode; citations?: string[] }) {
  if (typeof children !== 'string') return <>{children}</>;

  const parts: React.ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    const num = parseInt(match[1], 10);
    const url = citations && citations[num - 1];
    if (url) {
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-[3px] text-[10px] font-semibold rounded-sm bg-primary/15 text-primary hover:bg-primary/25 transition-colors no-underline align-super leading-none -translate-y-[1px]"
          title={url}
        >
          {num}
        </a>
      );
    } else {
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-[3px] text-[10px] font-semibold rounded-sm bg-muted text-muted-foreground align-super leading-none -translate-y-[1px]"
        >
          {num}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : <>{children}</>;
}

const SOURCE_TYPE_ICONS: Record<string, string> = {
  integration: '📊',
  scrape: '🌐',
  upload: '📎',
  chat: '💬',
  gdrive: '📁',
  screenshot: '📸',
  image: '🖼️',
  email: '📧',
  note: '📝',
  pdf: '📄',
  doc: '📃',
  research: '🔬',
};

function ReferencesBlock({ ragDocuments, sources, onSourceClick, webCitations }: { ragDocuments: RagDocument[]; sources: string[]; onSourceClick?: (s: string) => void; webCitations?: string[] }) {
  const [expanded, setExpanded] = useState(false);

  // Combine: RAG documents + detected integration sources not already in RAG docs
  const integrationSources = sources.filter(s => {
    const label = SOURCE_LABELS[s] || s;
    return !ragDocuments.some(d => d.name.toLowerCase().includes(label.toLowerCase()));
  });

  const webRefs = webCitations || [];
  const totalRefs = ragDocuments.length + integrationSources.length + webRefs.length;
  if (totalRefs === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <FileText className="h-3.5 w-3.5" />
        <span>{totalRefs} source{totalRefs !== 1 ? 's' : ''} referenced</span>
      </button>
      {expanded && (
        <div className="mt-2 ml-5 space-y-0.5">
          {ragDocuments.length > 0 && (
            <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mt-1 mb-1">Documents</div>
          )}
          {ragDocuments.map((doc, i) => (
            <div key={`rag-${i}`} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span>{SOURCE_TYPE_ICONS[doc.source_type] || '📄'}</span>
              <span className="truncate max-w-[300px]">{doc.name}</span>
              <span className="text-[11px] opacity-60">({doc.source_type})</span>
            </div>
          ))}
          {integrationSources.map(s => (
            <button
              key={`src-${s}`}
              onClick={() => onSourceClick?.(s)}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>📊</span>
              <span className="truncate max-w-[300px]">{SOURCE_LABELS[s] || s}</span>
              <span className="text-[11px] opacity-60">(integration)</span>
            </button>
          ))}
          {webRefs.length > 0 && (
            <>
              <div className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mt-2 mb-1">Web</div>
              {webRefs.map((url, i) => {
                let displayUrl = url;
                try { displayUrl = new URL(url).hostname; } catch {}
                return (
                  <a
                    key={`web-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[300px]">{displayUrl}</span>
                    <span className="text-[11px] opacity-60">[{i + 1}]</span>
                  </a>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantBubbleInner({ content, thinking, isStreamingThis, onSaveNote, onToggleFavorite, isFavorited, isSavedNote, webCitations, isWebSearching, sources, onSourceClick, domain, ragDocuments, searchLabel, deepResearchSteps, isDeepResearch, councilModels }: { content: string; thinking?: string; isStreamingThis?: boolean; onSaveNote?: (content: string) => void; onToggleFavorite?: () => void; isFavorited?: boolean; isSavedNote?: boolean; webCitations?: string[]; isWebSearching?: boolean; sources?: string[]; onSourceClick?: (s: string) => void; domain?: string; ragDocuments?: RagDocument[]; searchLabel?: string; deepResearchSteps?: string[]; isDeepResearch?: boolean; councilModels?: CouncilModel[] }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'gdoc' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    if (onSaveNote) {
      onSaveNote(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleExportPdf = () => {
    downloadReportPdf(content, 'AI Chat Response', domain || 'chat');
  };

  const handleExportGoogleDoc = async () => {
    const TOKEN_KEY = 'google-drive-access-token';
    const PICKER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-picker`;
    const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

    const tryExport = async (token: string) => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-doc-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          accessToken: token,
          content,
          title: `AI Response — ${domain || 'Chat'} — ${new Date().toLocaleDateString()}`,
        }),
      });
      return response;
    };

    const reconnectAndGetToken = async (): Promise<string | null> => {
      try {
        const clientIdResp = await fetch(PICKER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'get-client-id' }),
        });
        if (!clientIdResp.ok) throw new Error('Could not get Google config');
        const { clientId } = await clientIdResp.json();

        // Load GSI script if needed
        if (!(window as any).google?.accounts?.oauth2) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.onload = () => resolve();
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }

        const token = await new Promise<string>((resolve, reject) => {
          const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (resp: any) => {
              if (resp.error) reject(new Error(resp.error));
              else resolve(resp.access_token);
            },
          });
          tokenClient.requestAccessToken();
        });

        localStorage.setItem(TOKEN_KEY, token);
        return token;
      } catch (e) {
        console.error('Google reconnect failed:', e);
        return null;
      }
    };

    let accessToken = localStorage.getItem(TOKEN_KEY);

    // If no token at all, prompt connect first
    if (!accessToken) {
      toast('Connecting to Google Drive…');
      accessToken = await reconnectAndGetToken();
      if (!accessToken) { toast.error('Google Drive connection cancelled'); return; }
    }

    setExporting('gdoc');
    try {
      let response = await tryExport(accessToken);
      let data = await response.json();

      // If insufficient scope or auth error, auto-reconnect with new scopes
      if (data.error === 'insufficient_scope' || response.status === 401 || response.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        toast('Reconnecting Google Drive with write access…');
        const newToken = await reconnectAndGetToken();
        if (!newToken) { toast.error('Google Drive reconnection cancelled'); return; }
        response = await tryExport(newToken);
        data = await response.json();
      }

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to create Google Doc');
        return;
      }
      toast.success('Google Doc created!');
      if (data.webViewLink) {
        window.open(data.webViewLink, '_blank');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to export');
    } finally {
      setExporting(null);
    }
  };

  const markdownComponents = {
    text: ({ children }: any) => <CitationText citations={webCitations}>{children}</CitationText>,
    img: ({ src, alt, ...props }: any) => (
      <img src={src} alt={alt || ''} className="max-w-full rounded-lg my-2" style={{ maxHeight: 300 }} loading="lazy" {...props} />
    ),
  };

  return (
    <div className="group relative w-full pr-10 py-3 pb-6 text-base rounded-lg text-foreground pl-0">
      {thinking && (
        <ThinkingBlock thinking={thinking} isStreaming={isStreamingThis && !content} />
      )}
      {/* Council model thinking */}
      {councilModels && councilModels.length > 0 && (
        <CouncilThinkingBlock models={councilModels} isStreaming={isStreamingThis} />
      )}
      {/* Deep Research steps */}
      {isDeepResearch && deepResearchSteps && deepResearchSteps.length > 0 && (
        <DeepResearchStepsBlock steps={deepResearchSteps} sources={webCitations} isStreaming={isStreamingThis && !content} />
      )}
      <Suspense fallback={<div className="chat-prose max-w-none invisible" aria-hidden>{content}</div>}>
        <div className="chat-prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      </Suspense>
      {isStreamingThis && !content && !thinking && !(isDeepResearch && deepResearchSteps && deepResearchSteps.length > 0) && !(councilModels && councilModels.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="flex-shrink-0 animate-spin text-foreground" style={{ width: 28, height: 28 }} />
            <AnimatedThinkingText label={isDeepResearch ? 'Starting Deep Research' : (searchLabel || 'Thinking')} />
          </div>
        </div>
      )}
      {content && !isStreamingThis && (
        <div className="flex items-center gap-1 mt-5 flex-wrap">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  {copied ? <Check className="h-5 w-5 text-accent" /> : <Copy className="h-5 w-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                {copied ? 'Copied!' : 'Copy'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  {saved ? <Check className="h-5 w-5 text-accent" /> : <BookmarkPlus className={`h-5 w-5 transition-colors ${isSavedNote ? 'fill-blue-500 text-blue-500' : ''}`} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                {saved ? 'Saved!' : 'Save'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFavorite}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <Heart className={`h-5 w-5 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                {isFavorited ? 'Unfavorite' : 'Favorite'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExportPdf}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <Download className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                PDF
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExportGoogleDoc}
                  disabled={exporting === 'gdoc'}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  {exporting === 'gdoc' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                Google Doc
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      {content && !isStreamingThis && (ragDocuments?.length || (sources && sources.length > 0) || (webCitations && webCitations.length > 0)) && (
        <ReferencesBlock
          ragDocuments={ragDocuments || []}
          sources={sources || []}
          onSourceClick={onSourceClick}
          webCitations={webCitations}
        />
      )}
    </div>
  );
}

export function KnowledgeChatCard({ session, pages, selectedModel, provider, reasoning, onProviderChange, onModelChange, onReasoningChange, onDocumentsChanged, stickyTabVisible, pendingPrompt, onPendingPromptConsumed, globalMode, attachedSessionIds, attachedSites, onSelectSite, onDetachSite }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasInputText, setHasInputText] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchSources, setSearchSourcesRaw] = useState<{ documents: boolean; web: boolean; analytics: boolean; harvest: boolean; asana: boolean }>(() => {
    try {
      const saved = localStorage.getItem('chat-search-sources');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { documents: parsed.documents !== false, web: !!parsed.web, analytics: !!parsed.analytics, harvest: !!parsed.harvest, asana: !!parsed.asana };
      }
    } catch {}
    return { documents: true, web: false, analytics: false, harvest: false, asana: false };
  });
  const setSearchSources: typeof setSearchSourcesRaw = (updater) => {
    setSearchSourcesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('chat-search-sources', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [ragDepth, setRagDepth] = useState<{ match_count: number; match_threshold: number }>({ match_count: 50, match_threshold: 0.15 });
  const [contextWindowSize, setContextWindowSize] = useState<'small' | 'medium' | 'large'>(
    () => (localStorage.getItem('ai-context-window') as 'small' | 'medium' | 'large') || 'medium'
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [savedNoteContents, setSavedNoteContents] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const handleFilesRef = useRef<((files: FileList) => void) | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [composerHeight, setComposerHeight] = useState(176);
  const [availableSites, setAvailableSites] = useState<{ id: string; domain: string }[]>([]);

  // Deep Research mode
  const [deepResearchMode, setDeepResearchMode] = useState(false);
  const deepResearchInteractionRef = useRef<string | null>(null);
  // Track the last completed interaction ID per thread for follow-up chaining
  const lastDeepResearchIdRef = useRef<string | null>(null);
  // Track last SSE event ID for stream reconnection
  const lastEventIdRef = useRef<string | null>(null);

  const supportsLiveTools = !selectedModel.startsWith('claude-') && !selectedModel.startsWith('perplexity-');
  const ensureToolCapableModel = useCallback(() => {
    if (supportsLiveTools) return false;
    onModelChange('google/gemini-3-flash-preview');
    onProviderChange('gateway' as ModelProvider);
    toast.info('Switched to Gemini so live tools like Harvest and Asana can run.');
    return true;
  }, [onModelChange, onProviderChange, supportsLiveTools]);

  // Thread management
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const threadInitRef = useRef<string | null>(null);
  const queuedPromptRef = useRef<{ text: string; deepResearch: boolean; threadId: string } | null>(null);

  const crawlContext = globalMode ? '' : buildCrawlContext(session, pages);

  // Load available sites for the site picker (global mode only)
  useEffect(() => {
    if (!globalMode) return;
    supabase
      .from('crawl_sessions')
      .select('id, domain')
      .neq('domain', '__global_chat__')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAvailableSites(data);
      });
  }, [globalMode]);

  // Initialize: load or create default thread
  useEffect(() => {
    if (threadInitRef.current === session.id) return;
    threadInitRef.current = session.id;

    const initThread = async () => {
      // Try to find existing threads
      const { data: threads } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('session_id', session.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (threads && threads.length > 0) {
        setActiveThreadId(threads[0].id);
      } else {
        // Create first thread
        const { data: newThread } = await supabase
          .from('chat_threads')
          .insert({ session_id: session.id, title: 'New Chat' } as any)
          .select('id')
          .single();
        if (newThread) {
          setActiveThreadId(newThread.id);
          setSidebarRefreshKey(k => k + 1);
        }
      }
    };
    initThread();
  }, [session.id]);

  // Load chat history from DB — per thread
  useEffect(() => {
    if (!activeThreadId) return;
    const key = `${session.id}:${activeThreadId}`;
    if (loadedSessionRef.current === key) return;
    loadedSessionRef.current = key;
    setLoadingHistory(true);
    supabase
      .from('knowledge_messages')
      .select('role, content, sources, rag_documents, web_citations')
      .eq('session_id', session.id)
      .eq('thread_id', activeThreadId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map((m: any) => {
            // Check if rag_documents contains council model data
            const councilDoc = Array.isArray(m.rag_documents) && m.rag_documents.find((d: any) => d.name === '__council__');
            const councilModels = councilDoc?.models as CouncilModel[] | undefined;
            const ragDocs = councilDoc ? undefined : (m.rag_documents || undefined);
            return {
              role: m.role as 'user' | 'assistant',
              content: m.content,
              sources: m.sources || [],
              ragDocuments: ragDocs,
              webCitations: m.web_citations || undefined,
              councilModels: councilModels || undefined,
            };
          }));
        } else {
          setMessages([]);
        }
        setLoadingHistory(false);
        // Scroll to last user prompt after loading a thread (Gemini-style)
        if (data && data.length > 2) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              lastUserMsgRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
            });
          });
        }
      });
  }, [session.id, activeThreadId]);

  // Load favorites
  useEffect(() => {
    supabase
      .from('knowledge_favorites')
      .select('content')
      .eq('session_id', session.id)
      .then(({ data }) => {
        if (data) setFavoriteIds(new Set(data.map(f => f.content)));
      });
  }, [session.id]);

  // Load saved note contents to show persistent blue bookmark
  useEffect(() => {
    supabase
      .from('knowledge_documents')
      .select('id')
      .eq('session_id', session.id)
      .eq('source_type', 'chat_note')
      .then(async ({ data: docs }) => {
        if (!docs || docs.length === 0) return;
        const docIds = docs.map(d => d.id);
        const { data: chunks } = await supabase
          .from('knowledge_chunks')
          .select('chunk_text')
          .in('document_id', docIds)
          .eq('chunk_index', 0);
        if (chunks) {
          setSavedNoteContents(new Set(chunks.map(c => c.chunk_text.slice(0, 200))));
        }
      });
  }, [session.id]);

  useEffect(() => {
    if (!composerRef.current) return;

    const updateComposerHeight = () => {
      if (composerRef.current) {
        setComposerHeight(composerRef.current.getBoundingClientRect().height);
      }
    };

    updateComposerHeight();
    const observer = new ResizeObserver(updateComposerHeight);
    observer.observe(composerRef.current);
    window.addEventListener('resize', updateComposerHeight, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateComposerHeight);
    };
  }, []);

  const scrollToLastUserMessage = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastUserMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const saveMessage = async (role: string, content: string, sources: string[] = [], ragDocs?: RagDocument[], webCites?: string[]) => {
    if (!activeThreadId) return;
    await supabase.from('knowledge_messages').insert({
      session_id: session.id,
      thread_id: activeThreadId,
      role,
      content,
      sources,
      rag_documents: ragDocs && ragDocs.length > 0 ? ragDocs : null,
      web_citations: webCites && webCites.length > 0 ? webCites : null,
    } as any);
  };

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || chatInputRef.current?.getValue()?.trim() || '';
    const currentAttachments = [...attachments];
    const hasAttachments = currentAttachments.length > 0;
    const hasParsing = currentAttachments.some(a => a.parsing);
    const requiresLiveTools = searchSources.harvest || searchSources.asana || (!globalMode && searchSources.analytics);
    const requestModel = !supportsLiveTools && requiresLiveTools ? 'google/gemini-3-flash-preview' : selectedModel;
    const requestSupportsLiveTools = !requestModel.startsWith('claude-') && !requestModel.startsWith('perplexity-');

    if ((!messageText && !hasAttachments) || isStreaming || hasParsing) return;
    if (requiresLiveTools && !supportsLiveTools) {
      ensureToolCapableModel();
    }

    // Build message content - multimodal if images attached
    const imageAttachments = currentAttachments.filter(a => a.type === 'image');
    const textAttachments = currentAttachments.filter(a => a.type === 'text' || a.type === 'document');
    const attachmentNames = currentAttachments.map(a => a.name);

    // Build the content for the AI request
    let messageContent: string | any[];
    if (imageAttachments.length > 0) {
      const parts: any[] = [];
      // Add text attachments as context
      if (textAttachments.length > 0) {
        const textContext = textAttachments
          .map(a => `--- Attached: ${a.name} ---\n${a.content}`)
          .join('\n\n');
        parts.push({ type: 'text', text: (messageText ? messageText + '\n\n' : '') + textContext });
      } else if (messageText) {
        parts.push({ type: 'text', text: messageText });
      }
      // Add images
      for (const img of imageAttachments) {
        parts.push({ type: 'image_url', image_url: { url: img.content } });
      }
      messageContent = parts;
    } else if (textAttachments.length > 0) {
      const textContext = textAttachments
        .map(a => `--- Attached: ${a.name} ---\n${a.content}`)
        .join('\n\n');
      messageContent = (messageText ? messageText + '\n\n' : 'Please analyze the attached files:\n\n') + textContext;
    } else {
      messageContent = messageText;
    }

    // Display message shows just the text + attachment names
    const displayContent = messageText || `Attached ${attachmentNames.join(', ')}`;
    const userMsg: Message = { role: 'user', content: displayContent, attachmentNames };
    const assistantPlaceholder: Message = { role: 'assistant', content: '' };
    const newMessages = [...messages, userMsg];

    const clearPendingAssistantPlaceholder = () => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        const hasContent = typeof last.content === 'string' && last.content.trim().length > 0;
        if (hasContent || last.thinking || last.webCitations?.length) return prev;
        return prev.slice(0, -1);
      });
    };

    setMessages([...newMessages, assistantPlaceholder]);
    chatInputRef.current?.clear();
    setAttachments([]);
    setIsStreaming(true);
    setIsThinking(true);
    scrollToLastUserMessage();

    // Ingest uploaded files into RAG document library (fire-and-forget)
    if (currentAttachments.length > 0) {
      ingestChatUploads(session.id, currentAttachments).then(count => {
        if (count > 0 && onDocumentsChanged) onDocumentsChanged();
      });
    }

    // Save user message to DB
    saveMessage('user', typeof displayContent === 'string' ? displayContent : messageText);

    let assistantContent = '';
    let thinkingContent = '';
    let displayedAssistantContent = '';
    let displayedThinkingContent = '';
    let webCitations: string[] = [];
    let ragDocuments: RagDocument[] = [];
    let animationFrameId: number | null = null;
    let lastAnimationTs = 0;

    // Build the API messages - use multimodal content for the current message
    const apiMessages = newMessages.map((m, i) => {
      if (i === newMessages.length - 1) {
        return { role: m.role, content: messageContent };
      }
      // For previous messages, just send text
      return { role: m.role, content: typeof m.content === 'string' ? m.content : messageText };
    });

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // ─── Council mode: SSE streaming ───
      const isCouncil = requestModel.startsWith('council-');
      if (isCouncil) {
        setIsThinking(false); // We'll show custom status instead
        const councilResp = await fetch(COUNCIL_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            crawlContext,
            customInstructions: localStorage.getItem('ai-custom-instructions') || undefined,
            councilModels: (() => { try { return JSON.parse(localStorage.getItem('council-models') || '[]'); } catch { return []; } })(),
            synthesisModel: (() => { try { return JSON.parse(localStorage.getItem('council-synthesis-model') || 'null'); } catch { return null; } })(),
          }),
        });

        if (!councilResp.ok) {
          const errText = await councilResp.text();
          let errMsg = `Council error ${councilResp.status}`;
          try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
          toast.error(errMsg);
          clearPendingAssistantPlaceholder();
          setIsStreaming(false);
          return;
        }

        const reader = councilResp.body!.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let synthesisText = '';
        const modelStatuses: Record<string, CouncilModel> = {};

        const updateCouncilMessage = () => {
          const councilModels = Object.entries(modelStatuses).map(([key, m]) => ({ ...m, key }));
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: synthesisText, councilModels };
            return updated;
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              try {
                const data = JSON.parse(payload);
                switch (currentEvent) {
                  case 'model_start':
                    modelStatuses[data.key] = { key: data.key, name: data.name, status: 'thinking', response: '' };
                    updateCouncilMessage();
                    break;
                  case 'model_chunk':
                    if (modelStatuses[data.key]) {
                      modelStatuses[data.key].response = (modelStatuses[data.key].response || '') + data.text;
                      updateCouncilMessage();
                    }
                    break;
                  case 'model_done':
                    modelStatuses[data.key] = { key: data.key, name: data.name, status: 'done', response: data.response };
                    updateCouncilMessage();
                    break;
                  case 'model_error':
                    modelStatuses[data.key] = { key: data.key, name: data.name, status: 'error' };
                    updateCouncilMessage();
                    break;
                  case 'synthesis_start':
                    // Force all models to done when synthesis begins
                    for (const key of Object.keys(modelStatuses)) {
                      if (modelStatuses[key].status === 'thinking') {
                        modelStatuses[key].status = 'done';
                      }
                    }
                    updateCouncilMessage();
                    break;
                  case 'synthesis_chunk':
                    synthesisText += data.text;
                    updateCouncilMessage();
                    break;
                  case 'error':
                    toast.error(data.message || 'Council error');
                    break;
                  case 'done':
                    break;
                }
              } catch {}
            }
          }
        }

        // Final save — store synthesis + council model data
        const finalModels = Object.entries(modelStatuses).map(([key, m]) => ({ ...m, key }));
        const finalContent = synthesisText || 'No synthesis available.';

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: finalContent, councilModels: finalModels };
          return updated;
        });

        // Persist: store council models as rag_documents (JSONB) with a sentinel
        const councilPayload = [{ name: '__council__', source_type: 'council', models: finalModels }];
        saveMessage('assistant', finalContent, [], councilPayload as any);
        setIsStreaming(false);
        return;
      }

      // ─── Standard streaming chat ───
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          crawlContext,
          session_id: globalMode ? undefined : session.id,
          session_ids: globalMode ? [session.id, ...(attachedSessionIds || [])] : undefined,
          model: requestModel,
          reasoning: reasoning !== 'none' ? reasoning : undefined,
          sources: {
            ...searchSources,
            analytics: !globalMode && searchSources.analytics && requestSupportsLiveTools,
            harvest: searchSources.harvest && requestSupportsLiveTools,
            asana: searchSources.asana && requestSupportsLiveTools,
          },
          rag_depth: ragDepth,
          context_window: contextWindowSize,
          tonePreset: localStorage.getItem('ai-tone-preset') || 'default',
          characteristics: (() => { try { const s = localStorage.getItem('ai-characteristics'); return s ? JSON.parse(s) : []; } catch { return []; } })(),
          customInstructions: localStorage.getItem('ai-custom-instructions') || undefined,
          aboutMe: (() => { try { const s = localStorage.getItem('ai-about-me'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
          personalBio: localStorage.getItem('ai-personal-bio') || undefined,
          myRole: localStorage.getItem('ai-my-role') || undefined,
          locationData: (() => { try { const s = localStorage.getItem('ai-location'); return s ? JSON.parse(s) : undefined; } catch { return undefined; } })(),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errorMsg = errData.error || `Error ${resp.status}`;
        if (resp.status === 429) {
          toast.error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (resp.status === 402) {
          toast.error('AI credits exhausted. Please add funds in Settings → Workspace → Usage.');
        } else {
          toast.error(errorMsg);
        }
        clearPendingAssistantPlaceholder();
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      if (!resp.body) {
        toast.error('No response stream');
        clearPendingAssistantPlaceholder();
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      // Track whether we're inside a <think> block (Perplexity reasoning models)
      let inThinkBlock = false;
      let rawAccumulator = ''; // accumulates raw content to parse <think> tags

      const flushAccumulator = () => {
        if (!rawAccumulator) return;
        // Process accumulated raw content for <think> tags
        let remaining = rawAccumulator;
        rawAccumulator = '';

        while (remaining.length > 0) {
          if (inThinkBlock) {
            const closeIdx = remaining.indexOf('</think>');
            if (closeIdx === -1) {
              // Still inside think block, all remaining is thinking
              thinkingContent += remaining;
              remaining = '';
            } else {
              thinkingContent += remaining.slice(0, closeIdx);
              inThinkBlock = false;
              remaining = remaining.slice(closeIdx + 8); // skip '</think>'
            }
          } else {
            const openIdx = remaining.indexOf('<think>');
            if (openIdx === -1) {
              // No think tag, all remaining is content
              assistantContent += remaining;
              remaining = '';
            } else {
              // Content before <think>
              assistantContent += remaining.slice(0, openIdx);
              inThinkBlock = true;
              remaining = remaining.slice(openIdx + 7); // skip '<think>'
            }
          }
        }
      };

      const commitMessages = (
        contentForUi = displayedAssistantContent,
        thinkingForUi = displayedThinkingContent,
      ) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const msgData: Message = {
            role: 'assistant',
            content: contentForUi,
            thinking: thinkingForUi || undefined,
            webCitations,
            ragDocuments: ragDocuments.length > 0 ? ragDocuments : undefined,
          };
          if (last?.role === 'assistant' && prev.length === newMessages.length + 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, ...msgData } : m);
          }
          return [...prev, msgData];
        });
      };

      const updateMessages = () => {
        if (animationFrameId !== null) return;

        animationFrameId = requestAnimationFrame(function animate(ts) {
          if (!lastAnimationTs) lastAnimationTs = ts;
          const delta = Math.min(ts - lastAnimationTs, 48);
          lastAnimationTs = ts;

          let charBudget = Math.max(2, Math.floor(delta * 0.45));
          const pendingThinking = thinkingContent.length - displayedThinkingContent.length;
          const pendingAssistant = assistantContent.length - displayedAssistantContent.length;
          const totalBacklog = pendingThinking + pendingAssistant;

          if (totalBacklog > 120) {
            charBudget = Math.max(charBudget, Math.ceil(totalBacklog / 18));
          }

          if (pendingThinking > 0) {
            const take = Math.min(charBudget, pendingThinking);
            displayedThinkingContent = thinkingContent.slice(0, displayedThinkingContent.length + take);
            charBudget -= take;
          }

          if (charBudget > 0 && pendingAssistant > 0) {
            const take = Math.min(charBudget, pendingAssistant);
            displayedAssistantContent = assistantContent.slice(0, displayedAssistantContent.length + take);
          }

          commitMessages();

          const stillPending =
            displayedThinkingContent.length < thinkingContent.length ||
            displayedAssistantContent.length < assistantContent.length;

          if (stillPending) {
            animationFrameId = requestAnimationFrame(animate);
          } else {
            animationFrameId = null;
            lastAnimationTs = 0;
          }
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.web_citations) {
              webCitations = parsed.web_citations;
              commitMessages();
              continue;
            }

            if (parsed.rag_documents) {
              ragDocuments = parsed.rag_documents;
              commitMessages();
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const reasoningContent = (
              parsed.choices?.[0]?.delta?.reasoning_content ??
              parsed.choices?.[0]?.delta?.reasoning ??
              parsed.choices?.[0]?.delta?.reasoning_details?.find((d: any) => d?.type === 'reasoning.text')?.text
            ) as string | undefined;
            if (reasoningContent) {
              thinkingContent += reasoningContent;
              updateMessages();
            }
            if (content) {
              rawAccumulator += content;
              flushAccumulator();
              if (assistantContent && isThinking) setIsThinking(false);
              updateMessages();
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      lastAnimationTs = 0;

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const reasoningContent = (
              parsed.choices?.[0]?.delta?.reasoning_content ??
              parsed.choices?.[0]?.delta?.reasoning ??
              parsed.choices?.[0]?.delta?.reasoning_details?.find((d: any) => d?.type === 'reasoning.text')?.text
            ) as string | undefined;
            if (reasoningContent) {
              thinkingContent += reasoningContent;
            }
            if (content) {
              rawAccumulator += content;
              flushAccumulator();
            }
          } catch { /* ignore */ }
        }
      }

      displayedAssistantContent = assistantContent;
      displayedThinkingContent = thinkingContent;
      commitMessages(assistantContent, thinkingContent);

      // If assistant content is empty (e.g. MALFORMED_FUNCTION_CALL), show a helpful message
      if (!assistantContent.trim()) {
        const retryMsg = 'I encountered an issue processing that request. Please try again — sometimes rephrasing the question helps.';
        assistantContent = retryMsg;
        displayedAssistantContent = retryMsg;
        commitMessages(retryMsg, thinkingContent);
        toast.error('Response was empty — the AI model may have encountered a processing error. Try again.');
      }

      // Detect sources and save assistant message
      const sources = detectSources(assistantContent);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, sources, webCitations, ragDocuments: ragDocuments.length > 0 ? ragDocuments : undefined } : m);
        }
        return prev;
      });
      saveMessage('assistant', assistantContent, sources, ragDocuments, webCitations);

      // Auto-title the thread if it's still "New Chat"
      if (activeThreadId && newMessages.length === 1) {
        // First message — generate an AI title (fire-and-forget)
        const titleText = typeof displayContent === 'string' ? displayContent : messageText;
        const fallbackTitle = titleText.slice(0, 30).replace(/\n/g, ' ').trim();
        // Set fallback immediately, then upgrade with AI title
        supabase.from('chat_threads').update({ title: fallbackTitle, updated_at: new Date().toISOString() } as any).eq('id', activeThreadId).then(() => setSidebarRefreshKey(k => k + 1));
        // Fire-and-forget AI title generation
        const threadIdForTitle = activeThreadId;
        supabase.functions.invoke('generate-thread-title', {
          body: { userMessage: titleText.slice(0, 500), assistantReply: assistantContent.slice(0, 500) },
        }).then(({ data: titleData }) => {
          if (titleData?.title) {
            supabase.from('chat_threads').update({ title: titleData.title } as any).eq('id', threadIdForTitle).then(() => setSidebarRefreshKey(k => k + 1));
          }
        }).catch(() => {}); // fallback title already set
      } else if (activeThreadId) {
        // Update the thread's updated_at timestamp
        await supabase.from('chat_threads').update({ updated_at: new Date().toISOString() } as any).eq('id', activeThreadId);
        setSidebarRefreshKey(k => k + 1);
      }

      // Auto-ingest conversation into RAG (fire-and-forget)
      const allMsgs = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
      ingestChatConversation(session.id, allMsgs.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))).then(() => {
        onDocumentsChanged?.();
      }).catch(() => {});
    } catch (e: any) {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      if (e?.name === 'AbortError') {
        console.log('Chat response aborted by user');
      } else {
        console.error('Knowledge chat error:', e);
        clearPendingAssistantPlaceholder();
        toast.error(e?.message || 'Failed to get response');
      }
    }

    abortControllerRef.current = null;
    setIsStreaming(false);
    setIsThinking(false);
  }, [messages, isStreaming, crawlContext, session.id, attachments, scrollToLastUserMessage, activeThreadId, selectedModel, reasoning, globalMode, attachedSessionIds, searchSources, ragDepth, contextWindowSize, onDocumentsChanged, supportsLiveTools, ensureToolCapableModel]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsThinking(false);
  }, []);

  // ── Deep Research send flow ──
  const handleDeepResearchSend = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { role: 'user', content: text, isDeepResearch: true };
    const assistantPlaceholder: Message = { role: 'assistant', content: '', isDeepResearch: true, deepResearchSteps: [], webCitations: [] };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantPlaceholder]);
    chatInputRef.current?.clear();
    setIsStreaming(true);
    setIsThinking(true);
    scrollToLastUserMessage();

    // Save user message
    saveMessage('user', text);

    try {
      const crawlCtx = globalMode ? '' : buildCrawlContext(session, pages);
      const { loadDefaultDocs } = await import('@/lib/defaultResearchDocs');
      const defaultDocs = await loadDefaultDocs();

      // Auto-retrieve RAG knowledge based on prompt
      const RAG_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-search`;
      let ragDocs: { name: string; content: string }[] = [];
      try {
        const ragRes = await fetch(RAG_SEARCH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            ...(globalMode && attachedSessionIds?.length
              ? { session_ids: [session.id, ...attachedSessionIds] }
              : { session_id: session.id }),
            query: text.slice(0, 2000),
            match_count: ragDepth.match_count,
            match_threshold: ragDepth.match_threshold,
          }),
        });
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          const matches = ragData.matches || [];
          // Group chunks by document
          const grouped: Record<string, string[]> = {};
          for (const chunk of matches) {
            const key = chunk.document_name || 'Unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(chunk.chunk_text);
          }
          ragDocs = Object.entries(grouped).map(([name, texts]) => ({ name, content: texts.join('\n\n') }));
        }
      } catch (e) {
        console.error('RAG fetch for deep research failed:', e);
      }

      // Combine default docs + RAG docs
      const allDocs = [...defaultDocs, ...ragDocs];

      // Fetch screenshots for multimodal input (up to 5)
      let screenshotPayloads: { base64: string; mimeType: string }[] = [];
      if (pages && pages.length > 0) {
        const screenshotUrls = pages
          .filter(p => p.screenshot_url)
          .slice(0, 5)
          .map(p => p.screenshot_url!);
        
        const fetches = screenshotUrls.map(async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            return { base64, mimeType: blob.type || 'image/png' };
          } catch { return null; }
        });
        screenshotPayloads = (await Promise.all(fetches)).filter(Boolean) as { base64: string; mimeType: string }[];
        if (screenshotPayloads.length > 0) {
          console.log(`[deep-research] Sending ${screenshotPayloads.length} screenshots as multimodal input`);
        }
      }

      // Start the deep research interaction
      const startRes = await fetch(DEEP_RESEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'start',
          prompt: text,
          crawlContext: crawlCtx,
          documents: allDocs,
          previousInteractionId: lastDeepResearchIdRef.current || undefined,
          screenshots: screenshotPayloads.length > 0 ? screenshotPayloads : undefined,
        }),
      });

      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        toast.error(errData.error || `Failed to start Deep Research (${startRes.status})`);
        setMessages(newMessages); // remove placeholder
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      const startData = await startRes.json();
      const interactionId = startData.interactionId;
      if (!interactionId) {
        toast.error('No interaction ID returned');
        setMessages(newMessages);
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      deepResearchInteractionRef.current = interactionId;
      const steps: string[] = [];
      const collectedSources: Set<string> = new Set();
      let finalReport = '';

      const updateAssistantWithSources = () => {
        const sourcesArray = Array.from(collectedSources);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content, deepResearchSteps: [...steps], webCitations: sourcesArray, isDeepResearch: true } : m);
          }
          return prev;
        });
      };

      // Try SSE stream first
      const streamRes = await fetch(DEEP_RESEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'stream', interactionId }),
      });

      const isSSE = streamRes.ok && (streamRes.headers.get('content-type') || '').includes('text/event-stream');

      if (isSSE && streamRes.body) {
        // Parse SSE stream for thinking steps, sources, and final report
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sseEventType = '';
        let currentEventId = '';
        const reportParts: string[] = [];

        const updateAssistant = () => {
          const report = reportParts.join('');
          const sourcesArray = Array.from(collectedSources);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: report, deepResearchSteps: [...steps], webCitations: sourcesArray, isDeepResearch: true } : m);
            }
            return prev;
          });
        };

        const processSSELine = (line: string) => {
          // Track event IDs for reconnection
          if (line.startsWith('id: ')) {
            currentEventId = line.slice(4).trim();
            lastEventIdRef.current = currentEventId;
            return;
          }
          if (line.startsWith('event: ')) { sseEventType = line.slice(7).trim(); return; }

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') return;

            try {
              const parsed = JSON.parse(jsonStr);

              // Thinking steps
              if (sseEventType === 'content.delta' || parsed.event_type === 'content.delta') {
                const delta = parsed.delta || parsed;
                const content = delta?.content;

                if (delta?.type === 'thought_summary' && content?.text) {
                  const text = content.text.trim();
                  if (text) {
                    const urlMatches = text.match(/https?:\/\/[^\s)>\]"']+/g);
                    if (urlMatches) {
                      urlMatches.forEach((u: string) => collectedSources.add(u));
                    }

                    const cleanText = text.replace(/^\*\*.*?\*\*\n+/, '').trim();
                    if (cleanText && !steps.includes(cleanText)) {
                      const chunks = cleanText.split(/\n\n+/).filter(Boolean);
                      for (const chunk of chunks) {
                        if (!steps.includes(chunk)) steps.push(chunk);
                      }
                      setIsThinking(false);
                      updateAssistant();
                    }
                  }
                } else if (delta?.type === 'text' || (content?.type === 'text')) {
                  const t = content?.text || delta?.text || '';
                  if (t) reportParts.push(t);
                  updateAssistant();
                }

                // Extract source annotations
                const annotations = delta?.annotations || content?.annotations || parsed.annotations;
                if (annotations && Array.isArray(annotations)) {
                  for (const ann of annotations) {
                    if (ann.source) collectedSources.add(ann.source);
                    if (ann.url) collectedSources.add(ann.url);
                  }
                  updateAssistantWithSources();
                }
              }

              // Completion
              if (sseEventType === 'interaction.complete' || parsed.state === 'completed' || parsed.state === 'COMPLETED') {
                const finalParts = parsed.output?.parts || parsed.candidates?.[0]?.content?.parts || [];
                if (finalParts.length > 0) {
                  const finalText = finalParts.map((p: any) => p.text || '').join('\n');
                  if (finalText) { reportParts.length = 0; reportParts.push(finalText); }
                }
                updateAssistant();
              }

              if (parsed.state === 'failed' || parsed.state === 'FAILED') {
                toast.error('Deep Research task failed');
                setIsStreaming(false);
                setIsThinking(false);
                return;
              }
            } catch { /* partial JSON */ }
            sseEventType = '';
          }
          if (line === '') sseEventType = '';
        };

        // Stream with reconnection support
        let streamComplete = false;
        let reconnectAttempts = 0;
        const MAX_RECONNECTS = 3;

        const readStream = async (rdr: ReadableStreamDefaultReader<Uint8Array>) => {
          while (true) {
            const { done, value } = await rdr.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, idx).replace(/\r$/, '');
              buffer = buffer.slice(idx + 1);
              processSSELine(line);
            }
          }
        };

        try {
          await readStream(reader);
          streamComplete = true;
        } catch (streamErr) {
          console.warn('[deep-research] Stream interrupted, attempting reconnection…', streamErr);
        }

        // Reconnect if stream dropped before completion
        while (!streamComplete && reconnectAttempts < MAX_RECONNECTS && reportParts.join('').length === 0) {
          reconnectAttempts++;
          await new Promise(r => setTimeout(r, 2000 * reconnectAttempts));
          
          try {
            const reconnRes = await fetch(DEEP_RESEARCH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ 
                action: 'stream', 
                interactionId,
                lastEventId: lastEventIdRef.current || undefined,
              }),
            });
            
            const isReconnSSE = reconnRes.ok && (reconnRes.headers.get('content-type') || '').includes('text/event-stream');
            if (isReconnSSE && reconnRes.body) {
              console.log(`[deep-research] Reconnected to stream (attempt ${reconnectAttempts})`);
              steps.push('Reconnected to research stream…');
              updateAssistant();
              await readStream(reconnRes.body.getReader());
              streamComplete = true;
            }
          } catch (reconnErr) {
            console.warn(`[deep-research] Reconnection attempt ${reconnectAttempts} failed`, reconnErr);
          }
        }

        finalReport = reportParts.join('');
      }

      // Fall back to polling if stream didn't produce a report
      if (!finalReport) {
        let attempts = 0;
        while (attempts < 120) {
          attempts++;
          await new Promise(r => setTimeout(r, 5000));
          const pollRes = await fetch(DEEP_RESEARCH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ action: 'poll', interactionId }),
          });

          if (!pollRes.ok) continue;
          const data = await pollRes.json();

          if (data.success === false && data.terminal) {
            toast.error(data.error || 'Research failed');
            break;
          }

          // Extract thinking steps from poll
          const outputs = data.outputs || [];
          for (const output of outputs) {
            if (output.type === 'thought' && output.summary) {
              for (const item of output.summary) {
                const cleanText = (item.text || '').replace(/^\*\*.*?\*\*\n+/, '').trim();
                if (cleanText && !steps.includes(cleanText)) steps.push(cleanText);
                // Extract URLs
                const urlMatches = (item.text || '').match(/https?:\/\/[^\s)>\]"']+/g);
                if (urlMatches) urlMatches.forEach((u: string) => collectedSources.add(u));
              }
            }
          }
          if (data.output?.parts) {
            for (const part of data.output.parts) {
              if (part.thought && part.text) {
                const cleanText = part.text.replace(/^\*\*.*?\*\*\n+/, '').trim();
                if (cleanText && !steps.includes(cleanText)) steps.push(cleanText);
                const urlMatches = part.text.match(/https?:\/\/[^\s)>\]"']+/g);
                if (urlMatches) urlMatches.forEach((u: string) => collectedSources.add(u));
              }
            }
          }

          // Update UI during polling
          const sourcesArray = Array.from(collectedSources);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, deepResearchSteps: [...steps], webCitations: sourcesArray, isDeepResearch: true } : m);
            }
            return prev;
          });

          const state = data.status || data.state || '';
          if (state === 'completed' || state === 'COMPLETED') {
            const parts = data.output?.parts || [];
            finalReport = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('\n');
            break;
          }
          if (state === 'failed' || state === 'FAILED') {
            toast.error('Deep Research task failed');
            break;
          }

          if (attempts % 6 === 0) {
            if (!steps.includes('Still researching…')) steps.push('Still researching…');
            const sourcesArray = Array.from(collectedSources);
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, deepResearchSteps: [...steps], webCitations: sourcesArray, isDeepResearch: true } : m);
              }
              return prev;
            });
          }
        }
      }

      // Finalize
      const finalSources = Array.from(collectedSources);
      const ragDocRefs: RagDocument[] = ragDocs.map(d => ({ name: d.name, source_type: 'rag' }));
      if (finalReport) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: finalReport, deepResearchSteps: [...steps], webCitations: finalSources, ragDocuments: ragDocRefs, isDeepResearch: true } : m);
          }
          return prev;
        });
        toast.success('Deep Research report ready!');
        saveMessage('assistant', finalReport, [], ragDocRefs, finalSources);

        // Also save to deep_research_data for backward compat (skip in global mode)
        if (!globalMode) {
          await supabase
            .from('crawl_sessions')
            .update({ deep_research_data: { report: finalReport, prompt: text, sources: finalSources, updated_at: new Date().toISOString() } as any })
            .eq('id', session.id);
        }

        // Auto-title thread
        if (activeThreadId && newMessages.length === 1) {
          const fallbackTitle = text.slice(0, 28).replace(/\n/g, ' ').trim();
          supabase.from('chat_threads').update({ title: `🔬 ${fallbackTitle}`, updated_at: new Date().toISOString() } as any).eq('id', activeThreadId).then(() => setSidebarRefreshKey(k => k + 1));
          const threadIdForTitle = activeThreadId;
          supabase.functions.invoke('generate-thread-title', {
            body: { userMessage: text.slice(0, 500), assistantReply: (finalReport || '').slice(0, 500) },
          }).then(({ data: titleData }) => {
            if (titleData?.title) {
              supabase.from('chat_threads').update({ title: `🔬 ${titleData.title}` } as any).eq('id', threadIdForTitle).then(() => setSidebarRefreshKey(k => k + 1));
            }
          }).catch(() => {});
        }

        // Auto-ingest
        const allMsgs = [...newMessages, { role: 'assistant' as const, content: finalReport }];
        ingestChatConversation(session.id, allMsgs.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))).then(() => onDocumentsChanged?.()).catch(() => {});
      }
    } catch (e: any) {
      console.error('Deep Research error:', e);
      toast.error(e?.message || 'Deep Research failed');
    }

    // Save interaction ID for follow-up chaining (keep it even after completion)
    if (deepResearchInteractionRef.current) {
      lastDeepResearchIdRef.current = deepResearchInteractionRef.current;
    }
    deepResearchInteractionRef.current = null;
    lastEventIdRef.current = null;
    setIsStreaming(false);
    setIsThinking(false);
  }, [messages, isStreaming, session, pages, activeThreadId, scrollToLastUserMessage, ragDepth, globalMode, attachedSessionIds]);

  // ── Handle pending prompt from Prompts tab — always start a new chat ──
  // Step 1: Create thread, reset messages, queue the prompt
  useEffect(() => {
    if (!pendingPrompt || loadingHistory || isStreaming) return;
    const { text, deepResearch } = pendingPrompt;
    onPendingPromptConsumed?.();

    (async () => {
      const { data: newThread } = await supabase
        .from('chat_threads')
        .insert({ session_id: session.id, title: 'New Chat' } as any)
        .select('id')
        .single();
      if (!newThread) return;

      loadedSessionRef.current = null;
      if (deepResearch) {
        setDeepResearchMode(true);
        if (provider !== 'gemini') onProviderChange('gemini');
      } else {
        setDeepResearchMode(false);
      }
      // Queue the prompt to fire only after the fresh thread has finished loading
      queuedPromptRef.current = { text, deepResearch, threadId: newThread.id };
      setMessages([]);
      setActiveThreadId(newThread.id);
      setSidebarRefreshKey(k => k + 1);
    })();
  }, [pendingPrompt, loadingHistory]);

  // Step 2: Fire the queued prompt once the new thread is active and history has settled
  useEffect(() => {
    if (!queuedPromptRef.current || isStreaming || loadingHistory || messages.length !== 0) return;
    if (activeThreadId !== queuedPromptRef.current.threadId) return;

    const { text, deepResearch } = queuedPromptRef.current;
    queuedPromptRef.current = null;
    if (deepResearch) {
      handleDeepResearchSend(text);
    } else {
      handleSend(text);
    }
  }, [messages, isStreaming, loadingHistory, activeThreadId, handleSend, handleDeepResearchSend]);

  const handleSaveNote = useCallback(async (content: string) => {
    try {
      // Generate a short AI title for the note
      let noteName = `Chat Note – ${new Date().toLocaleString()}`;
      try {
        const titleResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'You are a title generator. Respond with ONLY a 3-5 word title that captures the gist of the following text. No quotes, no punctuation at the end, no explanation.' },
                { role: 'user', content: content.slice(0, 2000) },
              ],
              model: 'google/gemini-2.5-flash-lite',
            }),
          }
        );
        const titleText = await titleResp.text();
        // Parse streaming SSE response
        const lines = titleText.split('\n').filter((l: string) => l.startsWith('data: '));
        let extracted = '';
        for (const line of lines) {
          if (line.trim() === 'data: [DONE]') continue;
          try {
            const json = JSON.parse(line.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) extracted += delta;
          } catch {}
        }
        const cleanTitle = extracted.replace(/["""]/g, '').trim();
        if (cleanTitle.length >= 3 && cleanTitle.length <= 60) {
          noteName = cleanTitle;
        }
      } catch (e) {
        console.warn('Could not generate note title, using default:', e);
      }

      const { data, error } = await supabase.functions.invoke('rag-ingest', {
        body: {
          session_id: session.id,
          documents: [{ name: noteName, content, source_type: 'chat_note' }],
        },
      });
      if (error) throw error;
      toast.success(`Saved: ${noteName}`);
      setSavedNoteContents(prev => new Set(prev).add(content.slice(0, 200)));
      if (onDocumentsChanged) onDocumentsChanged();
    } catch (e: any) {
      console.error('Save note error:', e);
      toast.error('Failed to save note');
    }
  }, [session.id, onDocumentsChanged]);

  const handleToggleFavorite = useCallback(async (content: string) => {
    const isFav = favoriteIds.has(content);
    if (isFav) {
      await supabase.from('knowledge_favorites').delete().eq('session_id', session.id).eq('content', content);
      setFavoriteIds(prev => { const next = new Set(prev); next.delete(content); return next; });
    } else {
      await supabase.from('knowledge_favorites').insert({ session_id: session.id, content } as any);
      setFavoriteIds(prev => new Set(prev).add(content));
    }
  }, [session.id, favoriteIds]);

  const handleEditMessage = useCallback(async (messageIndex: number, newText: string) => {
    if (isStreaming || !activeThreadId) return;
    const truncated = messages.slice(0, messageIndex);
    setMessages(truncated);
    await supabase.from('knowledge_messages').delete().eq('thread_id', activeThreadId);
    for (const m of truncated) {
      await saveMessage(m.role, typeof m.content === 'string' ? m.content : '', m.sources || []);
    }
    handleSend(newText);
  }, [messages, isStreaming, session.id, handleSend, activeThreadId]);

  // New chat handler
  const handleNewThread = useCallback(async () => {
    if (isStreaming) return;
    const { data: newThread } = await supabase
      .from('chat_threads')
      .insert({ session_id: session.id, title: 'New Chat' } as any)
      .select('id')
      .single();
    if (newThread) {
      loadedSessionRef.current = null; // force reload
      setMessages([]);
      setActiveThreadId(newThread.id);
      setSidebarRefreshKey(k => k + 1);
    }
  }, [session.id, isStreaming]);

  // Delete thread handler
  const handleDeleteThread = useCallback(async (threadId: string) => {
    await supabase.from('knowledge_messages').delete().eq('thread_id', threadId);
    await supabase.from('chat_threads').delete().eq('id', threadId);
    if (threadId === activeThreadId) {
      // Switch to another thread
      const { data: remaining } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('session_id', session.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (remaining && remaining.length > 0) {
        loadedSessionRef.current = null;
        setActiveThreadId(remaining[0].id);
      } else {
        // Create a new one
        handleNewThread();
      }
    }
    setSidebarRefreshKey(k => k + 1);
  }, [activeThreadId, session.id, handleNewThread]);

  // Select thread handler
  const handleSelectThread = useCallback((threadId: string) => {
    if (threadId === activeThreadId || isStreaming) return;
    loadedSessionRef.current = null;
    setMessages([]);
    setActiveThreadId(threadId);
  }, [activeThreadId, isStreaming]);

  const outerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrollBtnLeft, setScrollBtnLeft] = useState<number | null>(null);

  // Track whether user has scrolled away from bottom
  useEffect(() => {
    const checkDistance = () => {
      const distanceFromBottom = document.body.scrollHeight - window.scrollY - window.innerHeight;
      const hasAssistantReply = messages.some(m => m.role === 'assistant' && m.content);
      setShowScrollBottom(distanceFromBottom > 200 && hasAssistantReply);
      if (outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect();
        setScrollBtnLeft(rect.left + rect.width / 2);
      }
    };
    checkDistance();
    window.addEventListener('scroll', checkDistance, { passive: true });
    window.addEventListener('resize', checkDistance, { passive: true });
    const observer = new MutationObserver(checkDistance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', checkDistance);
      window.removeEventListener('resize', checkDistance);
      observer.disconnect();
    };
  }, [messages]);


  if (!activeThreadId || loadingHistory) {
    return (
      <div className="flex min-h-[500px]">
        <ChatThreadSidebar
          sessionId={session.id}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
          refreshKey={sidebarRefreshKey}
          onWidthChange={setSidebarWidth}
          stickyTabVisible={stickyTabVisible}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading chat…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[500px]">
      {/* Thread sidebar */}
      <ChatThreadSidebar
        sessionId={session.id}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        refreshKey={sidebarRefreshKey}
        onWidthChange={setSidebarWidth}
        stickyTabVisible={stickyTabVisible}
      />

      {/* Main chat area */}
      <div
        ref={outerRef}
        className="flex-1 flex flex-col items-center"
      >
      {/* Messages area */}
      <div ref={scrollRef} className="space-y-4 px-5 pt-5 w-full max-w-3xl mx-auto">
        {messages.length === 0 && !isThinking ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">
                {globalMode ? 'What can I help you with?' : 'Ask anything about this website'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {globalMode
                ? 'Upload documents, attach site knowledge, or just start a conversation. All your personal settings and preferences are loaded.'
                : 'All your integration data is loaded as context. Ask questions about performance, SEO, security, accessibility, technology, or anything else the audit covers.'}
            </p>
            {/* Attached sites bar in global mode */}
            {globalMode && (
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {attachedSites?.map(s => (
                  <div key={s.session_id} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
                    <Globe className="h-3 w-3" />
                    {s.domain}
                    <button onClick={() => onDetachSite?.(s.session_id)} className="hover:text-destructive ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {globalMode && onSelectSite && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                    <Globe className="h-3 w-3" />
                    Use the <Globe className="h-3 w-3 inline text-muted-foreground" /> button below to attach sites
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {(globalMode ? GLOBAL_SUGGESTED_QUESTIONS : SUGGESTED_QUESTIONS).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-left text-xs p-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <MessageSquare className="h-3 w-3 inline mr-1.5 text-muted-foreground" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                ref={msg.role === 'user' && (i === messages.length - 1 || i === messages.length - 2) ? lastUserMsgRef : undefined}
                style={msg.role === 'user' ? { scrollMarginTop: '24px' } : undefined}
              >
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <UserBubbleWrapper
                      content={typeof msg.content === 'string' ? msg.content : ''}
                      attachmentNames={msg.attachmentNames}
                      onEdit={(newText) => handleEditMessage(i, newText)}
                      disabled={isStreaming}
                    />
                  ) : (
                    <AssistantBubbleInner
                      content={typeof msg.content === 'string' ? msg.content : ''}
                      thinking={msg.thinking}
                      isStreamingThis={isStreaming && i === messages.length - 1}
                      onSaveNote={handleSaveNote}
                      onToggleFavorite={() => handleToggleFavorite(typeof msg.content === 'string' ? msg.content : '')}
                      isFavorited={favoriteIds.has(typeof msg.content === 'string' ? msg.content : '')}
                      isSavedNote={savedNoteContents.has((typeof msg.content === 'string' ? msg.content : '').slice(0, 200))}
                      webCitations={msg.webCitations}
                      isWebSearching={isStreaming && i === messages.length - 1 && searchSources.web && !msg.webCitations?.length}
                      sources={msg.sources}
                      onSourceClick={globalMode ? undefined : (s) => {
                        const target = SOURCE_TAB_MAP[s];
                        if (target) {
                          setSearchParams(prev => { prev.set('tab', target.tab); return prev; }, { replace: true });
                          setTimeout(() => {
                            const el = document.querySelector(`[data-section-id="${target.sectionId}"]`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 150);
                        }
                      }}
                      domain={globalMode ? 'Chat' : session.domain}
                      ragDocuments={msg.ragDocuments}
                      searchLabel={
                        isStreaming && i === messages.length - 1
                          ? (msg.isDeepResearch ? 'Starting Deep Research' : 'Searching + Thinking')
                          : undefined
                      }
                      deepResearchSteps={msg.deepResearchSteps}
                      isDeepResearch={msg.isDeepResearch}
                      councilModels={msg.councilModels}
                    />
                  )}
                </div>
              </div>
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none transition-all duration-300"
              style={{ height: isStreaming ? `max(calc(100vh - ${composerHeight}px - 32px), 240px)` : `${composerHeight + 48}px` }}
            />
          </>
        )}
      </div>

      {/* Scroll to bottom button - centered on thread body */}
      {showScrollBottom && scrollBtnLeft !== null && (
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          className="fixed bottom-[180px] z-40 h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/80 shadow-lg flex items-center justify-center transition-opacity"
          style={{ left: scrollBtnLeft, transform: 'translateX(-50%)' }}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}

      {/* Input area - sticky at bottom */}
      <div
        ref={composerRef}
        className="fixed bottom-0 right-0 z-30 pt-2 bg-gradient-to-t from-background via-background to-transparent"
        style={{ left: `${sidebarWidth}px`, paddingBottom: '18px' }}
      >
      <div
        className={`rounded-[24px] bg-card border-0 shadow-lg py-3 transition-colors w-full max-w-3xl mx-auto ${isDragging ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        style={{ paddingLeft: 30, paddingRight: 30 }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current++;
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current--;
          if (dragCounterRef.current === 0) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current = 0;
          setIsDragging(false);
          if (e.dataTransfer.files?.length && handleFilesRef.current) {
            handleFilesRef.current(e.dataTransfer.files);
          }
        }}
      >
        {/* Drop zone overlay */}
        {isDragging && (
          <div className="flex items-center justify-center gap-2 py-4 text-primary">
            <Upload className="h-5 w-5" />
            <span className="text-sm font-medium">Drop files here</span>
          </div>
        )}
        {/* Attachment & site previews */}
        {(attachments.length > 0 || (globalMode && attachedSites && attachedSites.length > 0)) && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-2">
            {/* Attached sites as pills */}
            {globalMode && attachedSites?.map(s => (
              <Badge
                key={`site-${s.session_id}`}
                variant="secondary"
                className="gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal max-w-[200px] bg-primary/10 text-primary border-primary/20"
              >
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.domain}</span>
                <button onClick={() => onDetachSite?.(s.session_id)} className="ml-0.5 hover:text-destructive shrink-0">
                  <span className="text-xs">×</span>
                </button>
              </Badge>
            ))}
            {/* File attachments */}
            {attachments.map((att, i) => (
              <Badge
                key={`${att.name}-${i}`}
                variant="secondary"
                className="gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal max-w-[200px] relative overflow-hidden"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{att.name}</span>
                {att.parsing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin shrink-0 ml-0.5 text-muted-foreground" />
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-muted-foreground/20">
                      <span className="absolute inset-0 h-full bg-primary animate-[indeterminate_1.5s_ease-in-out_infinite]" />
                    </span>
                  </>
                ) : (
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-destructive shrink-0">
                    <span className="text-xs">×</span>
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Textarea */}
        {/* Textarea - auto-grows up to 4 lines, then scrolls */}
        <ChatInput
          ref={chatInputRef}
          onSubmit={(text) => deepResearchMode ? handleDeepResearchSend(text) : handleSend(text)}
          disabled={isStreaming}
          onChange={(val) => setHasInputText(!!val?.trim())}
        />

        {/* Toolbar row */}
        <div className="flex items-center gap-1 pt-1 pb-1" style={{ marginLeft: -11 }}>
          {/* + Upload button */}
          <ChatFileUpload
            attachments={attachments}
            setAttachments={setAttachments}
            disabled={isStreaming}
            onHandleFilesRef={handleFilesRef}
            sessionId={session.id}
          />

          {/* Add Site button (global mode) */}
          {globalMode && onSelectSite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full border-0 bg-transparent hover:bg-muted hover:text-foreground overflow-visible text-muted-foreground"
                  style={{ width: 44, height: 44 }}
                  disabled={isStreaming}
                  title="Attach a site"
                >
                  <Globe style={{ width: 21, height: 21 }} strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-64 max-h-80 overflow-y-auto">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">Attach a Site</p>
                {availableSites.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-3 text-center">No sites available.</p>
                )}
                {availableSites.map(site => {
                  const alreadyAttached = attachedSites?.some(a => a.session_id === site.id);
                  return (
                    <DropdownMenuItem
                      key={site.id}
                      disabled={alreadyAttached}
                      onClick={() => {
                        if (!alreadyAttached) onSelectSite(site.id, site.domain);
                      }}
                      className="text-xs"
                    >
                      <Globe className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      <span className="truncate">{site.domain}</span>
                      {alreadyAttached && <span className="ml-auto text-muted-foreground text-[10px]">Added</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}


          {/* Sources selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full border-0 bg-transparent hover:bg-muted hover:text-foreground overflow-visible text-muted-foreground"
                style={{ width: 44, height: 44 }}
                disabled={isStreaming}
              >
                <SlidersHorizontal style={{ width: 25, height: 21 }} strokeWidth={1.5} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 rounded-2xl" align="start" side="top" sideOffset={10}>
              <div className="space-y-3">
                {/* Source toggles */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Sources</p>
                  <button
                    className="flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-xl px-2 py-1.5 w-full text-left"
                    onClick={() => setSearchSources(prev => ({ ...prev, documents: !prev.documents }))}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      Documents
                    </span>
                    {searchSources.documents && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                  <button
                    className="flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-xl px-2 py-1.5 w-full text-left"
                    onClick={() => setSearchSources(prev => ({ ...prev, web: !prev.web }))}
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      Web
                    </span>
                    {searchSources.web && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                  {!globalMode && (() => {
                    return (
                      <button
                        className={`flex items-center justify-between gap-2 text-sm rounded-xl px-2 py-1.5 w-full text-left ${supportsLiveTools ? 'cursor-pointer hover:bg-muted/50' : 'opacity-40 cursor-not-allowed'}`}
                        onClick={() => {
                          if (!supportsLiveTools) {
                            ensureToolCapableModel();
                            setSearchSources(prev => ({ ...prev, analytics: true }));
                          } else {
                            setSearchSources(prev => ({ ...prev, analytics: !prev.analytics }));
                          }
                        }}
                        title={!supportsLiveTools ? 'Analytics requires a Gemini or GPT model — click to switch' : undefined}
                      >
                        <span className="flex items-center gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                          Analytics
                          {!supportsLiveTools && <span className="text-[10px] text-muted-foreground">(Gemini/GPT only)</span>}
                        </span>
                        {supportsLiveTools && searchSources.analytics && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                      </button>
                    );
                  })()}
                </div>

                {/* Tools */}
                <div className="space-y-1 border-t pt-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Tools</p>
                  <button
                    className={`flex items-center justify-between gap-2 text-sm rounded-xl px-2 py-1.5 w-full text-left ${supportsLiveTools ? 'cursor-pointer hover:bg-muted/50' : 'opacity-40 cursor-not-allowed'}`}
                    onClick={() => {
                      if (!supportsLiveTools) {
                        ensureToolCapableModel();
                        setSearchSources(prev => ({ ...prev, harvest: true }));
                        return;
                      }
                      setSearchSources(prev => ({ ...prev, harvest: !prev.harvest }));
                    }}
                    title={!supportsLiveTools ? 'Harvest requires a Gemini or GPT model — click to switch' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      Harvest
                      {!supportsLiveTools && <span className="text-[10px] text-muted-foreground">(Gemini/GPT only)</span>}
                    </span>
                    {supportsLiveTools && searchSources.harvest && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                  <button
                    className={`flex items-center justify-between gap-2 text-sm rounded-xl px-2 py-1.5 w-full text-left ${supportsLiveTools ? 'cursor-pointer hover:bg-muted/50' : 'opacity-40 cursor-not-allowed'}`}
                    onClick={() => {
                      if (!supportsLiveTools) {
                        ensureToolCapableModel();
                        setSearchSources(prev => ({ ...prev, asana: true }));
                        return;
                      }
                      setSearchSources(prev => ({ ...prev, asana: !prev.asana }));
                    }}
                    title={!supportsLiveTools ? 'Asana requires a Gemini or GPT model — click to switch' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      Asana
                      {!supportsLiveTools && <span className="text-[10px] text-muted-foreground">(Gemini/GPT only)</span>}
                    </span>
                    {supportsLiveTools && searchSources.asana && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                </div>

                {/* Modes */}
                <div className="space-y-1 border-t pt-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Modes</p>
                  <button
                    className={`flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-xl px-2 py-1.5 w-full text-left ${!deepResearchMode ? 'text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setDeepResearchMode(false)}
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      Chat
                    </span>
                    {!deepResearchMode && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                  <button
                    className={`flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-xl px-2 py-1.5 w-full text-left ${deepResearchMode ? 'text-primary' : 'text-foreground'}`}
                    onClick={() => {
                      setDeepResearchMode(true);
                      if (provider !== 'gemini') onProviderChange('gemini');
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Telescope className="h-3.5 w-3.5 text-muted-foreground" />
                      Deep Research
                    </span>
                    {deepResearchMode && <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                  </button>
                  <button
                    className="flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded-xl px-2 py-1.5 w-full text-left text-foreground"
                    onClick={() => {
                      setDeepResearchMode(false);
                      toast.info('Ask the AI to create a presentation and it will generate a Beautiful.ai deck for you.');
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Presentation className="h-3.5 w-3.5 text-muted-foreground" />
                      Presentation
                    </span>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Provider & Reasoning selectors */}
          <div className="ml-auto flex items-center gap-0.5" style={{ marginRight: -11 }}>
          <ChatProviderPicker
            provider={provider}
            model={selectedModel}
            onProviderChange={onProviderChange}
            disabled={isStreaming}
          />
          <ChatReasoningPicker
            model={selectedModel}
            reasoning={reasoning}
            onReasoningChange={onReasoningChange}
            disabled={isStreaming}
          />

          {/* Send / Stop button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={isStreaming ? handleStop : () => deepResearchMode ? handleDeepResearchSend(chatInputRef.current?.getValue()?.trim() || '') : handleSend()}
              disabled={!isStreaming && (attachments.some(a => a.parsing) || (attachments.length === 0 && !hasInputText))}
              className={`shrink-0 rounded-full border-0 bg-transparent overflow-visible ${isStreaming ? 'hover:bg-destructive/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              style={{ width: 44, height: 44 }}
            >
              {isStreaming ? (
                <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                  <Loader2 style={{ width: 28, height: 28 }} className="animate-spin absolute text-muted-foreground" />
                  <Square className="h-2 w-2 fill-current text-destructive" />
                </div>
              ) : (
                <ArrowUp style={{ width: 28, height: 28 }} strokeWidth={1.5} />
              )}
            </Button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 text-center pt-4 pb-0">AI can make mistakes. No chat data is used to train AI models.</p>
      </div>
      </div>
    </div>
  );
}
