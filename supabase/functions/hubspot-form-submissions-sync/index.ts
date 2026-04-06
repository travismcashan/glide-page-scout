import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hubspotFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After")) || 5;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return hubspotFetch(path, token);
  }
  if (!res.ok) throw new Error(`HubSpot [${res.status}]: ${(await res.text()).substring(0, 300)}`);
  return res.json();
}

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

    const syncRun = await startSyncRun(supabase, "hubspot-form-submissions-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // ── Step 1: List all forms ──
    const formsRes = await hubspotFetch("/marketing/v3/forms?limit=100", TOKEN);
    const forms = formsRes.results || [];
    console.log(`[hubspot-form-submissions-sync] Found ${forms.length} forms`);

    // Build form name lookup
    const formNames: Record<string, string> = {};
    for (const f of forms) {
      formNames[f.id] = f.name || "Untitled Form";
    }

    // ── Step 2: Fetch submissions for each form ──
    const allSubmissions: any[] = [];

    for (const form of forms) {
      let after: string | undefined;
      let page = 0;
      do {
        const url = `/marketing/v3/forms/${form.id}/submissions?limit=50${after ? `&after=${after}` : ""}`;
        try {
          const res = await hubspotFetch(url, TOKEN);
          for (const sub of res.results || []) {
            allSubmissions.push({ ...sub, _formId: form.id, _formName: form.name });
          }
          after = res.paging?.next?.after;
          page++;
        } catch (e) {
          console.error(`[hubspot-form-submissions-sync] Error fetching submissions for form ${form.id}: ${e.message}`);
          break;
        }
      } while (after && page < 5);
    }

    console.log(`[hubspot-form-submissions-sync] Total submissions fetched: ${allSubmissions.length}`);

    // ── Step 3: Resolve contacts → companies ──
    // Extract emails from submissions to match to contacts
    const emailToContact: Record<string, { id: string; company_id: string | null }> = {};
    const submissionEmails: string[] = [];

    for (const sub of allSubmissions) {
      const values = sub.values || [];
      const emailField = values.find((v: any) => v.name === "email" || v.name === "hs_email");
      if (emailField?.value) submissionEmails.push(emailField.value.toLowerCase());
    }

    // Batch lookup contacts by email
    const uniqueEmails = [...new Set(submissionEmails)];
    for (let i = 0; i < uniqueEmails.length; i += 100) {
      const batch = uniqueEmails.slice(i, i + 100);
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email, company_id")
        .in("email", batch);
      for (const c of contacts || []) {
        if (c.email) emailToContact[c.email.toLowerCase()] = { id: c.id, company_id: c.company_id };
      }
    }

    // ── Step 4: Build rows and upsert ──
    const rows = allSubmissions.map((sub) => {
      const values = sub.values || [];
      const emailField = values.find((v: any) => v.name === "email" || v.name === "hs_email");
      const email = emailField?.value?.toLowerCase() || null;
      const contact = email ? emailToContact[email] : null;

      // Extract first/last name for display
      const firstName = values.find((v: any) => v.name === "firstname")?.value || "";
      const lastName = values.find((v: any) => v.name === "lastname")?.value || "";
      const contactName = [firstName, lastName].filter(Boolean).join(" ") || null;

      // Convert values array to key-value object
      const formValues: Record<string, string> = {};
      for (const v of values) {
        formValues[v.name] = v.value;
      }

      return {
        user_id: userId,
        hubspot_submission_id: sub.submittedAt ? `${sub._formId}_${sub.submittedAt}` : `${sub._formId}_${Date.now()}_${Math.random()}`,
        hubspot_form_id: sub._formId,
        form_name: sub._formName || null,
        page_url: sub.pageUrl || null,
        page_title: sub.pageTitle || null,
        submitted_at: sub.submittedAt ? new Date(parseInt(sub.submittedAt)).toISOString() : null,
        contact_email: email,
        contact_name: contactName,
        company_id: contact?.company_id || null,
        contact_id: contact?.id || null,
        form_values: formValues,
        metadata: { consent: sub.consent, correlationId: sub.correlationId },
        updated_at: new Date().toISOString(),
      };
    });

    let synced = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("form_submissions").upsert(batch, { onConflict: "hubspot_submission_id" });
      if (error) {
        console.warn(`[hubspot-form-submissions-sync] Batch upsert error at offset ${i}, retrying: ${JSON.stringify(error)}`);
        await new Promise((r) => setTimeout(r, 2000));
        const { error: retryError } = await supabase.from("form_submissions").upsert(batch, { onConflict: "hubspot_submission_id" });
        if (retryError) {
          console.error(`[hubspot-form-submissions-sync] Retry failed at offset ${i}: ${JSON.stringify(retryError)}`);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      } else {
        synced += batch.length;
      }
    }

    // ── Step 5: Summary ──
    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: synced,
      recordsSkipped: skipped,
      metadata: {
        forms_count: forms.length,
        submissions_fetched: allSubmissions.length,
        contacts_matched: Object.keys(emailToContact).length,
      },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({
        success: true,
        forms_count: forms.length,
        submissions_fetched: allSubmissions.length,
        synced,
        skipped,
        contacts_matched: Object.keys(emailToContact).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[hubspot-form-submissions-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
