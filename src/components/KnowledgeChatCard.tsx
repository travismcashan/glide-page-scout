import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { toast } from 'sonner';
import { Send, Loader2, Trash2, BookOpen, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { buildCrawlContext } from '@/lib/buildCrawlContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatFileUpload, type ChatAttachment } from '@/components/chat/ChatFileUpload';
import { type ReasoningEffort } from '@/components/chat/ChatModelSelector';

type Message = { role: 'user' | 'assistant'; content: string | any[]; sources?: string[]; attachmentNames?: string[] };

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

function countSources(session: SessionData): number {
  const keys = [
    'avoma_data', 'apollo_data', 'ocean_data', 'hubspot_data',
    'semrush_data', 'psi_data', 'crux_data',
    'builtwith_data', 'wappalyzer_data', 'detectzestack_data', 'tech_analysis_data',
    'wave_data', 'observatory_data', 'ssllabs_data',
    'httpstatus_data', 'linkcheck_data', 'w3c_data', 'schema_data',
    'readable_data', 'carbon_data', 'yellowlab_data',
    'nav_structure', 'content_types_data', 'sitemap_data',
    'forms_data', 'page_tags', 'deep_research_data', 'observations_data',
  ];
  return keys.filter(k => !!session[k]).length + (session.gtmetrix_grade ? 1 : 0);
}

export function KnowledgeChatCard({ session, pages, selectedModel, reasoning }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedSessionRef = useRef<string | null>(null);

  const crawlContext = buildCrawlContext(session, pages);
  const sourceCount = countSources(session);
  const contextChars = crawlContext.length;

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
    setAttachments([]);
    setIsStreaming(true);
    setIsThinking(true);

    // Save user message to DB
    saveMessage('user', typeof displayContent === 'string' ? displayContent : messageText);

    let assistantContent = '';

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
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              if (isThinking) setIsThinking(false);
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length === newMessages.length + 1) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
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
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
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
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, sources } : m);
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

  const clearChat = async () => {
    setMessages([]);
    setInput('');
    await supabase.from('knowledge_messages').delete().eq('session_id', session.id);
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading chat history...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Context stats */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-3 px-1">
        <BookOpen className="h-3.5 w-3.5" />
        <span>
          <strong className="text-foreground">{sourceCount}</strong> integration sources loaded
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground">{(contextChars / 1000).toFixed(0)}K</strong> chars of context
        </span>
        {pages && pages.length > 0 && (
          <>
            <span>·</span>
            <span>
              <strong className="text-foreground">{pages.length}</strong> scraped pages
            </span>
          </>
        )}
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground ml-auto"
            onClick={clearChat}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1 pb-3">
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
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <Suspense fallback={<span>{typeof msg.content === 'string' ? msg.content : ''}</span>}>
                        <div className="chat-prose max-w-none">
                          <ReactMarkdown>{typeof msg.content === 'string' ? msg.content : ''}</ReactMarkdown>
                        </div>
                      </Suspense>
                    ) : (
                      <>
                        <span className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : ''}</span>
                        {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {msg.attachmentNames.map((name, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-primary-foreground/20">
                                📎 {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                    )}
                  </div>
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
                <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analyzing your data...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border pt-3 px-1">
        <ChatFileUpload
          attachments={attachments}
          setAttachments={setAttachments}
          disabled={isStreaming}
        />
        <div className="flex gap-1 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? "Add a message about these files..." : "Ask about this website's audit data..."}
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || isStreaming || attachments.some(a => a.parsing)}
            className="shrink-0 h-[44px] w-[44px]"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
