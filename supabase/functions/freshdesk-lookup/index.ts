/**
 * Freshdesk Lookup
 * Read-only Freshdesk integration for companies, contacts, and tickets.
 * Uses Basic Auth with API key.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getConfig() {
  const apiKey = Deno.env.get('FRESHDESK_API_KEY');
  const domain = Deno.env.get('FRESHDESK_DOMAIN');
  if (!apiKey || !domain) return null;
  return {
    baseUrl: `https://${domain}.freshdesk.com/api/v2`,
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':X')}`,
      'Content-Type': 'application/json',
    },
  };
}

async function fetchWithRateLimit(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      console.log(`[freshdesk-lookup] Rate limited, waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    return res;
  }
  throw new Error('Rate limit exceeded after retries');
}

async function fetchAllPages(baseUrl: string, headers: Record<string, string>, maxPages = 300): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}per_page=100&page=${page}`;
    const res = await fetchWithRateLimit(url, headers);
    if (!res.ok) {
      if (res.status === 404) break;
      const err = await res.text();
      throw new Error(`Freshdesk API error [${res.status}]: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config = getConfig();
    if (!config) {
      return new Response(JSON.stringify({ error: 'Freshdesk credentials not configured. Set FRESHDESK_API_KEY and FRESHDESK_DOMAIN.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── List all companies ──
    if (action === 'companies') {
      const companies = await fetchAllPages(`${config.baseUrl}/companies`, config.headers);
      const result = companies.map((c: any) => ({
        id: c.id,
        name: c.name,
        domain: c.domains?.[0] || null,
        domains: c.domains || [],
        description: c.description || null,
        industry: c.industry || null,
        health_score: c.health_score || null,
        account_tier: c.account_tier || null,
        renewal_date: c.renewal_date || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        custom_fields: c.custom_fields || {},
      }));
      console.log(`[freshdesk-lookup] Fetched ${result.length} companies`);
      return new Response(JSON.stringify({ total: result.length, companies: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── List contacts (optionally by company) ──
    if (action === 'contacts') {
      const { company_id } = body;
      const url = company_id
        ? `${config.baseUrl}/companies/${company_id}/contacts`
        : `${config.baseUrl}/contacts`;
      const contacts = await fetchAllPages(url, config.headers);
      const result = contacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        mobile: c.mobile,
        company_id: c.company_id,
        job_title: c.job_title,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
      return new Response(JSON.stringify({ total: result.length, contacts: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── List tickets (by company and/or date) ──
    if (action === 'tickets') {
      const { company_id, updated_since, limit } = body;
      let url = `${config.baseUrl}/tickets`;
      const params: string[] = [];
      if (company_id) params.push(`company_id=${company_id}`);
      if (updated_since) params.push(`updated_since=${encodeURIComponent(updated_since)}`);
      if (params.length) url += '?' + params.join('&');

      const maxPages = limit ? Math.ceil(limit / 100) : 10;
      const tickets = await fetchAllPages(url, config.headers, maxPages);
      const result = tickets.slice(0, limit || tickets.length).map((t: any) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        type: t.type,
        company_id: t.company_id,
        requester_id: t.requester_id,
        responder_id: t.responder_id,
        tags: t.tags || [],
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
      return new Response(JSON.stringify({ total: result.length, tickets: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Ticket summary per company ──
    if (action === 'ticket_summary') {
      const { company_id } = body;
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id is required for ticket_summary' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const tickets = await fetchAllPages(
        `${config.baseUrl}/tickets?company_id=${company_id}`,
        config.headers,
        30
      );
      const dates = tickets.map((t: any) => new Date(t.created_at).getTime()).filter(Boolean);
      const statusCounts: Record<string, number> = {};
      const STATUS_LABELS: Record<number, string> = { 2: 'open', 3: 'pending', 4: 'resolved', 5: 'closed' };
      for (const t of tickets) {
        const label = STATUS_LABELS[t.status] || `status_${t.status}`;
        statusCounts[label] = (statusCounts[label] || 0) + 1;
      }
      return new Response(JSON.stringify({
        company_id,
        total_tickets: tickets.length,
        first_ticket: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
        last_ticket: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
        status_breakdown: statusCounts,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Health check ──
    if (action === 'health') {
      const res = await fetchWithRateLimit(`${config.baseUrl}/companies?per_page=1&page=1`, config.headers);
      return new Response(JSON.stringify({
        ok: res.ok,
        status: res.status,
        remaining: res.headers.get('X-RateLimit-Remaining'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: companies, contacts, tickets, ticket_summary, health' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[freshdesk-lookup] Error:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
