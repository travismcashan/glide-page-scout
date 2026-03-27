import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, Loader2, BookOpen, MessageSquare, Sparkles, Plus, FileText, Globe, ChevronDown, ChevronRight, SlidersHorizontal, Copy, Check, Pencil, Brain, BookmarkPlus, Heart, ExternalLink, Search, Upload, Gauge, Download, Square, Telescope } from 'lucide-react';

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
type Message = { role: 'user' | 'assistant'; content: string | any[]; sources?: string[]; attachmentNames?: string[]; thinking?: string; webCitations?: string[]; ragDocuments?: RagDocument[] };

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
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-chat`;

const SUGGESTED_QUESTIONS = [
  "What are the biggest performance issues on this site?",
  "Summarize the SEO findings and opportunities.",
  "What security vulnerabilities were detected?",
  "What technology stack is this site built on?",
  "What are the top accessibility issues?",
  "Give me a high-level executive summary of all findings.",
];

const SOURCE_LABELS: Record<string, string> = {
  semrush: 'SEMrush', psi: 'PageSpeed', crux: 'CrUX', builtwith: 'BuiltWith',
  wappalyzer: 'Wappalyzer', detectzestack: 'DetectZeStack', wave: 'WAVE',
  observatory: 'Observatory', ssllabs: 'SSL Labs', httpstatus: 'HTTP Status',
  linkcheck: 'Link Checker', w3c: 'W3C', schema: 'Schema', readable: 'Readable',
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
  linkcheck: { tab: 'raw-data', sectionId: 'link-checker' },
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
    ['linkcheck', ['link checker', 'broken link']],
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
    <div className="group relative max-w-[85%]">
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        {!disabled && (
          <button
            onClick={startEdit}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Edit prompt"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          title="Copy prompt"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="bg-muted text-secondary-foreground rounded-[24px] rounded-tr-none px-5 py-4 text-base">
        <UserBubbleContent content={content} attachmentNames={attachmentNames} />
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
  return <span className="text-base font-bold">{label}{'.'.repeat(dotCount || 0)}</span>;
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
          <Loader2 className="flex-shrink-0 animate-spin text-muted-foreground" style={{ width: 28, height: 28 }} />
        ) : (
          <Brain className="flex-shrink-0 text-muted-foreground" style={{ width: 28, height: 28 }} />
        )}
        <span className="text-base font-bold">Show Thinking</span>
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

function AssistantBubbleInner({ content, thinking, isStreamingThis, onSaveNote, onToggleFavorite, isFavorited, isSavedNote, webCitations, isWebSearching, sources, onSourceClick, domain, ragDocuments, searchLabel }: { content: string; thinking?: string; isStreamingThis?: boolean; onSaveNote?: (content: string) => void; onToggleFavorite?: () => void; isFavorited?: boolean; isSavedNote?: boolean; webCitations?: string[]; isWebSearching?: boolean; sources?: string[]; onSourceClick?: (s: string) => void; domain?: string; ragDocuments?: RagDocument[]; searchLabel?: string }) {
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
    img: () => null,
  };

  return (
    <div className="group relative w-full pr-10 py-3 pb-6 text-base rounded-lg text-foreground pl-0">
      {isWebSearching && !content && (
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Searching the web…</span>
          <span className="flex gap-0.5 ml-1">
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
      )}
      {thinking && (
        <ThinkingBlock thinking={thinking} isStreaming={isStreamingThis && !content} />
      )}
      <Suspense fallback={<div className="chat-prose max-w-none invisible" aria-hidden>{content}</div>}>
        <div className="chat-prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      </Suspense>
      {isStreamingThis && !content && !thinking && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="flex-shrink-0 animate-spin text-muted-foreground" style={{ width: 28, height: 28 }} />
            <AnimatedThinkingText label={searchLabel || 'Thinking'} />
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

export function KnowledgeChatCard({ session, pages, selectedModel, provider, reasoning, onProviderChange, onModelChange, onReasoningChange, onDocumentsChanged, stickyTabVisible }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasInputText, setHasInputText] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchSources, setSearchSources] = useState<{ documents: boolean; web: boolean }>({ documents: true, web: false });
  const [ragDepth, setRagDepth] = useState<{ match_count: number; match_threshold: number }>({ match_count: 50, match_threshold: 0.15 });
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

  // Thread management
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const threadInitRef = useRef<string | null>(null);

  const crawlContext = buildCrawlContext(session, pages);

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
          setMessages(data.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            sources: m.sources || [],
            ragDocuments: m.rag_documents || undefined,
            webCitations: m.web_citations || undefined,
          })));
        } else {
          setMessages([]);
        }
        setLoadingHistory(false);
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

    if ((!messageText && !hasAttachments) || isStreaming || hasParsing) return;

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
          session_id: session.id,
          model: selectedModel,
          reasoning: reasoning !== 'none' ? reasoning : undefined,
          sources: searchSources,
          rag_depth: ragDepth,
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
            const reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content as string | undefined;
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
            const reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content as string | undefined;
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
        // First message in thread — generate a title
        const titleText = typeof displayContent === 'string' ? displayContent : messageText;
        const shortTitle = titleText.slice(0, 30).replace(/\n/g, ' ').trim();
        await supabase.from('chat_threads').update({ title: shortTitle, updated_at: new Date().toISOString() } as any).eq('id', activeThreadId);
        setSidebarRefreshKey(k => k + 1);
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
  }, [messages, isStreaming, crawlContext, session.id, attachments, scrollToLastUserMessage, activeThreadId]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsThinking(false);
  }, []);

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
              <h3 className="text-lg font-semibold text-foreground">Ask anything about this website</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              All your integration data is loaded as context. Ask questions about performance, SEO, security, accessibility, technology, or anything else the audit covers.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((q, i) => (
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
                      onSourceClick={(s) => {
                        const target = SOURCE_TAB_MAP[s];
                        if (target) {
                          setSearchParams(prev => { prev.set('tab', target.tab); return prev; }, { replace: true });
                          setTimeout(() => {
                            const el = document.querySelector(`[data-section-id="${target.sectionId}"]`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 150);
                        }
                      }}
                      domain={session.domain}
                      ragDocuments={msg.ragDocuments}
                      searchLabel={
                        isStreaming && i === messages.length - 1
                          ? 'Searching + Thinking'
                          : undefined
                      }
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
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-2">
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
          onSubmit={(text) => handleSend(text)}
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
          />

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
                </div>

                {/* RAG Depth */}
                <div className="space-y-2 border-t pt-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    Context
                  </p>
                  <div className="px-1 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted-foreground">How much to read</label>
                        <span className="text-xs font-mono font-medium text-foreground">{ragDepth.match_count}</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={5}
                        value={ragDepth.match_count}
                        onChange={e => setRagDepth(prev => ({ ...prev, match_count: Number(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                        <span>Less <span className="opacity-60">(faster)</span></span>
                        <span>More <span className="opacity-60">(slower)</span></span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted-foreground">How picky to be</label>
                        <span className="text-xs font-mono font-medium text-foreground">{ragDepth.match_threshold.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={0.8}
                        step={0.05}
                        value={ragDepth.match_threshold}
                        onChange={e => setRagDepth(prev => ({ ...prev, match_threshold: Number(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                        <span>Less picky <span className="opacity-60">(broader)</span></span>
                        <span>More picky <span className="opacity-60">(precise)</span></span>
                      </div>
                    </div>
                  </div>
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
              onClick={isStreaming ? handleStop : () => handleSend()}
              disabled={!isStreaming && (attachments.some(a => a.parsing) || (attachments.length === 0 && !hasInputText))}
              className="shrink-0 rounded-full border-0 bg-transparent hover:bg-muted overflow-visible text-muted-foreground hover:text-foreground"
              style={{ width: 44, height: 44 }}
            >
              {isStreaming ? (
                <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                  <Loader2 style={{ width: 28, height: 28 }} className="animate-spin absolute" />
                  <Square className="h-2.5 w-2.5 fill-current" />
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
