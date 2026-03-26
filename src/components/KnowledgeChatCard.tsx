import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ArrowDown, Loader2, BookOpen, MessageSquare, Sparkles, Plus, FileText, Globe, ChevronDown, ChevronRight, SlidersHorizontal, Copy, Check, Pencil, Brain, BookmarkPlus, Heart, ExternalLink, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatFileUpload, type ChatAttachment } from '@/components/chat/ChatFileUpload';
import { ChatModelSelector, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { AiAvatar } from '@/components/chat/AiAvatar';
import { ingestChatUploads } from '@/lib/ragIngest';
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

type Message = { role: 'user' | 'assistant'; content: string | any[]; sources?: string[]; attachmentNames?: string[]; thinking?: string; webCitations?: string[] };

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
  reasoning: ReasoningEffort;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  onDocumentsChanged?: () => void;
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
      <div className="bg-secondary text-secondary-foreground rounded-lg rounded-tr-none px-4 py-3 text-base">
        <UserBubbleContent content={content} attachmentNames={attachmentNames} />
      </div>
    </div>
  );
}

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Brain className="h-3 w-3" />
        <span>{isStreaming ? 'Thinking…' : 'Thought process'}</span>
        {isStreaming && <span className="flex gap-0.5 ml-1"><span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" /><span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" /><span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" /></span>}

      </button>
      {expanded && (
        <div className="mt-1.5 pl-5 border-l-2 border-primary/20 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
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

function AssistantBubbleInner({ content, thinking, isStreamingThis, onSaveNote, onToggleFavorite, isFavorited, webCitations, isWebSearching, sources, onSourceClick }: { content: string; thinking?: string; isStreamingThis?: boolean; onSaveNote?: (content: string) => void; onToggleFavorite?: () => void; isFavorited?: boolean; webCitations?: string[]; isWebSearching?: boolean; sources?: string[]; onSourceClick?: (s: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const markdownComponents = {
    text: ({ children }: any) => <CitationText citations={webCitations}>{children}</CitationText>,
    img: () => null,
  };

  return (
    <div className="group relative w-full pr-10 py-3 pb-6 text-base rounded-lg text-foreground pl-0">
      <div className="flex items-center gap-2 mb-6">
        <AiAvatar className="h-7 w-7 flex-shrink-0" />
        <span className="text-base font-bold text-foreground leading-none" style={{ transform: 'translateY(2.5px)' }}>Agency Atlas</span>
      </div>
      {(webCitations?.length || isWebSearching) && (
        <WebCitationsBlock citations={webCitations || []} isSearching={isWebSearching} />
      )}
      {thinking && (
        <ThinkingBlock thinking={thinking} isStreaming={isStreamingThis && !content} />
      )}
      <Suspense fallback={<span>{content}</span>}>
        <div className="chat-prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      </Suspense>
      {isStreamingThis && (
        <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
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
                  {copied ? <Check className="h-[18px] w-[18px] text-accent" /> : <Copy className="h-[18px] w-[18px]" />}
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
                  {saved ? <Check className="h-[18px] w-[18px] text-accent" /> : <BookmarkPlus className="h-[18px] w-[18px]" />}
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
                  <Heart className={`h-[18px] w-[18px] transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black text-white text-xs px-2 py-1 border-0">
                {isFavorited ? 'Unfavorite' : 'Favorite'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {sources && sources.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground ml-2">Sources:</span>
              {sources.map(s => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-xs px-2 py-0.5 h-5 font-normal cursor-pointer hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => onSourceClick?.(s)}
                >
                  {SOURCE_LABELS[s] || s}
                </Badge>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function KnowledgeChatCard({ session, pages, selectedModel, reasoning, onModelChange, onReasoningChange, onDocumentsChanged }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchSources, setSearchSources] = useState<{ documents: boolean; web: boolean }>({ documents: true, web: false });
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const wasStreamingRef = useRef(false);
  const handleFilesRef = useRef<((files: FileList) => void) | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const crawlContext = buildCrawlContext(session, pages);

  // Load chat history from DB
  useEffect(() => {
    if (loadedSessionRef.current === session.id) return;
    loadedSessionRef.current = session.id;
    setLoadingHistory(true);
    supabase
      .from('knowledge_messages')
      .select('role, content, sources')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, sources: m.sources || [] })));
        }
        setLoadingHistory(false);
      });
  }, [session.id]);

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

  // Auto-scroll: use native window scroll since we're no longer using internal overflow
  useEffect(() => {
    if (isStreaming && lastUserMsgRef.current) {
      wasStreamingRef.current = true;
      // During streaming, keep the user's prompt pinned near the top of the viewport
      const userMsg = lastUserMsgRef.current;
      const targetY = userMsg.getBoundingClientRect().top + window.scrollY - 8;
      if (Math.abs(window.scrollY - targetY) > 80) {
        window.scrollTo({ top: targetY });
      }
    } else if (!isStreaming) {
      // After streaming ends, don't jump to bottom — user reads from their prompt down
      // Only scroll to bottom on initial history load
      if (!wasStreamingRef.current) {
        window.scrollTo({ top: document.body.scrollHeight });
      }
      wasStreamingRef.current = false;
    }
  }, [messages, isThinking]);

  const saveMessage = async (role: string, content: string, sources: string[] = []) => {
    await supabase.from('knowledge_messages').insert({
      session_id: session.id,
      role,
      content,
      sources,
    } as any);
  };

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
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
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    // Ingest uploaded files into RAG document library (fire-and-forget)
    if (currentAttachments.length > 0) {
      ingestChatUploads(session.id, currentAttachments).then(count => {
        if (count > 0 && onDocumentsChanged) onDocumentsChanged();
      });
    }

    setAttachments([]);
    setIsStreaming(true);
    setIsThinking(true);

    // Save user message to DB
    saveMessage('user', typeof displayContent === 'string' ? displayContent : messageText);

    let assistantContent = '';
    let thinkingContent = '';
    let webCitations: string[] = [];
    const isWebSearch = searchSources.web;

    // If web search is enabled, add a placeholder assistant message with searching indicator
    if (isWebSearch) {
      setMessages(prev => [...prev, { role: 'assistant' as const, content: '', webCitations: [] }]);
    }

    // Build the API messages - use multimodal content for the current message
    const apiMessages = newMessages.map((m, i) => {
      if (i === newMessages.length - 1) {
        return { role: m.role, content: messageContent };
      }
      // For previous messages, just send text
      return { role: m.role, content: typeof m.content === 'string' ? m.content : messageText };
    });

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
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
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      if (!resp.body) {
        toast.error('No response stream');
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

      const updateMessages = () => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const msgData: Message = {
            role: 'assistant',
            content: assistantContent,
            thinking: thinkingContent || undefined,
            webCitations,
          };
          if (last?.role === 'assistant' && prev.length === newMessages.length + 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, ...msgData } : m);
          }
          return [...prev, msgData];
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

            // Handle custom web_citations event
            if (parsed.web_citations) {
              webCitations = parsed.web_citations;
              updateMessages();
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content as string | undefined;
            if (reasoningContent) {
              thinkingContent += reasoningContent;
              updateMessages();
            }
            if (content) {
              // Use accumulator to handle <think> tags that may span chunks
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
        updateMessages();
      }

      // Detect sources and save assistant message
      const sources = detectSources(assistantContent);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, sources, webCitations } : m);
        }
        return prev;
      });
      saveMessage('assistant', assistantContent, sources);
    } catch (e: any) {
      console.error('Knowledge chat error:', e);
      toast.error(e?.message || 'Failed to get response');
    }

    setIsStreaming(false);
    setIsThinking(false);
  }, [input, messages, isStreaming, crawlContext, session.id, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveNote = useCallback(async (content: string) => {
    try {
      const noteName = `Chat Note – ${new Date().toLocaleString()}`;
      const { data, error } = await supabase.functions.invoke('rag-ingest', {
        body: {
          session_id: session.id,
          documents: [{ name: noteName, content, source_type: 'chat_note' }],
        },
      });
      if (error) throw error;
      toast.success('Saved to document library');
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
    if (isStreaming) return;
    // Truncate conversation to just before this message
    const truncated = messages.slice(0, messageIndex);
    setMessages(truncated);
    // Delete old messages from DB and re-save truncated history
    await supabase.from('knowledge_messages').delete().eq('session_id', session.id);
    for (const m of truncated) {
      await saveMessage(m.role, typeof m.content === 'string' ? m.content : '', m.sources || []);
    }
    // Send the edited message as a new message
    handleSend(newText);
  }, [messages, isStreaming, session.id, handleSend]);

  const outerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Track whether user has scrolled away from bottom
  useEffect(() => {
    const handleScroll = () => {
      const distanceFromBottom = document.body.scrollHeight - window.scrollY - window.innerHeight;
      setShowScrollBottom(distanceFromBottom > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom of page when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || isThinking) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading chat history...</span>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      className="flex flex-col items-center pb-40"
    >
      {/* Messages area */}
      <div ref={scrollRef} className="space-y-4 px-5 pb-6 w-full max-w-3xl mx-auto">
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
              <div key={i} ref={msg.role === 'user' && (i === messages.length - 1 || i === messages.length - 2) ? lastUserMsgRef : undefined}>
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
                    />
                  )}
                </div>
              </div>
            ))}
            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <div className="flex items-center gap-1">
                     <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          className="fixed left-1/2 -translate-x-1/2 bottom-[180px] z-40 h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/80 shadow-lg flex items-center justify-center transition-opacity"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}

      {/* Input area - sticky at bottom */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent`}
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
                className="gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal max-w-[200px]"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{att.name}</span>
                {att.parsing ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0 ml-0.5" />
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
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            // Auto-resize textarea
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 160) + 'px';
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up..."
          className="min-h-[44px] max-h-[160px] resize-none text-base leading-relaxed border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0 px-0 bg-transparent overflow-y-auto"
          rows={1}
          disabled={isStreaming}
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
                size="sm"
                className="h-9 px-3 text-sm font-normal gap-1.5 rounded-full border-0 bg-transparent hover:bg-muted"
                disabled={isStreaming}
              >
              <SlidersHorizontal className="h-4.5 w-4.5" />
                Sources
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start" side="top">
              <div className="space-y-1">
                <button
                  className="flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5 w-full text-left"
                  onClick={() => setSearchSources(prev => ({ ...prev, documents: !prev.documents }))}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Documents
                  </span>
                  {searchSources.documents && <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                </button>
                <button
                  className="flex items-center justify-between gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5 w-full text-left"
                  onClick={() => setSearchSources(prev => ({ ...prev, web: !prev.web }))}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Web
                  </span>
                  {searchSources.web && <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Model selector */}
          <div className="ml-auto flex items-center gap-1">
          <ChatModelSelector
            model={selectedModel}
            reasoning={reasoning}
            onModelChange={onModelChange}
            onReasoningChange={onReasoningChange}
            disabled={isStreaming}
          />

          {/* Send button - pushed to the right */}
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming || attachments.some(a => a.parsing)}
              className="shrink-0 h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-7 w-7" />
              )}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
