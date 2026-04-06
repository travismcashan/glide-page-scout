/**
 * asana-projects-sync
 *
 * Pulls all projects from configured Asana portfolios, resolves companies
 * via project_mappings → harvest_projects → companies, and upserts into
 * the asana_projects table. Follows the hubspot-deals-sync pattern.
 *
 * Triggered by: pg_cron (every 2h), manual invoke from UI
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASANA_API = "https://app.asana.com/api/1.0";

// ── Asana API helpers ──

async function asanaFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`${ASANA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After")) || 5;
    console.log(`[asana-projects-sync] Rate limited, waiting ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return asanaFetch(path, token);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asana [${res.status}]: ${text.substring(0, 300)}`);
  }
  return res.json();
}

async function asanaPaginate(path: string, token: string, maxPages = 20): Promise<any[]> {
  const results: any[] = [];
  let offset: string | undefined;
  let page = 0;

  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = offset ? `${path}${sep}offset=${offset}` : path;
    const data = await asanaFetch(url, token);
    results.push(...(data.data || []));
    offset = data.next_page?.offset;
    page++;
  } while (offset && page < maxPages);

  return results;
}

// ── Project field extraction ──

const PROJECT_OPT_FIELDS = [
  "name",
  "current_status.color",
  "current_status.text",
  "current_status.modified_at",
  "start_on",
  "due_on",
  "owner.name",
  "members.name",
  "custom_fields.name",
  "custom_fields.display_value",
  "num_tasks",
  "archived",
].join(",");

interface AsanaPortfolioConfig {
  portfolio_gid: string;
  portfolio_name: string;
  display_name: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const TOKEN = Deno.env.get("ASANA_ACCESS_TOKEN");
    if (!TOKEN) throw new Error("ASANA_ACCESS_TOKEN not set");
    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    const userId = await resolveUserId(supabase, req);

    const syncRun = await startSyncRun(supabase, "asana-projects-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    // ── Step 1: Load portfolio configs from asana_config ──
    const { data: portfolioConfigs, error: cfgErr } = await supabase
      .from("asana_config")
      .select("portfolio_gid, portfolio_name, display_name");
    if (cfgErr) throw new Error(`Failed to load asana_config: ${cfgErr.message}`);
    if (!portfolioConfigs?.length) throw new Error("No portfolios configured in asana_config");

    const configs: AsanaPortfolioConfig[] = portfolioConfigs;
    console.log(`[asana-projects-sync] Loading projects from ${configs.length} portfolios`);

    // ── Step 2: Fetch projects from each portfolio ──
    const allProjects: any[] = [];
    const seenGids = new Set<string>();

    for (const cfg of configs) {
      try {
        const items = await asanaPaginate(
          `/portfolios/${cfg.portfolio_gid}/items?opt_fields=${PROJECT_OPT_FIELDS}`,
          TOKEN
        );

        for (const item of items) {
          if (seenGids.has(item.gid)) continue;
          seenGids.add(item.gid);

          // Fetch task counts separately (not available on portfolio items)
          let numCompletedTasks = 0;
          let numIncompleteTasks = 0;
          let numTasks = 0;
          try {
            const taskCounts = await asanaFetch(
              `/projects/${item.gid}?opt_fields=num_completed_tasks,num_incomplete_tasks`,
              TOKEN
            );
            numCompletedTasks = taskCounts.data?.num_completed_tasks || 0;
            numIncompleteTasks = taskCounts.data?.num_incomplete_tasks || 0;
            numTasks = numCompletedTasks + numIncompleteTasks;
          } catch {
            // Non-fatal — continue without task counts
          }

          allProjects.push({
            gid: item.gid,
            name: item.name || "Untitled",
            statusColor: item.current_status?.color || "none",
            statusText: item.current_status?.text || null,
            statusUpdatedAt: item.current_status?.modified_at || null,
            startDate: item.start_on || null,
            dueDate: item.due_on || null,
            owner: item.owner?.name || null,
            teamMembers: (item.members || []).map((m: any) => m.name).filter(Boolean),
            customFields: Object.fromEntries(
              (item.custom_fields || [])
                .filter((cf: any) => cf.display_value)
                .map((cf: any) => [cf.name, cf.display_value])
            ),
            numCompletedTasks,
            numIncompleteTasks,
            numTasks,
            portfolioGid: cfg.portfolio_gid,
            portfolioName: cfg.display_name || cfg.portfolio_name,
            archived: item.archived ?? false,
            raw: item,
          });
        }

        console.log(`[asana-projects-sync] Portfolio "${cfg.portfolio_name}": ${items.length} items`);
      } catch (e) {
        console.error(`[asana-projects-sync] Failed portfolio ${cfg.portfolio_gid}: ${e.message}`);
      }
    }

    console.log(`[asana-projects-sync] Fetched ${allProjects.length} unique projects`);

    // ── Step 3: Load project_mappings for company resolution ──
    const { data: mappings } = await supabase
      .from("project_mappings")
      .select("asana_project_gid, harvest_project_id, company_id, client_display_name");

    const mappingByGid = new Map<string, any>();
    for (const m of mappings || []) {
      mappingByGid.set(m.asana_project_gid, m);
    }

    // Build harvest_project_id → company_id map from harvest_projects table
    const harvestProjectIds = (mappings || [])
      .filter((m: any) => m.harvest_project_id)
      .map((m: any) => String(m.harvest_project_id));

    const harvestToCompany = new Map<string, string>();
    if (harvestProjectIds.length > 0) {
      for (let i = 0; i < harvestProjectIds.length; i += 100) {
        const batch = harvestProjectIds.slice(i, i + 100);
        const { data: hpRows } = await supabase
          .from("harvest_projects")
          .select("harvest_project_id, company_id")
          .in("harvest_project_id", batch);
        for (const hp of hpRows || []) {
          if (hp.company_id) harvestToCompany.set(hp.harvest_project_id, hp.company_id);
        }
      }
    }

    // ── Step 4: Build upsert rows ──
    const rows = allProjects.map((p) => {
      const mapping = mappingByGid.get(p.gid);

      // Resolve company_id: mapping.company_id → harvest_projects.company_id → null
      let companyId: string | null = mapping?.company_id || null;
      if (!companyId && mapping?.harvest_project_id) {
        companyId = harvestToCompany.get(String(mapping.harvest_project_id)) || null;
      }

      return {
        user_id: userId,
        company_id: companyId,
        asana_project_gid: p.gid,
        name: p.name,
        status_color: p.statusColor,
        status_text: p.statusText,
        status_updated_at: p.statusUpdatedAt,
        start_date: p.startDate,
        due_date: p.dueDate,
        owner: p.owner,
        team_members: p.teamMembers,
        num_completed_tasks: p.numCompletedTasks,
        num_incomplete_tasks: p.numIncompleteTasks,
        num_tasks: p.numTasks,
        portfolio_gid: p.portfolioGid,
        portfolio_name: p.portfolioName,
        milestone_gid: null, // populated if grouping by milestone (future)
        milestone_name: null,
        custom_fields: p.customFields,
        raw_data: p.raw,
        is_archived: p.archived,
        updated_at: new Date().toISOString(),
      };
    });

    // ── Step 5: Batch upsert ──
    let synced = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase
        .from("asana_projects")
        .upsert(batch, { onConflict: "asana_project_gid" });

      if (error) {
        console.warn(`[asana-projects-sync] Batch upsert error at offset ${i}, retrying: ${JSON.stringify(error)}`);
        await new Promise((r) => setTimeout(r, 2000));
        const { error: retryErr } = await supabase
          .from("asana_projects")
          .upsert(batch, { onConflict: "asana_project_gid" });
        if (retryErr) {
          console.error(`[asana-projects-sync] Retry failed at offset ${i}: ${JSON.stringify(retryErr)}`);
          skipped += batch.length;
        } else {
          synced += batch.length;
        }
      } else {
        synced += batch.length;
      }
    }

    // ── Step 6: Remove stale projects (no longer in any portfolio) ──
    let staleDeleted = 0;
    if (skipped === 0) {
      const fetchedGids = new Set(allProjects.map((p) => p.gid));
      const { data: localProjects } = await supabase
        .from("asana_projects")
        .select("id, asana_project_gid")
        .eq("user_id", userId);

      const staleIds = (localProjects || [])
        .filter((p: any) => !fetchedGids.has(p.asana_project_gid))
        .map((p: any) => p.id);

      for (let i = 0; i < staleIds.length; i += 100) {
        const batch = staleIds.slice(i, i + 100);
        const { error } = await supabase.from("asana_projects").delete().in("id", batch);
        if (!error) staleDeleted += batch.length;
      }
      if (staleDeleted > 0) console.log(`[asana-projects-sync] Removed ${staleDeleted} stale projects`);
    }

    // ── Step 7: Summary ──
    const statusCounts: Record<string, number> = {};
    for (const p of allProjects) {
      statusCounts[p.statusColor] = (statusCounts[p.statusColor] || 0) + 1;
    }

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: synced,
      recordsDeleted: staleDeleted,
      recordsSkipped: skipped,
      metadata: {
        projects_fetched: allProjects.length,
        portfolios: configs.length,
        status_counts: statusCounts,
      },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({
        success: true,
        projects_fetched: allProjects.length,
        projects_synced: synced,
        projects_skipped: skipped,
        stale_deleted: staleDeleted,
        portfolios: configs.length,
        status_counts: statusCounts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[asana-projects-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
