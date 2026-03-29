import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HARVEST_API = 'https://api.harvestapp.com/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('HARVEST_ACCESS_TOKEN');
    const accountId = Deno.env.get('HARVEST_ACCOUNT_ID');
    if (!accessToken || !accountId) {
      return new Response(JSON.stringify({ error: 'Harvest credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Harvest-Account-Id': accountId,
      'Content-Type': 'application/json',
    };

    const body = await req.json();
    const { action, from, to, projectId, userId, limit } = body;

    if (action === 'time_entries') {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (projectId) params.set('project_id', String(projectId));
      if (userId) params.set('user_id', String(userId));
      params.set('per_page', String(limit || 100));

      const res = await fetch(`${HARVEST_API}/time_entries?${params}`, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Harvest API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();

      // Summarize for the AI
      const entries = (data.time_entries || []).map((e: any) => ({
        date: e.spent_date,
        hours: e.hours,
        project: e.project?.name,
        client: e.client?.name,
        task: e.task?.name,
        user: e.user?.name,
        notes: e.notes,
        is_running: e.is_running,
      }));

      const totalHours = entries.reduce((s: number, e: any) => s + (e.hours || 0), 0);

      return new Response(JSON.stringify({
        total_entries: data.total_entries,
        total_hours: Math.round(totalHours * 100) / 100,
        entries,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'projects') {
      const params = new URLSearchParams();
      params.set('is_active', body.is_active === false ? 'false' : 'true');
      params.set('per_page', String(limit || 100));

      const res = await fetch(`${HARVEST_API}/projects?${params}`, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Harvest API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();

      const projects = (data.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        client: p.client?.name,
        budget: p.budget,
        budget_by: p.budget_by,
        is_active: p.is_active,
        hourly_rate: p.hourly_rate,
        cost_budget: p.cost_budget,
      }));

      return new Response(JSON.stringify({ total_projects: data.total_entries, projects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'project_report') {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`${HARVEST_API}/reports/time/projects?${params}`, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Harvest API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();

      const results = (data.results || []).map((r: any) => ({
        project_id: r.project_id,
        project_name: r.project_name,
        client_name: r.client_name,
        total_hours: r.total_hours,
        billable_hours: r.billable_hours,
        billable_amount: r.billable_amount,
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: time_entries, projects, project_report' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[harvest-lookup] Error:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
