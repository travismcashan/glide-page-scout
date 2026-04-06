import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyMessages, type CompanyMessage } from '@/hooks/useCompanyMessages';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, MessageSquare, ExternalLink, Database } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SlackMessagesCardProps {
  companyName: string;
  companyId: string;
  /** Primary session ID for knowledge ingestion (first site session or sentinel) */
  sessionId?: string;
}

export function SlackMessagesCard({ companyName, companyId, sessionId }: SlackMessagesCardProps) {
  const { data: messages = [], isLoading } = useCompanyMessages(companyId);
  const queryClient = useQueryClient();
  const [searching, setSearching] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingested, setIngested] = useState(false);

  // Manual sync: search Slack and store results locally
  const handleSearch = useCallback(async () => {
    setSearching(true);
    setIngested(false);
    try {
      const { data, error } = await supabase.functions.invoke('slack-search', {
        body: { query: companyName, count: 30 },
      });
      if (error) throw error;
      if (data?.error === 'slack_auth_required') {
        toast.error('Slack is not connected. Go to Connections to set it up.');
        setSearching(false);
        return;
      }
      if (data?.error) throw new Error(data.error);

      const slackMessages = data?.messages || [];
      if (slackMessages.length === 0) {
        toast.info('No Slack messages found for this company.');
        setSearching(false);
        return;
      }

      // Store messages locally in company_messages table
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rows = slackMessages.map((msg: any) => ({
        company_id: companyId,
        channel_name: msg.channel || null,
        message_ts: msg.ts || msg.date || new Date().toISOString(),
        author: msg.username || null,
        text: msg.text || null,
        permalink: msg.permalink || null,
        raw_data: msg,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from('company_messages' as any)
        .upsert(rows as any, { onConflict: 'message_ts,channel_id,user_id' });

      if (insertError) console.error('[voice/slack] Insert error:', insertError);

      // Refresh local data
      queryClient.invalidateQueries({ queryKey: ['company-messages', companyId] });
      toast.success(`Synced ${slackMessages.length} Slack messages`);
    } catch (err) {
      console.error('[voice/slack] Search failed:', err);
      toast.error('Slack search failed. Check your connection in Connections.');
    }
    setSearching(false);
  }, [companyName, companyId, queryClient]);

  const handleIngest = useCallback(async () => {
    if (messages.length === 0) return;
    const targetSession = sessionId;
    if (!targetSession) {
      toast.error('No session available for knowledge ingestion.');
      return;
    }
    setIngesting(true);
    try {
      const content = messages.map((msg: CompanyMessage) => {
        const date = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
        return `[${date}] #${msg.channel_name || 'unknown'} @${msg.author || 'unknown'}: ${msg.text || ''}`;
      }).join('\n\n');

      const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

      const { data: doc } = await supabase
        .from('knowledge_documents')
        .insert({
          session_id: targetSession,
          name: `Slack: ${companyName} messages (${messages.length})`,
          source_type: 'slack',
          source_key: `slack:${companyName}:${new Date().toISOString()}`,
          status: 'pending',
          chunk_count: 0,
          char_count: content.length,
        } as any)
        .select('id')
        .single();

      if (!doc?.id) throw new Error('Failed to create knowledge doc');

      const { data: { session } } = await supabase.auth.getSession();
      await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ documentId: doc.id, content }),
      });

      setIngested(true);
      toast.success(`Ingested ${messages.length} Slack messages into Knowledge Base`);
    } catch (err) {
      console.error('[voice/slack] Ingest failed:', err);
      toast.error('Failed to ingest Slack messages');
    }
    setIngesting(false);
  }, [messages, sessionId, companyName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={handleSearch} disabled={searching} variant="outline" size="sm" className="gap-2">
          {searching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...</> : <><Search className="h-3.5 w-3.5" /> Search Slack</>}
        </Button>
        {messages.length > 0 && !ingested && sessionId && (
          <Button onClick={handleIngest} disabled={ingesting} variant="outline" size="sm" className="gap-2">
            {ingesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ingesting...</> : <><Database className="h-3.5 w-3.5" /> Ingest to Knowledge</>}
          </Button>
        )}
        {ingested && <Badge variant="secondary" className="text-xs bg-green-500/15 text-green-400">Ingested</Badge>}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading messages...</span>
        </div>
      )}

      {!isLoading && messages.length === 0 && !searching && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Search Slack for messages mentioning "{companyName}".
        </p>
      )}

      {messages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {messages.length} messages stored locally
          </p>
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 bg-card hover:border-border transition-colors text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                  <span className="font-medium text-foreground">@{msg.author || 'unknown'}</span>
                  {msg.channel_name && <span>in #{msg.channel_name}</span>}
                  {msg.created_at && <span>{format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}</span>}
                  {msg.permalink && (
                    <a href={msg.permalink} target="_blank" rel="noopener noreferrer" className="hover:text-foreground ml-auto">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
