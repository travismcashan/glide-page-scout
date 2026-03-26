import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
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
  try {
    return atob(padded);
  } catch {
    return '';
  }
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function extractBody(payload: any): string {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — prefer text/plain, fall back to text/html
  if (payload.parts) {
    let textBody = '';
    let htmlBody = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        // Nested multipart
        const nested = extractBody(part);
        if (nested) textBody = textBody || nested;
      }
    }
    if (textBody) return textBody;
    if (htmlBody) {
      // Strip HTML tags for a readable version
      return htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, contactEmails, domain, maxResults } = await req.json();

    // Return client ID for OAuth initialization
    if (action === 'get-client-id') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ clientId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Search emails
    if (action === 'search') {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'accessToken is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build search query from contact emails or domain
      const emails: string[] = contactEmails || [];
      const searchDomain: string = domain || '';
      const limit = Math.min(maxResults || 50, 100);

      let query = '';
      if (emails.length > 0) {
        // Search for emails to/from any of the contact addresses
        const parts = emails.map((e: string) => `from:${e} OR to:${e}`);
        query = parts.join(' OR ');
      } else if (searchDomain) {
        query = `from:@${searchDomain} OR to:@${searchDomain}`;
      } else {
        return new Response(JSON.stringify({ error: 'contactEmails or domain is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[gmail] Searching: ${query} (limit: ${limit})`);

      // Search for message IDs
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

      // Fetch full message details (batch in parallel, up to 20 at a time)
      const results: GmailMessage[] = [];
      const batchSize = 20;

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const fetched = await Promise.all(
          batch.map(async (id: string) => {
            try {
              const msg = await gmailFetch(
                `/users/me/messages/${id}?format=full`,
                accessToken,
              );
              const headers = msg.payload?.headers || [];
              const body = extractBody(msg.payload);

              return {
                id: msg.id,
                threadId: msg.threadId,
                subject: getHeader(headers, 'Subject'),
                from: getHeader(headers, 'From'),
                to: getHeader(headers, 'To'),
                date: getHeader(headers, 'Date'),
                snippet: msg.snippet || '',
                body: body.substring(0, 5000), // Cap body size
              } as GmailMessage;
            } catch (e) {
              console.error(`[gmail] Error fetching message ${id}: ${e}`);
              return null;
            }
          }),
        );
        results.push(...fetched.filter(Boolean) as GmailMessage[]);
      }

      // Sort by date descending
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
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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