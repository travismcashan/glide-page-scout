import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCompany } from "../_shared/company-resolution.ts";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hubspotFetch(path: string, token: string, method = "GET", body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.hubapi.com${path}`, opts);
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After")) || 5;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return hubspotFetch(path, token, method, body);
  }
  if (!res.ok) throw new Error(`HubSpot [${res.status}]: ${(await res.text()).substring(0, 300)}`);
  return res.json();
}

// All 3 pipelines with stage definitions
const PIPELINES: Record<string, { label: string; stages: { id: string; label: string; closed?: boolean; outcome?: 'won' | 'lost' | 'archived' }[] }> = {
  "33bc2a42-c57c-4180-b0e6-77b3d6c7f69f": {
    label: "GLIDE Projects Pipeline",
    stages: [
      { id: "753958", label: "Follow-Up / Scheduling" },
      { id: "132302", label: "Discovery Call" },
      { id: "132303", label: "Needs Analysis" },
      { id: "132304", label: "Proposal Due" },
      { id: "132305", label: "Open Deal" },
      { id: "30306367", label: "Closed: In Contract", closed: true, outcome: "won" },
      { id: "132306", label: "Closed: Won!", closed: true, outcome: "won" },
      { id: "1ffb1ec7-1fad-4241-bb0e-88d0a85dcdab", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "5f36c04a-b283-484c-b50e-032fbeda332d", label: "Closed: Unresponsive", closed: true, outcome: "archived" },
      { id: "3053691", label: "Closed: Unqualified", closed: true, outcome: "archived" },
      { id: "132307", label: "Closed: Lost", closed: true, outcome: "lost" },
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
      { id: "67958173", label: "Closed: In Contract", closed: true, outcome: "won" },
      { id: "67943344", label: "Closed: Won!", closed: true, outcome: "won" },
      { id: "67958174", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "67958175", label: "Closed: Unresponsive", closed: true, outcome: "archived" },
      { id: "67958176", label: "Closed: Unqualified", closed: true, outcome: "archived" },
      { id: "67943345", label: "Closed: Lost", closed: true, outcome: "lost" },
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
      { id: "1103625804", label: "Closed: Won", closed: true, outcome: "won" },
      { id: "1103625805", label: "Closed: Lost", closed: true, outcome: "lost" },
      { id: "1113717867", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "1103625806", label: "Closed: Declined", closed: true, outcome: "lost" },
    ],
  },
};

// Build stage label lookup + semantic outcome map
const stageLabelMap: Record<string, string> = {};
const stageOutcomeMap: Record<string, 'won' | 'lost' | 'archived'> = {};
for (const p of Object.values(PIPELINES)) {
  for (const s of p.stages) {
    stageLabelMap[s.id] = s.label;
    if (s.closed && s.outcome) stageOutcomeMap[s.id] = s.outcome;
  }
}

const DEAL_PROPS = [
  "dealname", "amount", "dealstage", "pipeline", "closedate",
  "createdate", "hs_lastmodifieddate", "hubspot_owner_id",
  "dealtype", "hs_priority", "deal_source_details",
  "hs_forecast_probability", "notes_last_contacted",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN not set");
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    // Resolve user_id via shared priority chain (JWT > body > sync_config > fallback)
    const userId = await resolveUserId(supabase, req);

    const syncRun = await startSyncRun(supabase, "hubspot-deals-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // ── Step 1: Fetch ALL deals from ALL pipelines ──
    const allDeals: any[] = [];

    for (const [pipelineId, pipelineDef] of Object.entries(PIPELINES)) {
      let after: string | undefined;
      let page = 0;
      do {
        const body: any = {
          filterGroups: [{
            filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }],
          }],
          properties: DEAL_PROPS,
          sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
          limit: 100,
        };
        if (after) body.after = after;
        const res = await hubspotFetch("/crm/v3/objects/deals/search", TOKEN, "POST", body);
        for (const d of res.results || []) {
          allDeals.push({ id: d.id, ...d.properties, _pipeline: pipelineId });
        }
        after = res.paging?.next?.after;
        page++;
      } while (after && page < 10);
    }

    console.log(`[hubspot-deals-sync] Fetched ${allDeals.length} deals across ${Object.keys(PIPELINES).length} pipelines`);

    // ── Step 2: Batch-fetch company associations ──
    const dealToCompanyHsId: Record<string, string> = {};
    for (let i = 0; i < allDeals.length; i += 20) {
      const batch = allDeals.slice(i, i + 20).map((d) => ({ id: d.id }));
      try {
        const assocRes = await hubspotFetch("/crm/v4/associations/deals/companies/batch/read", TOKEN, "POST", { inputs: batch });
        for (const r of assocRes.results || []) {
          const compId = r.to?.[0]?.toObjectId;
          if (compId) dealToCompanyHsId[r.from.id] = String(compId);
        }
      } catch (e) {
        console.error(`[hubspot-deals-sync] Company association error: ${e.message}`);
      }
    }

    // ── Step 3: Batch-fetch contact associations ──
    const dealToContactHsId: Record<string, string> = {};
    for (let i = 0; i < allDeals.length; i += 20) {
      const batch = allDeals.slice(i, i + 20).map((d) => ({ id: d.id }));
      try {
        const assocRes = await hubspotFetch("/crm/v4/associations/deals/contacts/batch/read", TOKEN, "POST", { inputs: batch });
        for (const r of assocRes.results || []) {
          const contactId = r.to?.[0]?.toObjectId;
          if (contactId) dealToContactHsId[r.from.id] = String(contactId);
        }
      } catch (e) {
        console.error(`[hubspot-deals-sync] Contact association error: ${e.message}`);
      }
    }

    // Batch-read contact details with full properties
    const uniqueContactIds = [...new Set(Object.values(dealToContactHsId))];
    const contactDetails: Record<string, { email: string; name: string; firstname: string; lastname: string; jobtitle: string; phone: string; hubspot_id: string }> = {};
    for (let i = 0; i < uniqueContactIds.length; i += 100) {
      const batch = uniqueContactIds.slice(i, i + 100);
      try {
        const res = await hubspotFetch("/crm/v3/objects/contacts/batch/read", TOKEN, "POST", {
          inputs: batch.map((id) => ({ id })),
          properties: ["email", "firstname", "lastname", "jobtitle", "phone"],
        });
        for (const c of res.results || []) {
          contactDetails[c.id] = {
            email: c.properties?.email || "",
            name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || "",
            firstname: c.properties?.firstname || "",
            lastname: c.properties?.lastname || "",
            jobtitle: c.properties?.jobtitle || "",
            phone: c.properties?.phone || "",
            hubspot_id: c.id,
          };
        }
      } catch (e) {
        console.error(`[hubspot-deals-sync] Contact batch read error: ${e.message}`);
      }
    }

    // ── Step 4: Build company HubSpot ID → local company ID map ──
    const hsCompanyIds = [...new Set(Object.values(dealToCompanyHsId))];
    const companyIdMap: Record<string, string> = {}; // hubspot_company_id → local uuid

    for (let i = 0; i < hsCompanyIds.length; i += 100) {
      const batch = hsCompanyIds.slice(i, i + 100);
      const { data: companies } = await supabase
        .from("companies")
        .select("id, hubspot_company_id")
        .in("hubspot_company_id", batch);
      for (const c of companies || []) {
        if (c.hubspot_company_id) companyIdMap[c.hubspot_company_id] = c.id;
      }
    }

    // Fetch full company details from HubSpot (for deal display + creating missing companies)
    const companyNames: Record<string, string> = {};
    const hsCompanyDetails: Record<string, any> = {};
    for (let i = 0; i < hsCompanyIds.length; i += 100) {
      const batch = hsCompanyIds.slice(i, i + 100);
      try {
        const res = await hubspotFetch("/crm/v3/objects/companies/batch/read", TOKEN, "POST", {
          inputs: batch.map((id) => ({ id })),
          properties: ["name", "domain", "industry", "numberofemployees", "annualrevenue", "city", "state", "country", "website", "lifecyclestage"],
        });
        for (const c of res.results || []) {
          companyNames[c.id] = c.properties?.name || "";
          hsCompanyDetails[c.id] = c.properties;
        }
      } catch (e) {
        console.error(`[hubspot-deals-sync] Company batch error: ${e.message}`);
      }
    }

    // ── Step 4b: Resolve missing companies via shared resolution layer ──
    let companiesCreated = 0;
    let companiesMatched = 0;
    let namesUpgraded = 0;
    const unmatchedHsIds = hsCompanyIds.filter((id) => !companyIdMap[id] && hsCompanyDetails[id]);
    for (const hsId of unmatchedHsIds) {
      const p = hsCompanyDetails[hsId];
      const location = [p.city, p.state, p.country].filter(Boolean).join(", ") || null;
      try {
        const result = await resolveCompany(supabase, {
          user_id: userId,
          hubspot_company_id: hsId,
          name: p.name || null,
          domain: p.domain || null,
          industry: p.industry || null,
          employee_count: p.numberofemployees || null,
          annual_revenue: p.annualrevenue || null,
          location,
          website_url: p.website || null,
          status: "prospect",
        });
        companyIdMap[hsId] = result.companyId;
        if (result.created) companiesCreated++;
        else companiesMatched++;
        if (result.nameUpgraded) namesUpgraded++;
      } catch (e) {
        console.error(`[hubspot-deals-sync] Company resolve error for ${hsId}: ${e.message}`);
      }
    }
    if (unmatchedHsIds.length > 0) {
      console.log(`[hubspot-deals-sync] Resolved ${unmatchedHsIds.length} companies: ${companiesCreated} created, ${companiesMatched} matched existing, ${namesUpgraded} names upgraded`);
    }

    // ── Step 4c: Upsert deal contacts into contacts table ──
    // Every deal contact becomes a real contact record linked to its company
    const contactRows: any[] = [];
    for (const [dealId, hsContactId] of Object.entries(dealToContactHsId)) {
      const contact = contactDetails[hsContactId];
      if (!contact?.email) continue;
      const hsCompanyId = dealToCompanyHsId[dealId];
      const localCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : null;
      if (!localCompanyId) continue;
      // Deduplicate by email — one contact record per email
      if (contactRows.find(r => r.email === contact.email)) continue;
      contactRows.push({
        user_id: userId,
        hubspot_contact_id: contact.hubspot_id,
        company_id: localCompanyId,
        first_name: contact.firstname || null,
        last_name: contact.lastname || null,
        email: contact.email,
        phone: contact.phone || null,
        title: contact.jobtitle || null,
        updated_at: new Date().toISOString(),
      });
    }
    let contactsSynced = 0;
    const hsContactToLocalId: Record<string, string> = {}; // hubspot_contact_id → local UUID
    for (let i = 0; i < contactRows.length; i += 100) {
      const batch = contactRows.slice(i, i + 100);
      for (const row of batch) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("hubspot_contact_id", row.hubspot_contact_id)
          .limit(1);
        if (existing && existing.length > 0) {
          await supabase.from("contacts").update({
            company_id: row.company_id,
            first_name: row.first_name,
            last_name: row.last_name,
            phone: row.phone,
            title: row.title,
            updated_at: row.updated_at,
          }).eq("id", existing[0].id);
          hsContactToLocalId[row.hubspot_contact_id] = existing[0].id;
        } else {
          const { data: inserted } = await supabase.from("contacts").insert(row).select("id").single();
          if (inserted) hsContactToLocalId[row.hubspot_contact_id] = inserted.id;
        }
        contactsSynced++;
      }
    }
    console.log(`[hubspot-deals-sync] Synced ${contactsSynced} deal contacts, mapped ${Object.keys(hsContactToLocalId).length} to local IDs`);

    // Fetch contact photos from local cache
    const allEmails = Object.values(contactDetails).map((c) => c.email).filter(Boolean);
    const photoMap: Record<string, string> = {};
    if (allEmails.length > 0) {
      const { data: photos } = await supabase.from("contact_photos").select("email, photo_url").in("email", allEmails.slice(0, 500));
      for (const p of photos || []) if (p.photo_url) photoMap[p.email] = p.photo_url;
    }

    // ── Step 5: Fetch owners ──
    const ownersRes = await hubspotFetch("/crm/v3/owners?limit=100", TOKEN);
    const ownerNames: Record<string, string> = {};
    for (const o of ownersRes.results || []) {
      ownerNames[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "Unknown";
    }

    // ── Step 6: Upsert deals (no delete-all — preserves FK links) ──
    const fetchedHsDealIds = new Set(allDeals.map((d) => d.id));

    const rows = allDeals.map((deal) => {
      const hsCompanyId = dealToCompanyHsId[deal.id];
      const localCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : null;
      const hsContactId = dealToContactHsId[deal.id];
      const contact = hsContactId ? contactDetails[hsContactId] : null;
      const localContactId = contact?.hubspot_id ? hsContactToLocalId[contact.hubspot_id] : null;
      const stageId = deal.dealstage;

      return {
        user_id: userId,
        hubspot_deal_id: deal.id,
        company_id: localCompanyId || null,
        contact_id: localContactId || null,
        name: deal.dealname || "Untitled Deal",
        amount: deal.amount ? parseFloat(deal.amount) : null,
        stage: stageId || null,
        pipeline: deal._pipeline,
        deal_type: deal.dealtype || null,
        priority: deal.hs_priority || null,
        close_date: deal.closedate || null,
        status: stageOutcomeMap[stageId] || "open",
        hubspot_owner_id: deal.hubspot_owner_id || null,
        properties: {
          createdate: deal.createdate,
          hs_lastmodifieddate: deal.hs_lastmodifieddate,
          hs_forecast_probability: deal.hs_forecast_probability,
          deal_source_details: deal.deal_source_details,
          notes_last_contacted: deal.notes_last_contacted,
          stage_label: stageLabelMap[stageId] || stageId,
          pipeline_label: PIPELINES[deal._pipeline]?.label || deal._pipeline,
          owner_name: deal.hubspot_owner_id ? ownerNames[deal.hubspot_owner_id] || null : null,
        },
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert in chunks of 100 with retry
    let synced = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("deals").upsert(batch, { onConflict: "hubspot_deal_id" });
      if (error) {
        console.warn(`[hubspot-deals-sync] Batch upsert error at offset ${i}, retrying in 2s: ${JSON.stringify(error)}`);
        await new Promise((r) => setTimeout(r, 2000));
        const { error: retryError } = await supabase.from("deals").upsert(batch, { onConflict: "hubspot_deal_id" });
        if (retryError) {
          console.error(`[hubspot-deals-sync] Batch upsert retry failed at offset ${i}: ${JSON.stringify(retryError)}`);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      } else {
        synced += batch.length;
      }
    }

    // Remove stale deals (deleted in HubSpot) — only if ALL upsert batches succeeded
    let staleDeleted = 0;
    if (skipped > 0) {
      console.warn(`[hubspot-deals-sync] Skipping stale deletion — ${skipped} records failed to upsert`);
    } else {
      const { data: localDeals } = await supabase
        .from("deals")
        .select("id, hubspot_deal_id")
        .not("hubspot_deal_id", "is", null);
      const staleIds = (localDeals || [])
        .filter((d: any) => !fetchedHsDealIds.has(d.hubspot_deal_id))
        .map((d: any) => d.id);
      for (let i = 0; i < staleIds.length; i += 100) {
        const batch = staleIds.slice(i, i + 100);
        const { error } = await supabase.from("deals").delete().in("id", batch);
        if (!error) staleDeleted += batch.length;
        else console.error(`[hubspot-deals-sync] Stale delete error: ${JSON.stringify(error)}`);
      }
      if (staleDeleted > 0) console.log(`[hubspot-deals-sync] Removed ${staleDeleted} stale deals`);
    }

    // ── Step 7: Auto-enrich newly created companies (pipeline companies only) ──
    if (companiesCreated > 0) {
      try {
        // Only enrich companies that have open deals (not all 2,700)
        const openDealCompanyIds = [...new Set(
          rows.filter(r => r.status === 'open' && r.company_id).map(r => r.company_id)
        )];
        const newPipelineCompanyIds = openDealCompanyIds.filter(id =>
          Object.values(companyIdMap).includes(id)
        );
        if (newPipelineCompanyIds.length > 0) {
          await supabase.functions.invoke("enrich-companies", {
            body: { companyIds: newPipelineCompanyIds, limit: 25 },
          });
          console.log(`[hubspot-deals-sync] Triggered enrichment for ${newPipelineCompanyIds.length} pipeline companies`);
        }
      } catch (e) {
        console.error(`[hubspot-deals-sync] Enrichment trigger failed: ${e.message}`);
      }
    }

    // ── Step 7c: Auto-crawl new pipeline companies with domains ──
    try {
      const openDealCompanyIds = [...new Set(
        rows.filter(r => r.status === 'open' && r.company_id).map(r => r.company_id)
      )];
      if (openDealCompanyIds.length > 0) {
        // Get domains for pipeline companies
        const { data: pipelineCompanies } = await supabase
          .from("companies")
          .select("id, domain")
          .in("id", openDealCompanyIds)
          .not("domain", "is", null);

        // Check which already have crawls
        const domains = (pipelineCompanies || []).filter(c => c.domain).map(c => c.domain);
        const { data: existingCrawls } = await supabase
          .from("crawl_sessions")
          .select("domain")
          .in("domain", domains);
        const crawledDomains = new Set((existingCrawls || []).map(c => c.domain));

        // Create crawls for uncrawled domains
        let crawlsCreated = 0;
        for (const company of pipelineCompanies || []) {
          if (!company.domain || crawledDomains.has(company.domain)) continue;
          const { data: session } = await supabase
            .from("crawl_sessions")
            .insert({ domain: company.domain, base_url: `https://${company.domain}`, status: "analyzing", company_id: company.id, user_id: userId })
            .select("id")
            .single();
          if (session) {
            supabase.functions.invoke("crawl-start", { body: { session_id: session.id } }).catch(() => {});
            crawlsCreated++;
          }
        }
        if (crawlsCreated > 0) console.log(`[hubspot-deals-sync] Auto-crawled ${crawlsCreated} pipeline company domains`);
      }
    } catch (e) {
      console.error(`[hubspot-deals-sync] Auto-crawl failed: ${e.message}`);
    }

    // ── Step 8: Summary ──
    const { data: counts } = await supabase
      .from("deals")
      .select("status, pipeline")
      .order("pipeline");

    const summary: Record<string, { open: number; won: number; lost: number; archived: number }> = {};
    for (const row of counts || []) {
      const p = PIPELINES[row.pipeline]?.label || row.pipeline;
      if (!summary[p]) summary[p] = { open: 0, won: 0, lost: 0, archived: 0 };
      const s = row.status as keyof typeof summary[string];
      if (s in summary[p]) summary[p][s]++;
      else summary[p].open++;
    }

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: synced,
      recordsDeleted: staleDeleted,
      recordsSkipped: skipped,
      metadata: { deals_fetched: allDeals.length, companies_created: companiesCreated, contacts_synced: contactsSynced },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({
        success: true,
        deals_fetched: allDeals.length,
        deals_synced: synced,
        deals_skipped: skipped,
        companies_matched: Object.keys(companyIdMap).length,
        companies_created: companiesCreated,
        contacts_synced: contactsSynced,
        companies_unmatched: hsCompanyIds.length - Object.keys(companyIdMap).length,
        owners: Object.keys(ownerNames).length,
        pipelines: summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[hubspot-deals-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
