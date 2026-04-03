import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getSlackToken(supabase: any): Promise<string | null> {
  const { data: connections } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('provider', 'slack')
    .order('updated_at', { ascending: false })
    .limit(1);

  return connections?.[0]?.access_token || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, count = 20 } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = await getSlackToken(supabase);
    if (!token) {
      return new Response(JSON.stringify({ error: 'slack_auth_required', message: 'Slack is not connected.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[slack-search] Searching for: "${query}"`);

    // Search messages
    const searchUrl = `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${count}&sort=timestamp&sort_dir=desc`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const searchData = await searchRes.json();

    if (!searchData.ok) {
      console.error('[slack-search] Search failed:', searchData.error);
      return new Response(JSON.stringify({ error: searchData.error || 'Slack search failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const matches = searchData.messages?.matches || [];
    console.log(`[slack-search] Found ${matches.length} messages`);

    // Format results
    const messages = matches.map((msg: any) => ({
      id: msg.ts,
      text: msg.text || '',
      username: msg.username || msg.user || 'Unknown',
      channel: msg.channel?.name || 'unknown',
      channelId: msg.channel?.id || '',
      timestamp: msg.ts,
      permalink: msg.permalink || '',
      date: msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : null,
    }));

    return new Response(JSON.stringify({
      success: true,
      query,
      total: searchData.messages?.total || 0,
      messages,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[slack-search] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
