import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hubspotFetch(path: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`HubSpot ${path}: ${res.status}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!hubspotToken) throw new Error("HUBSPOT_ACCESS_TOKEN not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Step 1: Fetch lifecycle stages for all HubSpot companies ──
    const hubspotData = new Map<string, string | null>();
    let after: string | undefined;
    let page = 0;

    while (page < 60) {
      const url = `https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=lifecyclestage${after ? `&after=${after}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${hubspotToken}` },
      });
      if (!res.ok) {
        console.error(`HubSpot API error: ${res.status}`);
        break;
      }
      const data = await res.json();

      for (const c of data.results || []) {
        hubspotData.set(c.id, c.properties?.lifecyclestage || null);
      }

      after = data.paging?.next?.after;
      if (!after) break;
      page++;
      if (page % 10 === 0) await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`[hubspot-lifecycle-sync] Fetched ${hubspotData.size} companies from HubSpot`);

    // ── Step 2: Find companies with active deals ──
    // Search for all open deals (not closed-won or closed-lost)
    const companiesWithActiveDeals = new Set<string>();
    let dealAfter: string | undefined;
    let dealPage = 0;

    // Fetch open deals and their company associations
    while (dealPage < 10) {
      const searchBody: any = {
        filterGroups: [
          {
            filters: [
              { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
            ],
          },
        ],
        properties: ["dealname", "dealstage"],
        limit: 100,
      };
      if (dealAfter) searchBody.after = dealAfter;

      const dealRes = await hubspotFetch("/crm/v3/objects/deals/search", hubspotToken, "POST", searchBody);
      const deals = dealRes.results || [];

      if (deals.length > 0) {
        // Batch-fetch company associations for these deals
        for (let i = 0; i < deals.length; i += 20) {
          const batch = deals.slice(i, i + 20).map((d: any) => ({ id: d.id }));
          try {
            const assocRes = await hubspotFetch(
              "/crm/v4/associations/deals/companies/batch/read",
              hubspotToken,
              "POST",
              { inputs: batch }
            );
            for (const r of assocRes.results || []) {
              const compId = r.to?.[0]?.toObjectId;
              if (compId) companiesWithActiveDeals.add(String(compId));
            }
          } catch (e) {
            console.error(`[hubspot-lifecycle-sync] Deal association error: ${e.message}`);
          }
        }
      }

      dealAfter = dealRes.paging?.next?.after;
      if (!dealAfter) break;
      dealPage++;
    }

    console.log(`[hubspot-lifecycle-sync] Found ${companiesWithActiveDeals.size} companies with active deals`);

    // ── Step 3: Batch update companies table ──
    // First reset all has_active_deal to false
    await supabase
      .from("companies")
      .update({ hubspot_has_active_deal: false })
      .not("hubspot_company_id", "is", null);

    let updated = 0;
    const entries = Array.from(hubspotData.entries());

    // Update lifecycle stage + active deal flag together
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      const promises = batch.map(([hsId, stage]) =>
        supabase
          .from("companies")
          .update({
            hubspot_lifecycle_stage: stage,
            hubspot_has_active_deal: companiesWithActiveDeals.has(hsId),
          })
          .eq("hubspot_company_id", hsId)
      );
      const results = await Promise.all(promises);
      updated += results.filter((r) => !r.error).length;
    }

    // Also set active deal for companies that have deals but weren't in the lifecycle fetch
    // (edge case: company exists in our DB with a HubSpot ID but wasn't in the company list API)
    for (const hsId of companiesWithActiveDeals) {
      if (!hubspotData.has(hsId)) {
        await supabase
          .from("companies")
          .update({ hubspot_has_active_deal: true })
          .eq("hubspot_company_id", hsId);
      }
    }

    // ── Step 4: Count distribution ──
    const { data: dist } = await supabase
      .from("companies")
      .select("hubspot_lifecycle_stage, hubspot_has_active_deal")
      .not("hubspot_company_id", "is", null);

    const stages: Record<string, number> = {};
    let withActiveDeal = 0;
    for (const row of dist || []) {
      const s = row.hubspot_lifecycle_stage || "null";
      stages[s] = (stages[s] || 0) + 1;
      if (row.hubspot_has_active_deal) withActiveDeal++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        hubspot_companies_fetched: hubspotData.size,
        companies_with_active_deals: companiesWithActiveDeals.size,
        companies_updated: updated,
        lifecycle_distribution: stages,
        companies_with_active_deal_flag: withActiveDeal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
