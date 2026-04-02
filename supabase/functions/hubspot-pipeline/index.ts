import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hubspotFetch(path: string, token: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.hubapi.com${path}`, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HubSpot API [${res.status}]: ${errText.substring(0, 500)}`);
  }
  return res.json();
}

// ---- Pipeline & stage definitions ----
const PIPELINES: Record<string, { label: string; stages: { id: string; label: string; closed?: boolean }[] }> = {
  "33bc2a42-c57c-4180-b0e6-77b3d6c7f69f": {
    label: "GLIDE Projects Pipeline",
    stages: [
      { id: "753958", label: "Follow-Up / Scheduling" },
      { id: "132302", label: "Discovery Call" },
      { id: "132303", label: "Needs Analysis" },
      { id: "132304", label: "Proposal Due" },
      { id: "132305", label: "Open Deal" },
      { id: "30306367", label: "Closed: In Contract", closed: true },
      { id: "132306", label: "Closed: Won!", closed: true },
      { id: "1ffb1ec7-1fad-4241-bb0e-88d0a85dcdab", label: "Closed: Drip", closed: true },
      { id: "5f36c04a-b283-484c-b50e-032fbeda332d", label: "Closed: Unresponsive", closed: true },
      { id: "3053691", label: "Closed: Unqualified", closed: true },
      { id: "132307", label: "Closed: Lost", closed: true },
    ],
  },
  "29735570": {
    label: "GLIDE Services Pipeline",
    stages: [
      { id: "67943339", label: "Follow-Up / Scheduling" },
      { id: "67943340", label: "First-Time Appointment" },
      { id: "67918443", label: "Eval / Audit / Prep" },
      { id: "67943342", label: "Needs Analysis Scheduled" },
      { id: "67943343", label: "Proposal Due" },
      { id: "67958172", label: "Open Deal" },
      { id: "67958173", label: "Closed: In Contract", closed: true },
      { id: "67943344", label: "Closed: Won!", closed: true },
      { id: "67958174", label: "Closed: Drip", closed: true },
      { id: "67958175", label: "Closed: Unresponsive", closed: true },
      { id: "67958176", label: "Closed: Unqualified", closed: true },
      { id: "67943345", label: "Closed: Lost", closed: true },
    ],
  },
  "758296729": {
    label: "GLIDE RFP Pipeline",
    stages: [
      { id: "1103540129", label: "RFP Identified / Qualification" },
      { id: "1103540130", label: "Intent to Bid" },
      { id: "1103540132", label: "Questions Submitted" },
      { id: "1103540133", label: "Proposal Development" },
      { id: "1103540134", label: "Proposal Submitted" },
      { id: "1269247232", label: "Waiting on Response" },
      { id: "1103540135", label: "Presentation / Finalist" },
      { id: "1103625803", label: "Negotiation & Contracting" },
      { id: "1103625804", label: "Closed: Won", closed: true },
      { id: "1103625805", label: "Closed: Lost", closed: true },
      { id: "1113717867", label: "Closed: Drip", closed: true },
      { id: "1103625806", label: "Closed: Declined", closed: true },
    ],
  },
};

const LEAD_STATUSES = [
  { id: "Inbound", label: "New" },
  { id: "Contacting", label: "Contacted" },
  { id: "Scheduled", label: "Scheduled" },
  { id: "Future Follow-Up", label: "Follow-Up" },
];

