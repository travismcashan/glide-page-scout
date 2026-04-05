import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCompany } from "../_shared/company-resolution.ts";

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

const LEAD_STATUSES = ["Inbound", "Contacting", "Scheduled", "Future Follow-Up"];

const CONTACT_PROPS = [
  "firstname", "lastname", "email", "company", "jobtitle", "phone",
  "lifecyclestage", "hs_lead_status", "hubspot_owner_id",
  "notes_last_updated", "lastmodifieddate", "createdate",
  "hs_email_last_send_date",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN not set");
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    const { data: firstCompany } = await supabase.from("companies").select("user_id").limit(1).single();
    if (!firstCompany) throw new Error("No companies found");
    const userId = firstCompany.user_id;

    // ── Step 1: Fetch all contacts with lead status from HubSpot ──
    const allContacts: any[] = [];

    for (const status of LEAD_STATUSES) {
      let after: string | undefined;
      let page = 0;
      do {
        const body: any = {
          filterGroups: [{
            filters: [{ propertyName: "hs_lead_status", operator: "EQ", value: status }],
          }],
          properties: CONTACT_PROPS,
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
      } while (after && page < 5);
    }

    console.log(`[hubspot-contacts-sync] Fetched ${allContacts.length} contacts with lead status`);

    // ── Step 2: Batch-fetch company associations ──
    const contactToCompanyHsId: Record<string, string> = {};
    for (let i = 0; i < allContacts.length; i += 20) {
      const batch = allContacts.slice(i, i + 20).map((c) => ({ id: c.id }));
      try {
        const assocRes = await hubspotFetch("/crm/v4/associations/contacts/companies/batch/read", TOKEN, "POST", { inputs: batch });
        for (const r of assocRes.results || []) {
          const compId = r.to?.[0]?.toObjectId;
          if (compId) contactToCompanyHsId[r.from.id] = String(compId);
        }
      } catch (e) {
        console.error(`[hubspot-contacts-sync] Company association error: ${e.message}`);
      }
    }

    // ── Step 3: Map HubSpot company IDs to local company IDs ──
    const hsCompanyIds = [...new Set(Object.values(contactToCompanyHsId))];
    const companyIdMap: Record<string, string> = {};
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

    // ── Step 3b: Resolve missing companies via shared resolution layer ──
    let companiesCreated = 0;
    let companiesMatched = 0;
    let namesUpgraded = 0;
    const unmatchedHsIds = hsCompanyIds.filter((id) => !companyIdMap[id]);
    if (unmatchedHsIds.length > 0) {
      // Fetch company details from HubSpot
      const hsCompanyDetails: Record<string, any> = {};
      for (let i = 0; i < unmatchedHsIds.length; i += 100) {
        const batch = unmatchedHsIds.slice(i, i + 100);
        try {
          const res = await hubspotFetch("/crm/v3/objects/companies/batch/read", TOKEN, "POST", {
            inputs: batch.map((id) => ({ id })),
            properties: ["name", "domain", "industry", "numberofemployees", "city", "state", "country", "website", "lifecyclestage"],
          });
          for (const c of res.results || []) hsCompanyDetails[c.id] = c.properties;
        } catch (e) {
          console.error(`[hubspot-contacts-sync] Company fetch error: ${e.message}`);
        }
      }

      for (const hsId of unmatchedHsIds) {
        const p = hsCompanyDetails[hsId];
        if (!p) continue;
        const location = [p.city, p.state, p.country].filter(Boolean).join(", ") || null;
        try {
          const result = await resolveCompany(supabase, {
            user_id: userId,
            hubspot_company_id: hsId,
            name: p.name || null,
            domain: p.domain || null,
            industry: p.industry || null,
            employee_count: p.numberofemployees || null,
            location,
            website_url: p.website || null,
            status: "prospect",
          });
          companyIdMap[hsId] = result.companyId;
          if (result.created) companiesCreated++;
          else companiesMatched++;
          if (result.nameUpgraded) namesUpgraded++;
        } catch (e) {
          console.error(`[hubspot-contacts-sync] Company resolve error for ${hsId}: ${e.message}`);
        }
      }
      console.log(`[hubspot-contacts-sync] Resolved ${unmatchedHsIds.length} companies: ${companiesCreated} created, ${companiesMatched} matched existing, ${namesUpgraded} names upgraded`);
    }

    // ── Step 4: Fetch owners ──
    const ownersRes = await hubspotFetch("/crm/v3/owners?limit=100", TOKEN);
    const ownerNames: Record<string, string> = {};
    for (const o of ownersRes.results || []) {
      ownerNames[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "Unknown";
    }

    // ── Step 5: Fetch existing contact photos ──
    const emails = allContacts.map((c) => c.email).filter(Boolean);
    const photoMap: Record<string, string> = {};
    if (emails.length > 0) {
      const { data: photos } = await supabase.from("contact_photos").select("email, photo_url").in("email", emails.slice(0, 500));
      for (const p of photos || []) if (p.photo_url) photoMap[p.email] = p.photo_url;
    }

    // ── Step 6: Upsert lead contacts (no delete-all — preserves FK links) ──
    const fetchedHsContactIds = new Set(allContacts.map((c) => c.id));

    const allRows: any[] = [];
    for (const contact of allContacts) {
      const hsCompanyId = contactToCompanyHsId[contact.id];
      const localCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : null;

      allRows.push({
        user_id: userId,
        hubspot_contact_id: contact.id,
        company_id: localCompanyId || null,
        first_name: contact.firstname || null,
        last_name: contact.lastname || null,
        email: contact.email || null,
        phone: contact.phone || null,
        title: contact.jobtitle || null,
        photo_url: contact.email ? photoMap[contact.email] || null : null,
        lead_status: contact.hs_lead_status || null,
        lifecycle_stage: contact.lifecyclestage || null,
        hubspot_owner_id: contact.hubspot_owner_id || null,
        enrichment_data: {
          company_name: contact.company || null,
          createdate: contact.createdate,
          lastmodifieddate: contact.lastmodifieddate,
          notes_last_updated: contact.notes_last_updated,
          hs_email_last_send_date: contact.hs_email_last_send_date,
          owner_name: contact.hubspot_owner_id ? ownerNames[contact.hubspot_owner_id] || null : null,
        },
        updated_at: new Date().toISOString(),
      });
    }

    let synced = 0;
    let skipped = 0;
    for (let i = 0; i < allRows.length; i += 100) {
      const batch = allRows.slice(i, i + 100);
      const { error } = await supabase.from("contacts").upsert(batch, { onConflict: "hubspot_contact_id" });
      if (error) {
        console.error(`[hubspot-contacts-sync] Batch upsert error at offset ${i}: ${JSON.stringify(error)}`);
        skipped += batch.length;
      } else {
        synced += batch.length;
      }
    }

    // Remove stale lead contacts (deleted/demoted in HubSpot) — scoped to lead contacts only
    let staleDeleted = 0;
    const { data: localLeadContacts } = await supabase
      .from("contacts")
      .select("id, hubspot_contact_id")
      .not("hubspot_contact_id", "is", null)
      .not("lead_status", "is", null);
    const staleIds = (localLeadContacts || [])
      .filter((c) => !fetchedHsContactIds.has(c.hubspot_contact_id))
      .map((c) => c.id);
    for (let i = 0; i < staleIds.length; i += 100) {
      const batch = staleIds.slice(i, i + 100);
      const { error } = await supabase.from("contacts").delete().in("id", batch);
      if (!error) staleDeleted += batch.length;
      else console.error(`[hubspot-contacts-sync] Stale delete error: ${JSON.stringify(error)}`);
    }
    if (staleDeleted > 0) console.log(`[hubspot-contacts-sync] Removed ${staleDeleted} stale lead contacts`);

    // ── Step 7: Auto-enrich lead contacts + their companies ──
    if (synced > 0) {
      try {
        // Enrich contacts (Apollo) — only leads, capped at 25
        await supabase.functions.invoke("enrich-contacts", {
          body: { limit: Math.min(synced, 25) },
        });
        console.log(`[hubspot-contacts-sync] Triggered contact enrichment for up to ${Math.min(synced, 25)} leads`);

        // Enrich lead companies (Ocean.io) — only companies attached to leads
        const leadCompanyIds = [...new Set(allRows.filter(r => r.company_id).map(r => r.company_id))];
        if (leadCompanyIds.length > 0) {
          await supabase.functions.invoke("enrich-companies", {
            body: { companyIds: leadCompanyIds, limit: 25 },
          });
          console.log(`[hubspot-contacts-sync] Triggered company enrichment for ${leadCompanyIds.length} lead companies`);
        }
      } catch (e) {
        console.error(`[hubspot-contacts-sync] Enrichment trigger failed: ${e.message}`);
      }
    }

    // ── Step 7c: Auto-crawl new lead companies with domains ──
    try {
      const leadCompanyIds = [...new Set(allRows.filter(r => r.company_id).map(r => r.company_id))];
      if (leadCompanyIds.length > 0) {
        const { data: leadCompanies } = await supabase
          .from("companies")
          .select("id, domain")
          .in("id", leadCompanyIds)
          .not("domain", "is", null);

        const domains = (leadCompanies || []).filter(c => c.domain).map(c => c.domain);
        const { data: existingCrawls } = await supabase
          .from("crawl_sessions")
          .select("domain")
          .in("domain", domains);
        const crawledDomains = new Set((existingCrawls || []).map(c => c.domain));

        let crawlsCreated = 0;
        for (const company of leadCompanies || []) {
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
        if (crawlsCreated > 0) console.log(`[hubspot-contacts-sync] Auto-crawled ${crawlsCreated} lead company domains`);
      }
    } catch (e) {
      console.error(`[hubspot-contacts-sync] Auto-crawl failed: ${e.message}`);
    }

    // ── Step 8: Summary ──
    const { data: dist } = await supabase
      .from("contacts")
      .select("lead_status")
      .not("lead_status", "is", null);

    const statusDist: Record<string, number> = {};
    for (const row of dist || []) {
      const s = row.lead_status || "unknown";
      statusDist[s] = (statusDist[s] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        contacts_fetched: allContacts.length,
        contacts_synced: synced,
        contacts_skipped: skipped,
        companies_matched: Object.keys(companyIdMap).length,
        companies_created: companiesCreated,
        companies_unmatched: hsCompanyIds.length - Object.keys(companyIdMap).length,
        lead_status_distribution: statusDist,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[hubspot-contacts-sync] Fatal: ${e.message}`);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
