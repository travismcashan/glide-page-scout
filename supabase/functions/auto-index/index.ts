import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTEGRATION_DOC_NAMES: Record<string, string> = {
  builtwith_data: 'BuiltWith Technology Detection',
  semrush_data: 'SEMrush Domain Analysis',
  psi_data: 'PageSpeed Insights',
  detectzestack_data: 'DetectZeStack Technology Detection',
  gtmetrix_scores: 'GTmetrix Performance',
  carbon_data: 'Website Carbon',
  crux_data: 'Chrome UX Report',
  wave_data: 'WAVE Accessibility',
  observatory_data: 'Mozilla Observatory',
  httpstatus_data: 'HTTP Status',
  w3c_data: 'W3C Validation',
  schema_data: 'Schema.org Validation',
  readable_data: 'Readability Score',
  yellowlab_data: 'Yellow Lab Tools',
  ocean_data: 'Ocean.io Firmographics',
  hubspot_data: 'HubSpot CRM',
  tech_analysis_data: 'AI Tech Analysis',
  content_types_data: 'Content Types',
  forms_data: 'Forms Detection',
  nav_structure: 'Site Navigation',
  observations_data: 'Observations & Insights',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id) return new Response(JSON.stringify({ error: "session_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: session } = await sb.from("crawl_sessions").select("*").eq("id", session_id).single();
    if (!session) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check existing knowledge docs
    const { data: existingDocs } = await sb.from("knowledge_documents").select("source_key").eq("session_id", session_id);
    const existingKeys = new Set(existingDocs?.map(d => d.source_key) ?? []);

    // Build documents from integration data
    const documents: { title: string; content: string; source_type: string; source_key: string }[] = [];
    for (const [col, name] of Object.entries(INTEGRATION_DOC_NAMES)) {
      const data = (session as any)[col];
      if (!data || existingKeys.has(col)) continue;
      documents.push({
        title: name,
        content: JSON.stringify(data, null, 2).slice(0, 50000),
        source_type: 'integration',
        source_key: col,
      });
    }

    if (documents.length === 0) {
      return new Response(JSON.stringify({ indexed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call rag-ingest
    const resp = await fetch(`${supabaseUrl}/functions/v1/rag-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ session_id, documents }),
    });

    const result = await resp.json();
    console.log(`auto-index: indexed ${documents.length} docs for session ${session_id}`);

    return new Response(JSON.stringify({ indexed: documents.length, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("auto-index error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
