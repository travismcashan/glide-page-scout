import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useGmail, type GmailEmail, type GmailAttachment } from '@/hooks/useGmail';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Mail, LogIn, LogOut, RefreshCw, ChevronDown, ChevronUp, Paperclip, Download, Database, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  return { name: '', email: raw.trim() };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function base64UrlToBase64(b64url: string): string {
  return b64url.replace(/-/g, '+').replace(/_/g, '/');
}

function base64UrlToText(b64url: string): string {
  try {
    return atob(base64UrlToBase64(b64url));
  } catch {
    return '';
  }
}

/** Check if a MIME type is text-extractable for ingestion */
function isTextExtractable(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('document') ||
    mimeType.includes('presentation') ||
    mimeType === 'message/rfc822'
  );
}

function AttachmentRow({
  att,
  emailId,
  selected,
  onToggle,
  onDownload,
  downloading,
}: {
  att: GmailAttachment;
  emailId: string;
  selected: boolean;
  onToggle: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const canIngest = isTextExtractable(att.mimeType);

  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-xs">
      {canIngest && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="h-3.5 w-3.5"
        />
      )}
      {!canIngest && <div className="w-3.5" />}
      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{att.filename}</span>
      <span className="text-muted-foreground shrink-0">{formatSize(att.size)}</span>
      <button
        onClick={onDownload}
        disabled={downloading}
        className="text-muted-foreground hover:text-foreground p-0.5"
        title="Download"
      >
        {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      </button>
    </div>
  );
}

