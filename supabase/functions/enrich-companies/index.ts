import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if ([524, 502, 503, 429].includes(response.status) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OCEAN_KEY = Deno.env.get("OCEAN_IO_API_KEY");
    if (!OCEAN_KEY) throw new Error("OCEAN_IO_API_KEY not set");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { companyIds, limit: maxCompanies = 25 } = await req.json().catch(() => ({}));

    // Find companies with domain but no Ocean.io enrichment
    let query = supabase
      .from("companies")
      .select("id, domain, name, enrichment_data")
      .not("domain", "is", null)
      .order("created_at", { ascending: false })
      .limit(maxCompanies);

    if (companyIds?.length) {
      query = supabase
        .from("companies")
        .select("id, domain, name, enrichment_data")
        .in("id", companyIds);
    }

    const { data: companies } = await query;

    // Filter to those without Ocean.io data
    const unenriched = (companies || []).filter(
      (c: any) => c.domain && (!c.enrichment_data?.ocean || !c.enrichment_data?.ocean?.enriched_at)
    );

    if (unenriched.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: "No companies need enrichment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-companies] Enriching ${unenriched.length} companies via Ocean.io`);

    let enriched = 0;
    let skipped = 0;

    for (const company of unenriched) {
      if (!company.domain) { skipped++; continue; }

      try {
        const res = await fetchWithRetry(
          `https://api.ocean.io/v2/enrich/company?apiToken=${encodeURIComponent(OCEAN_KEY)}`,
          {
            method: "POST",
            headers: { "x-api-token": OCEAN_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ company: { domain: company.domain } }),
          }
        );

        if (!res.ok) {
          if (res.status === 429) {
            console.log("[enrich-companies] Rate limited, stopping");
            break;
          }
          skipped++;
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) { skipped++; continue; }

        const data = await res.json();

        // Store the ENTIRE raw response — every field Ocean.io returns
        const updates: any = {
          enrichment_data: {
            ...(typeof company.enrichment_data === 'object' ? company.enrichment_data : {}),
            ocean: {
              ...data,
              enriched_at: new Date().toISOString(),
            },
          },
          updated_at: new Date().toISOString(),
        };

        // Also update top-level fields if they're empty
        const co = data.company || data;
        if (!company.industry && (co.industry || co.sub_industry)) updates.industry = co.industry || co.sub_industry;
        if (co.logo_url || co.logo) updates.logo_url = co.logo_url || co.logo;

        await supabase.from("companies").update(updates).eq("id", company.id);
        enriched++;

        // Rate limit: ~2 req/sec for Ocean.io
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`[enrich-companies] Error for ${company.domain}: ${e.message}`);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, enriched, skipped, total: unenriched.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
