import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getValidAccessToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', 'google-drive')
    .order('updated_at', { ascending: false });

  // Prefer connection with a known email, fall back to most recent
  const conn = connections?.find(c => c.provider_email && c.provider_email !== 'unknown') || connections?.[0];
  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return conn.access_token;
  }

  console.log('[drive-list] Access token expired, refreshing...');
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret || !conn.refresh_token) {
    console.error('[drive-list] Cannot refresh: missing credentials or refresh token');
    return null;
  }

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
  if (!tokenRes.ok) {
    console.error('[drive-list] Token refresh failed:', tokenData);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from('oauth_connections')
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
    })
    .eq('id', conn.id);

  console.log('[drive-list] Token refreshed successfully');
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken: clientToken, folderId = 'root', pageToken, searchQuery } = await req.json();

    // Resolve token: use provided one or fetch from DB
    let accessToken = clientToken;
    if (!accessToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      accessToken = await getValidAccessToken(supabase);
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'drive_auth_required', message: 'Google Drive is not connected.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink)';

    // If searchQuery is provided, search across ALL folders with relevance ranking
    if (searchQuery && searchQuery.trim()) {
      const escaped = searchQuery.trim().replace(/'/g, "\\'");
      console.log(`[drive-list] Searching all Drive for: "${searchQuery.trim()}"`);

      // Single search using fullText (searches names AND content).
      // No orderBy = Google returns in their own relevance ranking,
      // which naturally prioritizes name matches over content-only matches.
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`fullText contains '${escaped}' and trashed = false`)}&fields=${encodeURIComponent(fields)}&pageSize=100`;

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (searchRes.status === 401) {
        return new Response(JSON.stringify({ error: 'token_expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        console.error('Drive search error:', errorText);
        return new Response(JSON.stringify({ error: 'Drive search error' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const searchData = await searchRes.json();
      const files = searchData.files || [];

      console.log(`[drive-list] Google relevance search returned ${files.length} results`);

      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: browse a specific folder
    const query = `'${folderId}' in parents and trashed = false`;
    let driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=${encodeURIComponent('folder,name')}`;
    if (pageToken) {
      driveUrl += `&pageToken=${pageToken}`;
    }

    const driveResponse = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      if (driveResponse.status === 401) {
        console.warn('Drive access token expired or is invalid');
        return new Response(JSON.stringify({ error: 'token_expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      console.error('Drive API error:', errorText);
      return new Response(JSON.stringify({ error: 'Drive API error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const driveData = await driveResponse.json();
    return new Response(JSON.stringify(driveData), {
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
