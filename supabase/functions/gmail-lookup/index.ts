import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface GmailMessage {
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

async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw { status: res.status, message: errText };
    }
    throw new Error(`Gmail API error [${res.status}]: ${errText.substring(0, 500)}`);
  }
  return res.json();
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  try { return atob(padded); } catch { return ''; }
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function extractBodyAndAttachments(payload: any): { body: string; attachments: GmailAttachment[] } {
  const attachments: GmailAttachment[] = [];

  function collectAttachments(part: any) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      for (const sub of part.parts) collectAttachments(sub);
    }
  }

  function extractText(part: any): { text: string; html: string } {
    if (!part) return { text: '', html: '' };
    let text = '';
    let html = '';
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html = decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const sub of part.parts) {
        const nested = extractText(sub);
        if (!text && nested.text) text = nested.text;
        if (!html && nested.html) html = nested.html;
      }
    }
    return { text, html };
  }

  if (payload) {
    collectAttachments(payload);
  }

  const { text, html } = extractText(payload);
  let body = text;
  if (!body && html) {
    body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!body && payload?.body?.data) {
    body = decodeBase64Url(payload.body.data);
  }

  return { body, attachments };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, contactEmails, domain, maxResults, messageId, attachmentId } = await req.json();

    // Return client ID for OAuth initialization
    if (action === 'get-client-id') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download a specific attachment
    if (action === 'get-attachment') {
      if (!accessToken || !messageId || !attachmentId) {
        return new Response(JSON.stringify({ error: 'accessToken, messageId, and attachmentId are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const att = await gmailFetch(
        `/users/me/messages/${messageId}/attachments/${attachmentId}`,
        accessToken,
      );
      return new Response(JSON.stringify({ success: true, data: att.data, size: att.size }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search emails
    if (action === 'search') {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'accessToken is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const emails: string[] = contactEmails || [];
      const searchDomain: string = domain || '';
      const limit = Math.min(maxResults || 50, 100);

      let query = '';
      if (emails.length > 0) {
        const parts = emails.map((e: string) => `from:${e} OR to:${e}`);
        query = parts.join(' OR ');
      } else if (searchDomain) {
        query = `from:@${searchDomain} OR to:@${searchDomain}`;
      } else {
        return new Response(JSON.stringify({ error: 'contactEmails or domain is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[gmail] Searching: ${query} (limit: ${limit})`);

      const searchRes = await gmailFetch(
        `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
        accessToken,
      );

      const messageIds = (searchRes.messages || []).map((m: any) => m.id);
      console.log(`[gmail] Found ${messageIds.length} messages`);

      if (messageIds.length === 0) {
        return new Response(JSON.stringify({ success: true, emails: [], total: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: GmailMessage[] = [];
      const batchSize = 20;

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const fetched = await Promise.all(
          batch.map(async (id: string) => {
            try {
              const msg = await gmailFetch(`/users/me/messages/${id}?format=full`, accessToken);
              const headers = msg.payload?.headers || [];
              const { body, attachments } = extractBodyAndAttachments(msg.payload);

              return {
                id: msg.id,
                threadId: msg.threadId,
                subject: getHeader(headers, 'Subject'),
                from: getHeader(headers, 'From'),
                to: getHeader(headers, 'To'),
                date: getHeader(headers, 'Date'),
                snippet: msg.snippet || '',
                body: body.substring(0, 5000),
                attachments,
              } as GmailMessage;
            } catch (e) {
              console.error(`[gmail] Error fetching message ${id}: ${e}`);
              return null;
            }
          }),
        );
        results.push(...fetched.filter(Boolean) as GmailMessage[]);
      }

      results.sort((a, b) => {
        const aDate = new Date(a.date).getTime() || 0;
        const bDate = new Date(b.date).getTime() || 0;
        return bDate - aDate;
      });

      return new Response(JSON.stringify({
        success: true,
        emails: results,
        total: searchRes.resultSizeEstimate || results.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[gmail] Error:', error);

    if (error?.status === 401) {
      return new Response(JSON.stringify({
        error: 'gmail_auth_required',
        message: 'Gmail session expired. Please reconnect.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (error?.status === 403) {
      const msg = typeof error.message === 'string' ? error.message : String(error.message);
      const isApiDisabled = msg.includes('SERVICE_DISABLED') || msg.includes('has not been used in project');
      return new Response(JSON.stringify({
        error: isApiDisabled ? 'gmail_api_disabled' : 'gmail_forbidden',
        message: isApiDisabled
          ? 'Gmail API is not enabled in the Google Cloud project. Please enable it in the Google Cloud Console.'
          : 'Access denied by Gmail. Please reconnect with the required permissions.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
