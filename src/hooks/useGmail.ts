import { useState, useCallback } from 'react';

const TOKEN_KEY = 'gmail-access-token';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-lookup`;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

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
  const [isConnected, setIsConnected] = useState<boolean | null>(() => {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch { return false; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }, []);

  const clearToken = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    try {
      const resp = await fetch(GMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'get-client-id' }),
      });
      if (!resp.ok) throw new Error('Could not get Google config');
      const { clientId } = await resp.json();

      await loadScript('https://accounts.google.com/gsi/client');

      const token = await new Promise<string>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GMAIL_SCOPE,
          callback: (r: any) => {
            if (r.error) reject(new Error(r.error));
            else resolve(r.access_token);
          },
        });
        tokenClient.requestAccessToken();
      });

      try { localStorage.setItem(TOKEN_KEY, token); } catch {}
      setIsConnected(true);
      setError(null);
      return token;
    } catch (err: any) {
      console.error('Gmail connect error:', err);
      setError(err.message);
      setIsConnected(false);
      return null;
    }
  }, []);

  const searchEmails = useCallback(async (opts: {
    contactEmails?: string[];
    domain?: string;
    maxResults?: number;
  }) => {
    let token = getToken();
    if (!token) {
      token = await connect();
      if (!token) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(GMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'search',
          accessToken: token,
          ...opts,
        }),
      });

      if (resp.status === 401) {
        clearToken();
        setError('Gmail session expired. Please reconnect.');
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
  }, [getToken, connect, clearToken]);

  const getAttachment = useCallback(async (messageId: string, attachmentId: string): Promise<string | null> => {
    let token = getToken();
    if (!token) {
      token = await connect();
      if (!token) return null;
    }

    try {
      const resp = await fetch(GMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'get-attachment',
          accessToken: token,
          messageId,
          attachmentId,
        }),
      });

      if (resp.status === 401) {
        clearToken();
        return null;
      }

      const data = await resp.json();
      if (data.error) return null;
      return data.data || null; // base64url-encoded data
    } catch (err) {
      console.error('Gmail attachment error:', err);
      return null;
    }
  }, [getToken, connect, clearToken]);

  const disconnect = useCallback(() => {
    clearToken();
    setEmails([]);
    setError(null);
  }, [clearToken]);

  return { isConnected, isLoading, emails, error, connect, searchEmails, getAttachment, disconnect };
}
