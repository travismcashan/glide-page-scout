import { useState, useEffect } from 'react';
import { useGmail, type GmailEmail } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, LogIn, LogOut, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  return { name: '', email: raw.trim() };
}

function EmailRow({ email }: { email: GmailEmail }) {
  const [expanded, setExpanded] = useState(false);
  const from = parseEmailAddress(email.from);
  const to = parseEmailAddress(email.to);
  let dateStr = '';
  try {
    dateStr = format(new Date(email.date), 'MMM d, yyyy h:mm a');
  } catch {
    dateStr = email.date;
  }

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
        </div>
      )}
    </div>
  );
}

export function GmailCard({ domain, contactEmails }: { domain: string; contactEmails?: string[] }) {
  const { isConnected, isLoading, emails, error, connect, searchEmails, disconnect } = useGmail();
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = async () => {
    setHasSearched(true);
    await searchEmails({
      contactEmails: contactEmails?.length ? contactEmails : undefined,
      domain: !contactEmails?.length ? domain : undefined,
      maxResults: 50,
    });
  };

  // Auto-search when connected and we have contact emails
  useEffect(() => {
    if (isConnected && !hasSearched && !isLoading && (contactEmails?.length || domain)) {
      doSearch();
    }
  }, [isConnected, hasSearched, contactEmails, domain]);

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
          {emails.length > 0 ? `${emails.length} emails` : hasSearched ? 'No emails found' : 'Searching...'} for <strong>@{domain}</strong>
        </p>
        <div className="flex gap-1">
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
            <EmailRow key={email.id} email={email} />
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
}