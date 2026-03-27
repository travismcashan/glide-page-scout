import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const GMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-lookup`;

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  attachments: GmailAttachment[];
}

export function useGmail() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apiHeaders = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };

  // Check oauth_connections table on mount to see if Gmail is connected
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('oauth_connections')
        .select('id')
        .eq('provider', 'gmail')
        .limit(1);
      setIsConnected(!!data && data.length > 0);
    })();
  }, []);

  const searchEmails = useCallback(async (opts: {
    contactEmails?: string[];
    domain?: string;
    maxResults?: number;
    afterDate?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(GMAIL_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'search',
          ...opts,
        }),
      });

      if (resp.status === 401) {
        setIsConnected(false);
        setError('Gmail is not connected. Go to Connections to set it up.');
        return;
      }

      const data = await resp.json();
      if (data.error) {
        setError(data.message || data.error);
        return;
      }

      setEmails(data.emails || []);
      setIsConnected(true);
    } catch (err: any) {
      console.error('Gmail search error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAttachment = useCallback(async (messageId: string, attachmentId: string): Promise<string | null> => {
    try {
      const resp = await fetch(GMAIL_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'get-attachment',
          messageId,
          attachmentId,
        }),
      });

      if (resp.status === 401) {
        setIsConnected(false);
        return null;
      }

      const data = await resp.json();
      if (data.error) return null;
      return data.data || null;
    } catch (err) {
      console.error('Gmail attachment error:', err);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setEmails([]);
    setError(null);
    setIsConnected(false);
  }, []);

  // connect is now a no-op redirect hint — real auth happens on /connections
  const connect = useCallback(async () => {
    setError('Please connect Gmail from the Connections page.');
    return null;
  }, []);

  return { isConnected, isLoading, emails, error, connect, searchEmails, getAttachment, disconnect };
}
