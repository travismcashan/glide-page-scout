/**
 * batch-crawl: One-time script to crawl all lead/deal company domains.
 *
 * 1. Finds companies linked to leads (contacts with lead_status) or open deals
 * 2. For uncrawled domains — creates crawl_sessions + invokes crawl-start
 * 3. For completed_with_errors — cleans up integration_runs, resets session, re-invokes crawl-start
 * 4. Throttles to 3 concurrent crawls with 5s delay between batches
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONCURRENCY = 3;
const BATCH_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    // 1. Get all company IDs from leads + open deals
    const { data: leadCompanies } = await sb
      .from("contacts")
      .select("company_id")
      .not("lead_status", "is", null)
      .not("company_id", "is", null);

    const { data: dealCompanies } = await sb
      .from("deals")
      .select("company_id")
      .eq("status", "open")
      .not("company_id", "is", null);

    const companyIds = [
      ...new Set([
        ...(leadCompanies || []).map((c: any) => c.company_id),
        ...(dealCompanies || []).map((d: any) => d.company_id),
      ]),
    ];

    console.log(`batch-crawl: ${companyIds.length} unique companies from leads/deals`);

    // 2. Get company details
    const { data: companies } = await sb
      .from("companies")
      .select("id, name, domain")
      .in("id", companyIds)
      .not("domain", "is", null);

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No companies with domains found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Check existing crawl sessions for these domains
    const domains = companies.map((c: any) => c.domain.toLowerCase().replace(/^www\./, ""));
    const { data: existingSessions } = await sb
      .from("crawl_sessions")
      .select("id, domain, status")
      .in("domain", domains)
      .order("created_at", { ascending: false });

    // Build domain → latest session map
    const sessionByDomain = new Map<string, { id: string; status: string }>();
    for (const s of existingSessions || []) {
      if (!sessionByDomain.has(s.domain)) {
        sessionByDomain.set(s.domain, { id: s.id, status: s.status });
      }
    }

    // 4. Categorize: new crawls vs re-crawls
    const newCrawls: { companyId: string; name: string; domain: string }[] = [];
    const reCrawls: { sessionId: string; domain: string; name: string }[] = [];

    for (const company of companies) {
      const domain = company.domain.toLowerCase().replace(/^www\./, "");
      const existing = sessionByDomain.get(domain);

      if (!existing) {
        newCrawls.push({ companyId: company.id, name: company.name, domain });
      } else if (existing.status === "completed_with_errors") {
        reCrawls.push({ sessionId: existing.id, domain, name: company.name });
      }
      // Skip 'completed' — already fully crawled
    }

    console.log(`batch-crawl: ${newCrawls.length} new crawls, ${reCrawls.length} re-crawls`);

    const results: { domain: string; type: string; sessionId: string; status: string }[] = [];

    // Helper: invoke crawl-start for a session
    async function triggerCrawlStart(sessionId: string, domain: string, type: string) {
      try {
        const resp = await fetch(`${functionsUrl}/crawl-start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const ok = resp.ok;
        console.log(`  ${type}: ${domain} (${sessionId}) → ${ok ? "started" : "failed"}`);
        results.push({ domain, type, sessionId, status: ok ? "started" : "crawl-start-failed" });
      } catch (err) {
        console.error(`  ${type}: ${domain} (${sessionId}) → error:`, err);
        results.push({ domain, type, sessionId, status: "error" });
      }
    }

    // 5. Process in batches of CONCURRENCY
    const allTasks: (() => Promise<void>)[] = [];

    // New crawls: create session then trigger
    for (const { companyId, name, domain } of newCrawls) {
      allTasks.push(async () => {
        const { data: session, error } = await sb
          .from("crawl_sessions")
          .insert({
            domain,
            base_url: `https://${domain}`,
            status: "pending",
            company_id: companyId,
          } as any)
          .select("id")
          .single();

        if (error || !session) {
          console.error(`  Failed to create session for ${domain}:`, error?.message);
          results.push({ domain, type: "new", sessionId: "", status: "create-failed" });
          return;
        }
        console.log(`  Created session for ${name} (${domain})`);
        await triggerCrawlStart(session.id, domain, "new");
      });
    }

    // Re-crawls: clean up integration_runs, reset session, trigger
    for (const { sessionId, domain, name } of reCrawls) {
      allTasks.push(async () => {
        // Delete old failed integration_runs so crawl-start creates fresh ones
        await sb
          .from("integration_runs")
          .delete()
          .eq("session_id", sessionId)
          .in("status", ["failed", "skipped"]);

        // Reset session status
        await sb
          .from("crawl_sessions")
          .update({ status: "pending" } as any)
          .eq("id", sessionId);

        console.log(`  Reset session for ${name} (${domain})`);
        await triggerCrawlStart(sessionId, domain, "re-crawl");
      });
    }

    // Run in batches
    for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
      const batch = allTasks.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((fn) => fn()));
      if (i + CONCURRENCY < allTasks.length) {
        console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`batch-crawl: complete. ${results.length} crawls processed.`);

    return new Response(
      JSON.stringify({
        success: true,
        newCrawls: newCrawls.length,
        reCrawls: reCrawls.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("batch-crawl error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Batch crawl failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
