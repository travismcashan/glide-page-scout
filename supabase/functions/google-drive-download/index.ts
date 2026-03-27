import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXPORT_MIMES: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function getValidAccessToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', 'google-drive')
    .limit(1);

  const conn = connections?.[0];
  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return conn.access_token;
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret || !conn.refresh_token) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return null;

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from('oauth_connections')
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
    })
    .eq('id', conn.id);

  return tokenData.access_token;
}

/** Extract text from structural elements */
function extractText(elements: any[]): string {
  const parts: string[] = [];
  for (const el of elements || []) {
    if (el.paragraph) {
      const line = (el.paragraph.elements || [])
        .map((pe: any) => pe.textRun?.content || '')
        .join('');
      parts.push(line);
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        const cells = (row.tableCells || []).map((cell: any) =>
          extractText(cell.content || []).trim()
        );
        parts.push(cells.join('\t'));
      }
      parts.push('');
    }
  }
  return parts.join('');
}

/** Flatten tabs including nested child tabs */
function flattenTabs(tabs: any[]): { id: string; title: string; body: any }[] {
  const result: { id: string; title: string; body: any }[] = [];
  for (const tab of tabs || []) {
    const id = tab.tabProperties?.tabId || '';
    const title = tab.tabProperties?.title || 'Untitled';
    const body = tab.documentTab?.body;
    if (body?.content) {
      result.push({ id, title, body });
    }
    if (tab.childTabs) {
      result.push(...flattenTabs(tab.childTabs));
    }
  }
  return result;
}

/** Fetch a Google Doc and return its parsed tab structure */
async function fetchGoogleDocTabs(accessToken: string, fileId: string) {
  const url = `https://docs.googleapis.com/v1/documents/${fileId}?includeTabsContent=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Docs API error:', response.status, errText);
    throw new Error(`Docs API failed (${response.status})`);
  }

  const doc = await response.json();

  if (doc.tabs && doc.tabs.length > 0) {
    return flattenTabs(doc.tabs);
  }

  // Fallback: single-tab doc
  if (doc.body?.content) {
    return [{ id: 'default', title: doc.title || 'Document', body: doc.body }];
  }

  return [];
}

async function resolveAccessToken(clientToken: string | undefined) {
  if (clientToken) return clientToken;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  return await getValidAccessToken(supabase);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { accessToken: clientToken, fileId, mimeType, fileName, action, tabIds, multiTab } = body;

    const accessToken = await resolveAccessToken(clientToken);

    if (!accessToken || !fileId) {
      return new Response(JSON.stringify({ error: !accessToken ? 'drive_auth_required' : 'fileId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: !accessToken ? 401 : 400,
      });
    }

    // ── ACTION: list-tabs ──
    // Returns tab metadata for a Google Doc (id + title, no content)
    if (action === 'list-tabs' && mimeType === 'application/vnd.google-apps.document') {
      console.log(`[google-drive-download] Listing tabs for ${fileName}`);
      const tabs = await fetchGoogleDocTabs(accessToken, fileId);
      return new Response(JSON.stringify({
        tabs: tabs.map(t => ({ id: t.id, title: t.title })),
        tabCount: tabs.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: download-tabs ──
    // Downloads specific tabs as separate text results
    if (action === 'download-tabs' && mimeType === 'application/vnd.google-apps.document' && Array.isArray(tabIds)) {
      console.log(`[google-drive-download] Downloading ${tabIds.length} tabs for ${fileName}`);
      const allTabs = await fetchGoogleDocTabs(accessToken, fileId);
      const selectedTabs = tabIds.length > 0
        ? allTabs.filter(t => tabIds.includes(t.id))
        : allTabs;

      const results = selectedTabs.map(tab => ({
        tabId: tab.id,
        tabTitle: tab.title,
        fileName: `${fileName || fileId} — ${tab.title}`,
        mimeType: 'text/plain',
        content: extractText(tab.body.content).replace(/\n{3,}/g, '\n\n').trim(),
        isText: true,
      }));

      return new Response(JSON.stringify({ tabs: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── LEGACY: multiTab=true (import all tabs as single document) ──
    if (multiTab && mimeType === 'application/vnd.google-apps.document') {
      console.log(`[google-drive-download] Multi-tab Docs API export for ${fileName}`);
      try {
        const tabs = await fetchGoogleDocTabs(accessToken, fileId);
        const sections: string[] = [];
        for (const tab of tabs) {
          if (tabs.length > 1) sections.push(`\n=== ${tab.title} ===\n`);
          sections.push(extractText(tab.body.content));
        }
        const content = sections.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        return new Response(JSON.stringify({
          fileName: fileName || fileId,
          mimeType: 'text/plain',
          content,
          isText: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Multi-tab extraction failed, falling back to export:', err);
      }
    }

    // ── Standard download ──
    const isGoogleWorkspaceFile = mimeType?.startsWith('application/vnd.google-apps.');
    let downloadUrl: string;
    let finalMimeType = mimeType;

    if (isGoogleWorkspaceFile) {
      const exportMime = EXPORT_MIMES[mimeType];
      if (!exportMime) {
        return new Response(JSON.stringify({ error: 'Unsupported Google file type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
      finalMimeType = exportMime;
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const downloadResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      if (downloadResponse.status === 401) {
        return new Response(JSON.stringify({ error: 'token_expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      console.error('Download error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const textTypes = ['text/', 'application/json', 'application/xml', 'application/csv'];
    if (textTypes.some(t => finalMimeType?.startsWith(t) || finalMimeType?.includes(t))) {
      const content = await downloadResponse.text();
      return new Response(JSON.stringify({
        fileName: fileName || fileId,
        mimeType: finalMimeType,
        content,
        isText: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileData = await downloadResponse.arrayBuffer();
    if (fileData.byteLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File too large (${Math.round(fileData.byteLength / 1024 / 1024)}MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 413,
      });
    }

    const base64Content = base64Encode(new Uint8Array(fileData));
    return new Response(JSON.stringify({
      fileName: fileName || fileId,
      mimeType: finalMimeType,
      content: base64Content,
      isText: false,
      size: fileData.byteLength,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});