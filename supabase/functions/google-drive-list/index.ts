import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, folderId = 'root', pageToken } = await req.json();

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'accessToken is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const query = `'${folderId}' in parents and trashed = false`;
    const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink)';

    let driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=folder,name`;
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