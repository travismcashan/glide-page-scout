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

    const { action, pipeline } = await req.json();

    // ---- Fetch owners with team info (shared by both actions) ----
    const ownersRes = await hubspotFetch("/crm/v3/owners?limit=100", TOKEN);
    const owners: Record<string, string> = {};
    const ownerTeams: Record<string, { name: string; team: string | null; active: boolean }> = {};
    for (const o of ownersRes.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "Unknown";
      const id = String(o.id);
      owners[id] = name;
      const teamName = o.teams?.[0]?.name || null;
      ownerTeams[id] = { name, team: teamName, active: !o.archived };
    }

    if (action === "leads") {
      // ---- LEADS: contacts by lead status ----
      const allContacts: any[] = [];

      for (const status of LEAD_STATUSES.map((s) => s.id)) {
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
          ownerTeams,
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

      // Only fetch OPEN deals (not every deal since the dawn of time)
      const openStageIds = pipelineDef.stages.filter((s) => !s.closed).map((s) => s.id);

      const allDeals: any[] = [];
      let after: string | undefined;
      let page = 0;
      do {
        const body: any = {
          filterGroups: [
            {
              filters: [
                { propertyName: "pipeline", operator: "EQ", value: pipelineId },
                { propertyName: "dealstage", operator: "IN", values: openStageIds },
              ],
            },
          ],
          properties: [
            "dealname", "amount", "dealstage", "pipeline", "closedate",
            "createdate", "hs_lastmodifieddate", "hubspot_owner_id",
            "dealtype", "hs_priority", "deal_source_details",
            "hs_forecast_probability", "notes_last_contacted",
          ],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit: 100,
        };
        if (after) body.after = after;

        const res = await hubspotFetch("/crm/v3/objects/deals/search", TOKEN, "POST", body);
        for (const d of res.results || []) {
          allDeals.push({ id: d.id, ...d.properties });
        }
        after = res.paging?.next?.after;
        page++;
      } while (after && page < 3); // open deals should be well under 300

      // Batch-fetch associated company names for all open deals
      const companyMap: Record<string, string> = {};
      if (allDeals.length > 0) {
        for (let i = 0; i < allDeals.length; i += 20) {
          const batch = allDeals.slice(i, i + 20).map((d) => d.id);
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

            if (companyIds.size > 0) {
              const compRes = await hubspotFetch("/crm/v3/objects/companies/batch/read", TOKEN, "POST", {
                inputs: Array.from(companyIds).map((id) => ({ id })),
                properties: ["name"],
              });
              for (const c of compRes.results || []) {
                companyMap[c.id] = c.properties?.name || "";
              }
            }

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
          ownerTeams,
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
    const raw = e instanceof Error ? e.message : "Unknown error";
    console.error("[hubspot-pipeline] Error:", raw);

    // Translate HubSpot errors into human-readable messages
    let userMsg = raw;
    if (raw.includes("[429]") || raw.includes("TOO_MANY_REQUESTS")) {
      userMsg = "HubSpot rate limit hit (100 requests per 10 seconds). Wait a minute and retry.";
    } else if (raw.includes("[401]")) {
      userMsg = "HubSpot access token is invalid or expired. Re-generate the token in HubSpot > Settings > Integrations > Private Apps.";
    } else if (raw.includes("[403]")) {
      userMsg = "HubSpot API token does not have permission for this resource. Check the private app scopes.";
    } else if (raw.includes("[400]")) {
      userMsg = "Bad request to HubSpot API. " + raw.substring(raw.indexOf(":") + 2, 200);
    }

    return new Response(JSON.stringify({ error: userMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
