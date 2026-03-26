import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { ArrowUp, Loader2, BookOpen, MessageSquare, Sparkles, Plus, FileText, Globe, ChevronDown, ChevronRight, SlidersHorizontal, Copy, Check, Pencil, Brain, BookmarkPlus, Heart, ExternalLink, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatFileUpload, type ChatAttachment } from '@/components/chat/ChatFileUpload';
import { ChatModelSelector, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
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
      <div className="bg-muted text-foreground rounded-lg rounded-tr-none px-4 py-3 text-[15px]">
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

function AssistantBubbleInner({ content, thinking, isStreamingThis, onSaveNote, onToggleFavorite, isFavorited, webCitations, isWebSearching }: { content: string; thinking?: string; isStreamingThis?: boolean; onSaveNote?: (content: string) => void; onToggleFavorite?: () => void; isFavorited?: boolean; webCitations?: string[]; isWebSearching?: boolean }) {
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

  return (
    <div className="group relative max-w-[85%] px-4 py-3 text-[15px] rounded-lg text-foreground">
      {(webCitations?.length || isWebSearching) && (
        <WebCitationsBlock citations={webCitations || []} isSearching={isWebSearching} />
      )}
      {thinking && (
        <ThinkingBlock thinking={thinking} isStreaming={isStreamingThis && !content} />
      )}
      <Suspense fallback={<span>{content}</span>}>
        <div className="chat-prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </Suspense>
      {isStreamingThis && (
        <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
      )}
      {content && !isStreamingThis && (
        <div className="absolute -right-8 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Copy response"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleSave}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Save as note to document library"
          >
            {saved ? <Check className="h-3.5 w-3.5 text-accent" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onToggleFavorite}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`h-3.5 w-3.5 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

export function KnowledgeChatCard({ session, pages, selectedModel, reasoning, onModelChange, onReasoningChange, onDocumentsChanged }: Props) {
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (isStreaming && lastUserMsgRef.current && scrollRef.current) {
      wasStreamingRef.current = true;
      // During streaming, keep the user's prompt pinned near the top of the viewport
      const container = scrollRef.current;
      const userMsg = lastUserMsgRef.current;
      const offset = userMsg.offsetTop - container.offsetTop - 8;
      // Only snap if we haven't manually scrolled away
      if (Math.abs(container.scrollTop - offset) > 80) {
        container.scrollTop = offset;
      }
    } else if (!isStreaming && scrollRef.current) {
      // After streaming ends, don't jump to bottom — user reads from their prompt down
      // Only scroll to bottom on initial history load
      if (!wasStreamingRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, webCitations } : m);
                }
                return prev;
              });
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content as string | undefined;
            if (reasoningContent) {
              thinkingContent += reasoningContent;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length === newMessages.length + 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, thinking: thinkingContent, webCitations } : m);
                }
                return [...prev, { role: 'assistant', content: '', thinking: thinkingContent, webCitations }];
              });
            }
            if (content) {
              if (isThinking) setIsThinking(false);
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length === newMessages.length + 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent, webCitations } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent, webCitations }];
              });
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
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent, thinking: thinkingContent || undefined } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent, thinking: thinkingContent || undefined }];
              });
            }
          } catch { /* ignore */ }
        }
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

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading chat history...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] items-center">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1 pb-3 w-full max-w-2xl mx-auto">
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
                    <AssistantBubbleInner content={typeof msg.content === 'string' ? msg.content : ''} thinking={msg.thinking} isStreamingThis={isStreaming && i === messages.length - 1} onSaveNote={handleSaveNote} onToggleFavorite={() => handleToggleFavorite(typeof msg.content === 'string' ? msg.content : '')} isFavorited={favoriteIds.has(typeof msg.content === 'string' ? msg.content : '')} webCitations={msg.webCitations} isWebSearching={isStreaming && i === messages.length - 1 && searchSources.web && !msg.webCitations?.length} />
                  )}
                </div>
                {/* Source badges for assistant messages */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && !(isStreaming && i === messages.length - 1) && (
                  <div className="flex items-center gap-1.5 mt-1.5 ml-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">Sources:</span>
                    {msg.sources.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {SOURCE_LABELS[s] || s}
                      </Badge>
                    ))}
                  </div>
                )}
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

      {/* Input area */}
      <div
        className={`mb-2 mt-3 rounded-2xl bg-card border-2 shadow-lg px-4 py-3 transition-colors w-full max-w-2xl mx-auto ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}`}
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
        <div className="flex items-center gap-1 pt-1 pb-1">
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
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-normal gap-1.5 rounded-full"
                disabled={isStreaming}
              >
              <SlidersHorizontal className="h-3.5 w-3.5" />
                Sources
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start" side="top">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5">
                  <Checkbox
                    checked={searchSources.documents}
                    onCheckedChange={(checked) =>
                      setSearchSources(prev => ({ ...prev, documents: !!checked }))
                    }
                  />
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Documents
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-2 py-1.5">
                  <Checkbox
                    checked={searchSources.web}
                    onCheckedChange={(checked) =>
                      setSearchSources(prev => ({ ...prev, web: !!checked }))
                    }
                  />
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Web
                </label>
              </div>
            </PopoverContent>
          </Popover>

          {/* Model selector */}
          <ChatModelSelector
            model={selectedModel}
            reasoning={reasoning}
            onModelChange={onModelChange}
            onReasoningChange={onReasoningChange}
            disabled={isStreaming}
          />

          {/* Send button - pushed to the right */}
          <div className="ml-auto">
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming || attachments.some(a => a.parsing)}
              className="shrink-0 h-8 w-8 rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
