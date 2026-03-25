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
      try {
        const assocData = await hubspotFetch(
          `/crm/v4/objects/companies/${companyIds[0]}/associations/deals`,
          HUBSPOT_ACCESS_TOKEN
        );
        const dealIds = (assocData.results || []).map((a: any) => a.toObjectId).slice(0, 20);

        if (dealIds.length > 0) {
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

    // Fetch engagements (emails, calls, meetings, notes, tasks) for contacts
    let engagements: any[] = [];
    const contactIds = contacts.map((c: any) => c.id);

    const engagementTypes = [
      { type: 'emails', properties: ['hs_email_subject', 'hs_email_direction', 'hs_email_status', 'hs_email_text', 'hs_timestamp', 'hs_email_sender_email', 'hs_email_to_email'] },
      { type: 'calls', properties: ['hs_call_title', 'hs_call_body', 'hs_call_direction', 'hs_call_disposition', 'hs_call_duration', 'hs_call_status', 'hs_timestamp'] },
      { type: 'meetings', properties: ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_outcome', 'hs_timestamp'] },
      { type: 'notes', properties: ['hs_note_body', 'hs_timestamp'] },
      { type: 'tasks', properties: ['hs_task_subject', 'hs_task_body', 'hs_task_status', 'hs_task_priority', 'hs_timestamp'] },
    ];

    // Fetch engagements for the first company (or first few contacts)
    const targetId = companyIds[0] || contactIds[0];
    const targetType = companyIds[0] ? 'companies' : 'contacts';

    if (targetId) {
      for (const eng of engagementTypes) {
        try {
          // Get associations
          const assocRes = await hubspotFetch(
            `/crm/v4/objects/${targetType}/${targetId}/associations/${eng.type}`,
            HUBSPOT_ACCESS_TOKEN
          );
          const engIds = (assocRes.results || []).map((a: any) => a.toObjectId).slice(0, 25);

          if (engIds.length > 0) {
            const batchRes = await hubspotFetch(`/crm/v3/objects/${eng.type}/batch/read`, HUBSPOT_ACCESS_TOKEN, 'POST', {
              inputs: engIds.map((id: string) => ({ id })),
              properties: eng.properties,
            });
            const items = (batchRes.results || []).map((item: any) => ({
              id: item.id,
              type: eng.type,
              ...item.properties,
            }));
            engagements.push(...items);
          }
        } catch (e) {
          console.error(`[hubspot] Error fetching ${eng.type}: ${e.message}`);
        }
      }
    }

    // Sort engagements by timestamp descending
    engagements.sort((a, b) => {
      const aTime = a.hs_timestamp ? new Date(a.hs_timestamp).getTime() : 0;
      const bTime = b.hs_timestamp ? new Date(b.hs_timestamp).getTime() : 0;
      return bTime - aTime;
    });

    console.log(`[hubspot] Found ${engagements.length} engagements`);

    // Fetch form submissions for contacts
    let formSubmissions: any[] = [];
    for (const contactId of contactIds.slice(0, 10)) {
      try {
        const subRes = await hubspotFetch(
          `/contacts/v1/contact/vid/${contactId}/profile`,
          HUBSPOT_ACCESS_TOKEN
        );
        const subs = subRes?.['form-submissions'] || [];
        const contact = contacts.find((c: any) => c.id === contactId);
        for (const sub of subs) {
          formSubmissions.push({
            contactId,
            contactName: contact ? `${contact.firstname || ''} ${contact.lastname || ''}`.trim() : '',
            contactEmail: contact?.email || '',
            formTitle: sub.title || 'Untitled Form',
            formId: sub['form-id'] || null,
            portalId: sub['portal-id'] || null,
            pageUrl: sub['page-url'] || null,
            timestamp: sub.timestamp ? new Date(sub.timestamp).toISOString() : null,
            conversionId: sub['conversion-id'] || null,
          });
        }
      } catch (e) {
        console.error(`[hubspot] Error fetching form submissions for contact ${contactId}: ${e.message}`);
      }
    }

    // Sort form submissions by timestamp descending
    formSubmissions.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    console.log(`[hubspot] Found ${formSubmissions.length} form submissions`);

    return new Response(JSON.stringify({
      success: true,
      domain: domainLower,
      companies,
      contacts,
      deals,
      engagements,
      formSubmissions,
      stats: {
        companiesCount: companies.length,
        contactsCount: contacts.length,
        dealsCount: deals.length,
        engagementsCount: engagements.length,
        formSubmissionsCount: formSubmissions.length,
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
