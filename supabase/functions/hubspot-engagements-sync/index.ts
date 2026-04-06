import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const ENGAGEMENT_TYPES = ["emails", "calls", "meetings", "notes", "tasks"] as const;

const PROPERTY_MAP: Record<string, string[]> = {
  emails: ["hs_email_subject", "hs_email_direction", "hs_email_text", "hs_timestamp", "hs_email_status"],
  calls: ["hs_call_title", "hs_call_direction", "hs_call_body", "hs_timestamp", "hs_call_duration", "hs_call_status"],
  meetings: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome"],
  notes: ["hs_note_body", "hs_timestamp"],
  tasks: ["hs_task_subject", "hs_task_body", "hs_task_status", "hs_timestamp", "hs_task_priority"],
};

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

    const userId = await resolveUserId(supabase, req);

    const syncRun = await startSyncRun(supabase, "hubspot-engagements-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // ── Step 1: Fetch engagements by type (max 5 pages = 500 per type) ──
    const allEngagements: { type: string; id: string; properties: any }[] = [];
    const MAX_PAGES = 5; // Stay within edge function timeout

    for (const type of ENGAGEMENT_TYPES) {
      let after: string | undefined;
      let page = 0;
      do {
        const searchBody: any = {
          properties: PROPERTY_MAP[type] || ["hs_timestamp"],
          sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
          limit: 100,
        };
        if (after) searchBody.after = after;

        try {
          const res = await hubspotFetch(`/crm/v3/objects/${type}/search`, TOKEN, "POST", searchBody);
          for (const obj of res.results || []) {
            allEngagements.push({ type: type.replace(/s$/, ""), id: obj.id, properties: obj.properties });
          }
          after = res.paging?.next?.after;
          page++;
        } catch (e) {
          console.error(`[hubspot-engagements-sync] Error fetching ${type}: ${e.message}`);
          break;
        }
      } while (after && page < MAX_PAGES);

      console.log(`[hubspot-engagements-sync] Fetched ${type}: ${allEngagements.filter(e => e.type === type.replace(/s$/, "")).length}`);
    }

    console.log(`[hubspot-engagements-sync] Total engagements fetched: ${allEngagements.length}`);

    // ── Step 2: Batch-fetch company associations only (primary linkage) ──
    // Contact and deal associations are secondary — resolve via company match
    const engagementToCompanyHsId: Record<string, string> = {};
    const engagementToContactHsId: Record<string, string> = {};
    const engagementToDealHsId: Record<string, string> = {};

    for (const type of ENGAGEMENT_TYPES) {
      const typeEngagements = allEngagements.filter(e => e.type === type.replace(/s$/, ""));
      if (typeEngagements.length === 0) continue;

      // Company associations (essential — links engagement to company)
      for (let i = 0; i < typeEngagements.length; i += 100) {
        const batch = typeEngagements.slice(i, i + 100).map(e => ({ id: e.id }));
        try {
          const assocRes = await hubspotFetch(`/crm/v4/associations/${type}/companies/batch/read`, TOKEN, "POST", { inputs: batch });
          for (const r of assocRes.results || []) {
            const compId = r.to?.[0]?.toObjectId;
            if (compId) engagementToCompanyHsId[r.from.id] = String(compId);
          }
        } catch (e) {
          console.error(`[hubspot-engagements-sync] ${type} company assoc error: ${e.message}`);
        }
      }

      // Contact associations (batch 100 at a time)
      for (let i = 0; i < typeEngagements.length; i += 100) {
        const batch = typeEngagements.slice(i, i + 100).map(e => ({ id: e.id }));
        try {
          const assocRes = await hubspotFetch(`/crm/v4/associations/${type}/contacts/batch/read`, TOKEN, "POST", { inputs: batch });
          for (const r of assocRes.results || []) {
            const contactId = r.to?.[0]?.toObjectId;
            if (contactId) engagementToContactHsId[r.from.id] = String(contactId);
          }
        } catch (e) {
          console.error(`[hubspot-engagements-sync] ${type} contact assoc error: ${e.message}`);
        }
      }
    }

    // ── Step 3: Resolve HubSpot IDs → local UUIDs ──
    const hsCompanyIds = [...new Set(Object.values(engagementToCompanyHsId))];
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

    const hsContactIds = [...new Set(Object.values(engagementToContactHsId))];
    const contactIdMap: Record<string, string> = {};
    for (let i = 0; i < hsContactIds.length; i += 100) {
      const batch = hsContactIds.slice(i, i + 100);
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, hubspot_contact_id")
        .in("hubspot_contact_id", batch);
      for (const c of contacts || []) {
        if (c.hubspot_contact_id) contactIdMap[c.hubspot_contact_id] = c.id;
      }
    }

    // ── Step 4: Build rows and upsert ──
    const rows = allEngagements.map((eng) => {
      const p = eng.properties;
      const hsCompanyId = engagementToCompanyHsId[eng.id];
      const hsContactId = engagementToContactHsId[eng.id];

      const subject = p.hs_email_subject || p.hs_call_title || p.hs_meeting_title || p.hs_task_subject || null;
      const bodyRaw = p.hs_email_text || p.hs_call_body || p.hs_meeting_body || p.hs_note_body || p.hs_task_body || "";
      const bodyPreview = bodyRaw.substring(0, 500) || null;
      // Map HubSpot direction to CHECK constraint values (inbound/outbound) or null
      const rawDir = (p.hs_email_direction || p.hs_call_direction || "").toUpperCase();
      const direction = rawDir.includes("INBOUND") || rawDir.includes("INCOMING") ? "inbound"
        : rawDir.includes("OUTBOUND") || rawDir.includes("OUTGOING") ? "outbound"
        : null;

      return {
        user_id: userId,
        hubspot_engagement_id: eng.id,
        engagement_type: eng.type,
        company_id: hsCompanyId ? companyIdMap[hsCompanyId] || null : null,
        contact_id: hsContactId ? contactIdMap[hsContactId] || null : null,
        subject,
        body_preview: bodyPreview,
        direction,
        occurred_at: p.hs_timestamp || null,
        metadata: p, // store full raw properties
        updated_at: new Date().toISOString(),
      };
    });

    let synced = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("engagements").upsert(batch, { onConflict: "hubspot_engagement_id" });
      if (error) {
        console.warn(`[hubspot-engagements-sync] Batch upsert error at offset ${i}, retrying: ${JSON.stringify(error)}`);
        await new Promise((r) => setTimeout(r, 2000));
        const { error: retryError } = await supabase.from("engagements").upsert(batch, { onConflict: "hubspot_engagement_id" });
        if (retryError) {
          console.error(`[hubspot-engagements-sync] Retry failed at offset ${i}: ${JSON.stringify(retryError)}`);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      } else {
        synced += batch.length;
      }
    }

    // ── Step 5: Remove stale engagements (deleted in HubSpot) ──
    let staleDeleted = 0;
    if (skipped === 0) {
      const fetchedIds = new Set(allEngagements.map(e => e.id));
      const { data: localEngagements } = await supabase
        .from("engagements")
        .select("id, hubspot_engagement_id")
        .not("hubspot_engagement_id", "is", null);
      const staleIds = (localEngagements || [])
        .filter((e: any) => !fetchedIds.has(e.hubspot_engagement_id))
        .map((e: any) => e.id);
      for (let i = 0; i < staleIds.length; i += 100) {
        const batch = staleIds.slice(i, i + 100);
        const { error } = await supabase.from("engagements").delete().in("id", batch);
        if (!error) staleDeleted += batch.length;
        else console.error(`[hubspot-engagements-sync] Stale delete error: ${JSON.stringify(error)}`);
      }
      if (staleDeleted > 0) console.log(`[hubspot-engagements-sync] Removed ${staleDeleted} stale engagements`);
    }

    // ── Step 6: Summary ──
    const typeCounts: Record<string, number> = {};
    for (const e of allEngagements) {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    }

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: synced,
      recordsDeleted: staleDeleted,
      recordsSkipped: skipped,
      metadata: {
        total_fetched: allEngagements.length,
        by_type: typeCounts,
        companies_matched: Object.keys(companyIdMap).length,
        contacts_matched: Object.keys(contactIdMap).length,
      },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: allEngagements.length,
        synced,
        skipped,
        stale_deleted: staleDeleted,
        by_type: typeCounts,
        associations: {
          companies: Object.keys(companyIdMap).length,
          contacts: Object.keys(contactIdMap).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[hubspot-engagements-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
