import { extractOrchestration } from "../_shared/orchestration.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';');
  return lines.slice(1).map(line => {
    const values = line.split(';');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { domain } = body;
    const orch = extractOrchestration(body);

    if (orch) await orch.markRunning();

    if (!domain) {
      const msg = 'Domain is required';
      if (orch) await orch.markFailed(msg);
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('SEMRUSH_API_KEY');
    if (!apiKey) {
      const msg = 'SEMrush API key not configured';
      if (orch) await orch.markFailed(msg);
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('SEMrush domain overview for:', domain);

    // 1. Domain Overview (all databases)
    const overviewUrl = `https://api.semrush.com/?key=${apiKey}&type=domain_ranks&export_columns=Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Sh,Sv,As&domain=${encodeURIComponent(domain)}`;
    const overviewRes = await fetch(overviewUrl);
    const overviewText = await overviewRes.text();

    if (overviewText.startsWith('ERROR')) {
      console.error('SEMrush overview error:', overviewText);
      const msg = overviewText;
      if (orch) await orch.markFailed(msg);
      return new Response(JSON.stringify({ success: false, error: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const overviewData = parseCSV(overviewText);

    // 2. Top organic keywords (US database, top 20)
    const organicUrl = `https://api.semrush.com/?key=${apiKey}&type=domain_organic&export_columns=Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Kd&domain=${encodeURIComponent(domain)}&database=us&display_limit=20`;
    const organicRes = await fetch(organicUrl);
    const organicText = await organicRes.text();
    const organicKeywords = organicText.startsWith('ERROR') ? [] : parseCSV(organicText);

    // 3. Backlinks overview
    const backlinksUrl = `https://api.semrush.com/analytics/v1/?key=${apiKey}&type=backlinks_overview&target=${encodeURIComponent(domain)}&target_type=root_domain&export_columns=total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num`;
    const backlinksRes = await fetch(backlinksUrl);
    const backlinksText = await backlinksRes.text();
    const backlinksData = backlinksText.startsWith('ERROR') ? null : parseCSV(backlinksText)[0] || null;

    const saved = { overview: overviewData, organicKeywords, backlinks: backlinksData };

    console.log(`SEMrush: ${overviewData.length} db rows, ${organicKeywords.length} keywords, backlinks: ${!!backlinksData}`);

    if (orch) {
      await orch.markDone(saved);
    }

    return new Response(JSON.stringify({ success: true, ...saved }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('SEMrush error:', error);
    const msg = error instanceof Error ? error.message : 'SEMrush lookup failed';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
