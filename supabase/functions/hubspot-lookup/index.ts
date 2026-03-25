import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function hubspotFetch(path: string, token: string, method = 'GET', body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`https://api.hubapi.com${path}`, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${errText.substring(0, 500)}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_ACCESS_TOKEN = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!HUBSPOT_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'HUBSPOT_ACCESS_TOKEN not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const domainLower = domain.toLowerCase().replace(/^www\./, '');
    console.log(`[hubspot] Looking up domain: ${domainLower}`);

    // Search companies by domain
    const companySearch = await hubspotFetch('/crm/v3/objects/companies/search', HUBSPOT_ACCESS_TOKEN, 'POST', {
      filterGroups: [{
        filters: [{ propertyName: 'domain', operator: 'CONTAINS_TOKEN', value: domainLower }],
      }],
      properties: ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'city', 'state', 'country', 'phone', 'website', 'description', 'lifecyclestage', 'hs_lead_status', 'createdate', 'notes_last_updated'],
      limit: 10,
    });

    const companies = (companySearch.results || []).map((c: any) => ({
      id: c.id,
      ...c.properties,
    }));
    console.log(`[hubspot] Found ${companies.length} companies`);

    // Search contacts by email domain
    const contactSearch = await hubspotFetch('/crm/v3/objects/contacts/search', HUBSPOT_ACCESS_TOKEN, 'POST', {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: `@${domainLower}` }],
      }],
      properties: ['email', 'firstname', 'lastname', 'jobtitle', 'phone', 'mobilephone', 'lifecyclestage', 'hs_lead_status', 'city', 'state', 'country', 'company', 'lastmodifieddate', 'createdate', 'notes_last_updated'],
      limit: 50,
    });

    const contacts = (contactSearch.results || []).map((c: any) => ({
      id: c.id,
      ...c.properties,
    }));
    console.log(`[hubspot] Found ${contacts.length} contacts`);

    // Search deals associated with contacts or companies
    let deals: any[] = [];
    const companyIds = companies.map((c: any) => c.id);

    if (companyIds.length > 0) {
      // Get deals associated with the first company
      try {
        const assocData = await hubspotFetch(
          `/crm/v4/objects/companies/${companyIds[0]}/associations/deals`,
          HUBSPOT_ACCESS_TOKEN
        );
        const dealIds = (assocData.results || []).map((a: any) => a.toObjectId).slice(0, 20);

        if (dealIds.length > 0) {
          // Batch read deals
          const dealBatch = await hubspotFetch('/crm/v3/objects/deals/batch/read', HUBSPOT_ACCESS_TOKEN, 'POST', {
            inputs: dealIds.map((id: string) => ({ id })),
            properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate', 'hs_lastmodifieddate', 'hubspot_owner_id', 'deal_currency_code'],
          });
          deals = (dealBatch.results || []).map((d: any) => ({
            id: d.id,
            ...d.properties,
          }));
        }
      } catch (e) {
        console.error(`[hubspot] Error fetching deals: ${e.message}`);
      }
    }

    console.log(`[hubspot] Found ${deals.length} deals`);

    return new Response(JSON.stringify({
      success: true,
      domain: domainLower,
      companies,
      contacts,
      deals,
      stats: {
        companiesCount: companies.length,
        contactsCount: contacts.length,
        dealsCount: deals.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[hubspot] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