function EmailRow({
  email,
  selectedAttachments,
  onToggleAttachment,
  onDownloadAttachment,
  downloadingAttachments,
}: {
  email: GmailEmail;
  selectedAttachments: Set<string>;
  onToggleAttachment: (key: string) => void;
  onDownloadAttachment: (emailId: string, att: GmailAttachment) => void;
  downloadingAttachments: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const from = parseEmailAddress(email.from);
  const to = parseEmailAddress(email.to);
  let dateStr = '';
  try {
    dateStr = format(new Date(email.date), 'MMM d, yyyy h:mm a');
  } catch {
    dateStr = email.date;
  }

  const hasAttachments = email.attachments && email.attachments.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{email.subject || '(no subject)'}</span>
            {hasAttachments && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-4">
                <Paperclip className="h-2.5 w-2.5" />
                {email.attachments.length}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium">{from.name || from.email}</span>
            {' → '}
            <span>{to.name || to.email}</span>
            <span className="ml-2 text-muted-foreground/70">{dateStr}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">{email.snippet}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border">
          <div className="text-xs text-muted-foreground mt-2 mb-1 space-y-0.5">
            <div><strong>From:</strong> {email.from}</div>
            <div><strong>To:</strong> {email.to}</div>
            <div><strong>Date:</strong> {dateStr}</div>
          </div>
          <div className="mt-2 text-sm whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto bg-muted/30 rounded p-2">
            {email.body || email.snippet || '(empty)'}
          </div>

          {hasAttachments && (
            <div className="mt-3 border border-border rounded-md">
              <div className="px-2 py-1.5 bg-muted/30 border-b border-border flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                Attachments ({email.attachments.length})
              </div>
              <div className="py-1">
                {email.attachments.map((att) => {
                  const key = `${email.id}:${att.attachmentId}`;
                  return (
                    <AttachmentRow
                      key={key}
                      att={att}
                      emailId={email.id}
                      selected={selectedAttachments.has(key)}
                      onToggle={() => onToggleAttachment(key)}
                      onDownload={() => onDownloadAttachment(email.id, att)}
                      downloading={downloadingAttachments.has(key)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface GmailCardHandle {
  ingestAllEmails: () => Promise<void>;
  refreshEmails: () => Promise<void>;
}

export interface GmailCardProps {
  domain: string;
  contactEmails?: string[];
  onStateChange?: (state: { canIngest: boolean; isIngesting: boolean; emailCount: number; isRefreshing: boolean }) => void;
  onRefresh?: () => void;
}

export const GmailCard = forwardRef<GmailCardHandle, GmailCardProps>(function GmailCard({ domain, contactEmails, onStateChange }, ref) {
  const { id: sessionId } = useParams<{ id: string }>();
  const { isConnected, isLoading, emails: liveEmails, error, connect, searchEmails, getAttachment, disconnect } = useGmail();
  const [cachedEmails, setCachedEmails] = useState<GmailEmail[]>([]);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
  const [downloadingAttachments, setDownloadingAttachments] = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // The displayed emails: prefer live if we just fetched, otherwise cached from DB
  const emails = liveEmails.length > 0 ? liveEmails : cachedEmails;

  // Load cached emails from DB on mount
  useEffect(() => {
    if (!sessionId || loadedFromDb) return;
    (async () => {
      const { data } = await supabase
        .from('crawl_sessions')
        .select('gmail_data' as any)
        .eq('id', sessionId)
        .single();
      const gmailData = (data as any)?.gmail_data;
      if (gmailData && Array.isArray(gmailData?.emails)) {
        setCachedEmails(gmailData.emails);
        setHasSearched(true);
      }
      setLoadedFromDb(true);
    })();
  }, [sessionId, loadedFromDb]);

  // Save emails to DB whenever live emails update
  useEffect(() => {
    if (!sessionId || liveEmails.length === 0) return;
    setCachedEmails(liveEmails);
    supabase
      .from('crawl_sessions')
      .update({ gmail_data: { emails: liveEmails, updatedAt: new Date().toISOString() } as any })
      .eq('id', sessionId)
      .then(({ error }) => {
        if (error) console.error('Failed to save gmail data:', error);
      });
  }, [sessionId, liveEmails]);

  const doSearch = useCallback(async () => {
    setHasSearched(true);
    setIsRefreshing(true);
    try {
      await searchEmails({
        contactEmails: contactEmails?.length ? contactEmails : undefined,
        domain: !contactEmails?.length ? domain : undefined,
        maxResults: 50,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [searchEmails, contactEmails, domain]);

  // Auto-fetch only if no cached data and connected
  useEffect(() => {
    if (isConnected && !hasSearched && !isLoading && !loadedFromDb) return; // wait for DB load
    if (isConnected && !hasSearched && !isLoading && cachedEmails.length === 0 && (contactEmails?.length || domain)) {
      doSearch();
    }
  }, [isConnected, hasSearched, isLoading, loadedFromDb, cachedEmails.length, contactEmails, domain]);

  const toggleAttachment = (key: string) => {
    setSelectedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDownload = async (emailId: string, att: GmailAttachment) => {
    const key = `${emailId}:${att.attachmentId}`;
    setDownloadingAttachments((prev) => new Set(prev).add(key));
    try {
      const data = await getAttachment(emailId, att.attachmentId);
      if (!data) {
        toast.error('Failed to download attachment');
        return;
      }
      // Convert base64url to standard base64
      const base64 = base64UrlToBase64(data);
      // Use fetch to decode base64 — handles large strings unlike atob
      const resp = await fetch(`data:${att.mimeType};base64,${base64}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${att.filename}`);
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloadingAttachments((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleIngestSelected = async () => {
    if (!sessionId || selectedAttachments.size === 0) return;
    setIngesting(true);

    try {
      const docsToIngest: { name: string; content: string; source_type: string; source_key: string }[] = [];

      for (const key of selectedAttachments) {
        const colonIdx = key.indexOf(':');
        const emailId = key.substring(0, colonIdx);
        const attachmentId = key.substring(colonIdx + 1);
        const email = emails.find((e) => e.id === emailId);
        const att = email?.attachments.find((a) => a.attachmentId === attachmentId);
        if (!email || !att) continue;

        const data = await getAttachment(emailId, attachmentId);
        if (!data) {
          toast.error(`Failed to fetch ${att.filename}`);
          continue;
        }

        // For text types, decode directly. For binary, send base64 for server-side parsing.
        let textContent: string;
        if (att.mimeType.startsWith('text/') || att.mimeType === 'application/json' || att.mimeType === 'application/xml') {
          textContent = base64UrlToText(data);
        } else {
          // For PDFs, Office docs, etc. — send a summary placeholder with the email context
          textContent = `[Attachment from Gmail email]\nSubject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nFilename: ${att.filename}\nType: ${att.mimeType}\nSize: ${formatSize(att.size)}\n\n[Binary attachment — text extraction not available in this version]`;
        }

        if (textContent.length < 20) {
          toast.error(`${att.filename} has no extractable content`);
          continue;
        }

        docsToIngest.push({
          name: `Gmail Attachment: ${att.filename} (from: ${email.subject || 'no subject'})`,
          content: textContent,
          source_type: 'gmail',
          source_key: `gmail:${emailId}:${attachmentId}`,
        });
      }

      if (docsToIngest.length === 0) {
        toast.error('No content could be extracted from selected attachments');
        return;
      }

      const response = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
      });

      if (!response.ok) {
        toast.error('Failed to ingest attachments');
        return;
      }

      const result = await response.json();
      const count = result.results?.filter((r: any) => r.status === 'ready').length || 0;
      toast.success(`Ingested ${count} attachment${count !== 1 ? 's' : ''} into knowledge base`);
      setSelectedAttachments(new Set());
    } catch (err: any) {
      console.error('Ingest error:', err);
      toast.error('Failed to ingest attachments');
    } finally {
      setIngesting(false);
    }
  };

  const handleIngestAllEmails = async () => {
    if (!sessionId || emails.length === 0) return;
    setIngestingAll(true);
    try {
      const docsToIngest = emails.map((email) => {
        const from = parseEmailAddress(email.from);
        const to = parseEmailAddress(email.to);
        const parts: string[] = [];
        parts.push(`Subject: ${email.subject || '(no subject)'}`);
        parts.push(`From: ${email.from}`);
        parts.push(`To: ${email.to}`);
        parts.push(`Date: ${email.date}`);
        if (email.attachments?.length) {
          parts.push(`Attachments: ${email.attachments.map(a => a.filename).join(', ')}`);
        }
        parts.push('');
        parts.push(email.body || email.snippet || '(empty)');

        return {
          name: `Gmail: ${email.subject || '(no subject)'} — ${from.name || from.email} → ${to.name || to.email}`,
          content: parts.join('\n'),
          source_type: 'gmail',
          source_key: `gmail:email:${email.id}`,
        };
      }).filter(d => d.content.length >= 50);

      if (docsToIngest.length === 0) {
        toast.error('No emails with enough content to ingest');
        return;
      }

      const response = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
      });

      if (!response.ok) {
        toast.error('Failed to ingest emails');
        return;
      }

      const result = await response.json();
      const count = result.results?.filter((r: any) => r.status === 'ready').length || 0;
      toast.success(`Ingested ${count} email${count !== 1 ? 's' : ''} into knowledge base`);
    } catch (err: any) {
      console.error('Ingest all emails error:', err);
      toast.error('Failed to ingest emails');
    } finally {
      setIngestingAll(false);
    }
  };

  useImperativeHandle(ref, () => ({
    ingestAllEmails: handleIngestAllEmails,
    refreshEmails: doSearch,
  }), [emails, isConnected, isLoading, ingestingAll, doSearch]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      canIngest: isConnected === true && emails.length > 0 && !isLoading,
      isIngesting: ingestingAll,
      emailCount: emails.length,
      isRefreshing,
    });
  }, [isConnected, emails.length, isLoading, ingestingAll, isRefreshing, onStateChange]);

  // Count total attachments across all emails
  const totalAttachments = emails.reduce((sum, e) => sum + (e.attachments?.length || 0), 0);
  const ingestableCount = selectedAttachments.size;

  if (!isConnected) {
    return (
      <div className="text-center py-6 space-y-3">
        <Mail className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connect your Gmail to pull email threads with <strong>@{domain}</strong> contacts
        </p>
        <Button onClick={connect} size="sm" variant="outline" className="gap-2">
          <LogIn className="h-4 w-4" /> Connect Gmail
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {emails.length > 0
            ? `${emails.length} emails${totalAttachments > 0 ? ` · ${totalAttachments} attachments` : ''}`
            : hasSearched ? 'No emails found' : 'Searching...'
          } for <strong>@{domain}</strong>
        </p>
        <div className="flex gap-1">
          {ingestableCount > 0 && (
            <Button
              onClick={handleIngestSelected}
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              disabled={ingesting}
            >
              {ingesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              Ingest {ingestableCount}
            </Button>
          )}
          <Button onClick={doSearch} size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={disconnect} size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" /> Disconnect
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Searching Gmail...
        </div>
      )}

      {!isLoading && emails.length > 0 && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {emails.map((email) => (
            <EmailRow
              key={email.id}
              email={email}
              selectedAttachments={selectedAttachments}
              onToggleAttachment={toggleAttachment}
              onDownloadAttachment={handleDownload}
              downloadingAttachments={downloadingAttachments}
            />
          ))}
        </div>
      )}

      {!isLoading && hasSearched && emails.length === 0 && !error && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No emails found in your Gmail for @{domain} contacts.
        </p>
      )}
    </div>
  );
});
