import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASANA_API = 'https://app.asana.com/api/1.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('ASANA_ACCESS_TOKEN');
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Asana access token not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const body = await req.json();
    const { action, projectGid, workspaceGid, assigneeGid, completed, limit } = body;

    if (action === 'workspaces') {
      const res = await fetch(`${ASANA_API}/workspaces`, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Asana API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();
      return new Response(JSON.stringify({ workspaces: data.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'projects') {
      let url = `${ASANA_API}/projects?opt_fields=name,current_status,due_on,owner.name,team.name&limit=${limit || 100}`;
      if (workspaceGid) url += `&workspace=${workspaceGid}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Asana API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();
      const projects = (data.data || []).map((p: any) => ({
        gid: p.gid,
        name: p.name,
        due_on: p.due_on,
        owner: p.owner?.name,
        team: p.team?.name,
        status: p.current_status?.text,
        status_color: p.current_status?.color,
      }));

      return new Response(JSON.stringify({ projects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'tasks') {
      if (!projectGid) {
        return new Response(JSON.stringify({ error: 'projectGid is required for tasks action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const completedFilter = completed === true ? 'true' : completed === false ? 'false' : undefined;
      let url = `${ASANA_API}/tasks?project=${projectGid}&opt_fields=name,completed,due_on,assignee.name,tags.name,custom_fields.name,custom_fields.display_value,notes&limit=${limit || 100}`;
      if (completedFilter !== undefined) url += `&completed_since=${completedFilter === 'false' ? 'now' : '2000-01-01T00:00:00Z'}`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Asana API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();
      const tasks = (data.data || []).map((t: any) => ({
        gid: t.gid,
        name: t.name,
        completed: t.completed,
        due_on: t.due_on,
        assignee: t.assignee?.name,
        tags: (t.tags || []).map((tag: any) => tag.name),
        notes: t.notes ? t.notes.slice(0, 200) : null,
        custom_fields: (t.custom_fields || [])
          .filter((cf: any) => cf.display_value)
          .map((cf: any) => ({ name: cf.name, value: cf.display_value })),
      }));

      return new Response(JSON.stringify({ total_tasks: tasks.length, tasks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search') {
      if (!workspaceGid) {
        return new Response(JSON.stringify({ error: 'workspaceGid is required for search action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const params = new URLSearchParams();
      if (body.text) params.set('text', body.text);
      if (assigneeGid) params.set('assignee.any', assigneeGid);
      if (completed === false) params.set('completed', 'false');
      if (completed === true) params.set('completed', 'true');
      params.set('opt_fields', 'name,completed,due_on,assignee.name,projects.name');
      params.set('limit', String(limit || 50));

      const res = await fetch(`${ASANA_API}/workspaces/${workspaceGid}/tasks/search?${params}`, { headers });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Asana API error [${res.status}]: ${err.slice(0, 300)}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await res.json();
      const tasks = (data.data || []).map((t: any) => ({
        gid: t.gid,
        name: t.name,
        completed: t.completed,
        due_on: t.due_on,
        assignee: t.assignee?.name,
        projects: (t.projects || []).map((p: any) => p.name),
      }));

      return new Response(JSON.stringify({ tasks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: workspaces, projects, tasks, search' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[asana-lookup] Error:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