const DEFAULT_PIPELINE = "33bc2a42-c57c-4180-b0e6-77b3d6c7f69f";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const { action, pipeline, includeClosedStages } = await req.json();

    // ---- Fetch owners (shared by both actions) ----
    const ownersRes = await hubspotFetch("/crm/v3/owners?limit=100", TOKEN);
    const owners: Record<string, string> = {};
    for (const o of ownersRes.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "Unknown";
      owners[String(o.id)] = name;
    }

    if (action === "leads") {
      // ---- LEADS: contacts by lead status ----
      const statusValues = LEAD_STATUSES.map((s) => s.id);
      const allContacts: any[] = [];

      // Fetch contacts for each lead status
      for (const status of statusValues) {
        let after: string | undefined;
        let page = 0;
        do {
          const body: any = {
            filterGroups: [
              { filters: [{ propertyName: "hs_lead_status", operator: "EQ", value: status }] },
            ],
            properties: [
              "firstname", "lastname", "email", "company", "jobtitle", "phone",
              "lifecyclestage", "hs_lead_status", "hubspot_owner_id",
              "notes_last_updated", "lastmodifieddate", "createdate",
            ],
            sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
            limit: 100,
          };
          if (after) body.after = after;

          const res = await hubspotFetch("/crm/v3/objects/contacts/search", TOKEN, "POST", body);
          for (const c of res.results || []) {
            allContacts.push({ id: c.id, ...c.properties });
          }
          after = res.paging?.next?.after;
          page++;
        } while (after && page < 5); // cap at 500 contacts per status
      }

      return new Response(
        JSON.stringify({
          contacts: allContacts,
          owners,
          statuses: LEAD_STATUSES,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deals") {
      // ---- DEALS: by pipeline stage ----
      const pipelineId = pipeline || DEFAULT_PIPELINE;
      const pipelineDef = PIPELINES[pipelineId];
      if (!pipelineDef) throw new Error(`Unknown pipeline: ${pipelineId}`);

      // Determine which stages to include
      const activeStageIds = pipelineDef.stages
        .filter((s) => includeClosedStages || !s.closed)
        .map((s) => s.id);

      // Fetch deals (paginated)
      const allDeals: any[] = [];
      let after: string | undefined;
      let page = 0;
      do {
        const body: any = {
          filterGroups: [
            {
              filters: [
                { propertyName: "pipeline", operator: "EQ", value: pipelineId },
                { propertyName: "dealstage", operator: "IN", values: activeStageIds },
              ],
            },
          ],
          properties: [
            "dealname", "amount", "dealstage", "pipeline", "closedate",
            "createdate", "hs_lastmodifieddate", "hubspot_owner_id",
          ],
          sorts: [{ propertyName: "closedate", direction: "ASCENDING" }],
          limit: 100,
        };
        if (after) body.after = after;

        const res = await hubspotFetch("/crm/v3/objects/deals/search", TOKEN, "POST", body);
        for (const d of res.results || []) {
          allDeals.push({ id: d.id, ...d.properties });
        }
        after = res.paging?.next?.after;
        page++;
      } while (after && page < 10); // cap at 1000 deals

      // Batch-fetch associated company names
      if (allDeals.length > 0) {
        // Get company associations for all deals
        const dealIds = allDeals.map((d) => d.id);
        const companyMap: Record<string, string> = {};

        // Process in batches of 20 (HubSpot association batch limit)
        for (let i = 0; i < dealIds.length; i += 20) {
          const batch = dealIds.slice(i, i + 20);
          try {
            const assocRes = await hubspotFetch("/crm/v4/associations/deals/companies/batch/read", TOKEN, "POST", {
              inputs: batch.map((id: string) => ({ id })),
            });
            const companyIds = new Set<string>();
            const dealToCompany: Record<string, string> = {};
            for (const r of assocRes.results || []) {
              const compId = r.to?.[0]?.toObjectId;
              if (compId) {
                companyIds.add(String(compId));
                dealToCompany[r.from.id] = String(compId);
              }
            }

            // Batch-read company names
            if (companyIds.size > 0) {
              const compRes = await hubspotFetch("/crm/v3/objects/companies/batch/read", TOKEN, "POST", {
                inputs: Array.from(companyIds).map((id) => ({ id })),
                properties: ["name"],
              });
              for (const c of compRes.results || []) {
                companyMap[c.id] = c.properties?.name || "";
              }
            }

            // Attach company names to deals
            for (const [dealId, compId] of Object.entries(dealToCompany)) {
              const deal = allDeals.find((d) => d.id === dealId);
              if (deal) deal.companyName = companyMap[compId] || "";
            }
          } catch (e) {
            console.error(`[hubspot-pipeline] Association batch error: ${e.message}`);
          }
        }
      }

      return new Response(
        JSON.stringify({
          deals: allDeals,
          owners,
          pipeline: { id: pipelineId, label: pipelineDef.label, stages: pipelineDef.stages },
          pipelines: Object.entries(PIPELINES).map(([id, p]) => ({ id, label: p.label })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "leads" or "deals".' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[hubspot-pipeline] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
