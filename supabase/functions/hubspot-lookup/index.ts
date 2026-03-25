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

    // Fetch engagements from the company AND all contacts, deduplicating by ID
    const seenEngIds = new Set<string>();

    async function fetchEngagementsFor(objectType: string, objectId: string) {
      for (const eng of engagementTypes) {
        try {
          const assocRes = await hubspotFetch(
            `/crm/v4/objects/${objectType}/${objectId}/associations/${eng.type}`,
            HUBSPOT_ACCESS_TOKEN
          );
          const newIds = (assocRes.results || [])
            .map((a: any) => String(a.toObjectId))
            .filter((id: string) => !seenEngIds.has(`${eng.type}-${id}`));
          
          if (newIds.length === 0) continue;
          newIds.forEach((id: string) => seenEngIds.add(`${eng.type}-${id}`));

          const batchRes = await hubspotFetch(`/crm/v3/objects/${eng.type}/batch/read`, HUBSPOT_ACCESS_TOKEN, 'POST', {
            inputs: newIds.slice(0, 50).map((id: string) => ({ id })),
            properties: eng.properties,
          });
          const items = (batchRes.results || []).map((item: any) => ({
            id: item.id,
            type: eng.type,
            ...item.properties,
          }));
          engagements.push(...items);
        } catch (e) {
          console.error(`[hubspot] Error fetching ${eng.type} for ${objectType}/${objectId}: ${e.message}`);
        }
      }
    }

    // Fetch from company first, then all contacts
    if (companyIds[0]) {
      await fetchEngagementsFor('companies', companyIds[0]);
    }
    for (const cid of contactIds.slice(0, 10)) {
      await fetchEngagementsFor('contacts', cid);
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
    const formFieldsCache = new Map<string, Map<string, any[]>>(); // formId -> (submittedAt -> fields)

    for (const contactId of contactIds.slice(0, 10)) {
      try {
        const subRes = await hubspotFetch(
          `/contacts/v1/contact/vid/${contactId}/profile`,
          HUBSPOT_ACCESS_TOKEN
        );
        const subs = subRes?.['form-submissions'] || [];
        const contact = contacts.find((c: any) => c.id === contactId);
        for (const sub of subs) {
          const formId = sub['form-id'];

          // Fetch full submissions for this form (once per form, cached)
          if (formId && !formFieldsCache.has(formId)) {
            const fieldMap = new Map<string, any[]>();
            try {
            const submissionRes = await hubspotFetch(
                `/form-integrations/v1/submissions/forms/${formId}?limit=50`,
                HUBSPOT_ACCESS_TOKEN
              );
              for (const s of (submissionRes?.results || [])) {
                const fields = (s.values || []).map((v: any) => ({
                  name: v.name || v.label || 'Unknown',
                  label: v.label || v.name || 'Unknown',
                  value: v.value || '',
                })).filter((f: any) => f.value);
                if (fields.length > 0) {
                  // Store with submittedAt and the email from the submission for filtering
                  const emailField = fields.find((f: any) => f.name === 'email' || f.name === 'Email');
                  fieldMap.set(String(s.submittedAt), { fields, email: emailField?.value?.toLowerCase() || '' });
                }
              }
              console.log(`[hubspot] Form ${formId}: fetched ${fieldMap.size} submissions with fields`);
            } catch (formErr) {
              console.error(`[hubspot] Error fetching form ${formId} submissions: ${formErr.message}`);
            }
            formFieldsCache.set(formId, fieldMap);
          }

          // Match: first try email + timestamp, then timestamp only within 10s
          let fields: any[] = [];
          const cachedMap = formId ? formFieldsCache.get(formId) : undefined;
          const contactEmail = contact?.email?.toLowerCase() || '';
          if (sub.timestamp && cachedMap && cachedMap.size > 0) {
            // First pass: match by contact email AND closest timestamp
            let bestDelta = Infinity;
            for (const [ts, entry] of cachedMap) {
              if (entry.email && contactEmail && entry.email === contactEmail) {
                const delta = Math.abs(sub.timestamp - Number(ts));
                if (delta < bestDelta) {
                  bestDelta = delta;
                  fields = entry.fields;
                }
              }
            }
            // Fallback: if no email match, use timestamp within 10s
            if (fields.length === 0) {
              bestDelta = Infinity;
              for (const [ts, entry] of cachedMap) {
                const delta = Math.abs(sub.timestamp - Number(ts));
                if (delta < 10000 && delta < bestDelta) {
                  bestDelta = delta;
                  fields = entry.fields;
                }
              }
            }
            console.log(`[hubspot] Form ${formId} match for ${contactEmail}: delta=${bestDelta}ms, fields=${fields.length}`);
          }

          formSubmissions.push({
            contactId,
            contactName: contact ? `${contact.firstname || ''} ${contact.lastname || ''}`.trim() : '',
            contactEmail: contact?.email || '',
            formTitle: sub.title || 'Untitled Form',
            formId: formId || null,
            portalId: sub['portal-id'] || null,
            pageUrl: sub['page-url'] || null,
            timestamp: sub.timestamp ? new Date(sub.timestamp).toISOString() : null,
            conversionId: sub['conversion-id'] || null,
            fields,
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
