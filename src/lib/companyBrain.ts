import { supabase } from '@/integrations/supabase/client';
import type { ApolloData } from '@/components/apollo/types';

/**
 * Upsert a company record from Apollo enrichment data.
 * Returns the company ID (existing or newly created).
 */
export async function upsertCompanyFromApollo(
  apolloData: ApolloData,
  sessionDomain: string
): Promise<string | null> {
  const domain = apolloData.organizationDomain || sessionDomain;
  if (!domain) return null;

  const name = apolloData.organizationName || domain;

  // Check if company already exists by domain
  const { data: existing } = await supabase
    .from('companies')
    .select('id, enrichment_data')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) {
    // Merge enrichment data (Apollo org fields)
    const enrichment = {
      ...(typeof existing.enrichment_data === 'object' && existing.enrichment_data !== null
        ? existing.enrichment_data
        : {}),
      apollo_org: extractOrgFields(apolloData),
    };

    await supabase
      .from('companies')
      .update({
        name: apolloData.organizationName || undefined,
        industry: apolloData.organizationIndustry || undefined,
        employee_count: apolloData.organizationSize?.toString() || undefined,
        annual_revenue: apolloData.organizationRevenue || undefined,
        logo_url: apolloData.organizationLogo || undefined,
        location: formatOrgLocation(apolloData),
        description: apolloData.organizationDescription || undefined,
        website_url: apolloData.organizationWebsite || undefined,
        enrichment_data: enrichment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return existing.id;
  }

  // Create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name,
      domain,
      industry: apolloData.organizationIndustry || null,
      employee_count: apolloData.organizationSize?.toString() || null,
      annual_revenue: apolloData.organizationRevenue || null,
      logo_url: apolloData.organizationLogo || null,
      location: formatOrgLocation(apolloData),
      description: apolloData.organizationDescription || null,
      website_url: apolloData.organizationWebsite || null,
      enrichment_data: { apollo_org: extractOrgFields(apolloData) },
      status: 'prospect',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create company:', error);
    return null;
  }

  return newCompany.id;
}

/**
 * Upsert a contact record from Apollo enrichment data.
 * Links to company if companyId is provided.
 */
export async function upsertContactFromApollo(
  apolloData: ApolloData,
  companyId: string | null
): Promise<string | null> {
  if (!apolloData.email && !apolloData.name) return null;

  // Check if contact already exists by email
  if (apolloData.email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', apolloData.email)
      .maybeSingle();

    if (existing) {
      // Update existing contact with latest enrichment
      await supabase
        .from('contacts')
        .update({
          first_name: apolloData.firstName || undefined,
          last_name: apolloData.lastName || undefined,
          phone: apolloData.phone || undefined,
          title: apolloData.title || undefined,
          linkedin_url: apolloData.linkedinUrl || undefined,
          photo_url: apolloData.photoUrl || undefined,
          seniority: apolloData.seniority || undefined,
          department: apolloData.departments?.[0] || undefined,
          apollo_person_id: apolloData.id || undefined,
          company_id: companyId || undefined,
          enrichment_data: extractPersonFields(apolloData),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      return existing.id;
    }
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      company_id: companyId,
      first_name: apolloData.firstName || null,
      last_name: apolloData.lastName || null,
      email: apolloData.email || null,
      phone: apolloData.phone || null,
      title: apolloData.title || null,
      department: apolloData.departments?.[0] || null,
      linkedin_url: apolloData.linkedinUrl || null,
      photo_url: apolloData.photoUrl || null,
      seniority: apolloData.seniority || null,
      apollo_person_id: apolloData.id || null,
      is_primary: true,
      enrichment_data: extractPersonFields(apolloData),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create contact:', error);
    return null;
  }

  return newContact.id;
}

/**
 * Link a crawl_session to a company by setting company_id.
 */
export async function linkSessionToCompany(
  sessionId: string,
  companyId: string
): Promise<void> {
  await supabase
    .from('crawl_sessions')
    .update({ company_id: companyId } as any)
    .eq('id', sessionId);
}

/**
 * Full sync: given Apollo data and a session, create/update company + contact + link session.
 * Call this after any successful Apollo enrichment.
 */
export async function syncCompanyBrain(
  apolloData: ApolloData,
  sessionId: string,
  sessionDomain: string
): Promise<{ companyId: string | null; contactId: string | null }> {
  if (!apolloData.success || !apolloData.found) {
    return { companyId: null, contactId: null };
  }

  try {
    // 1. Upsert company
    const companyId = await upsertCompanyFromApollo(apolloData, sessionDomain);

    // 2. Upsert contact (linked to company)
    const contactId = await upsertContactFromApollo(apolloData, companyId);

    // 3. Link session to company
    if (companyId) {
      await linkSessionToCompany(sessionId, companyId);
    }

    console.log(`[companyBrain] Synced: company=${companyId}, contact=${contactId}, session=${sessionId}`);
    return { companyId, contactId };
  } catch (err) {
    console.error('[companyBrain] Sync failed:', err);
    return { companyId: null, contactId: null };
  }
}

// --- Helper functions ---

function extractOrgFields(data: ApolloData) {
  return {
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    organizationDomain: data.organizationDomain,
    organizationWebsite: data.organizationWebsite,
    organizationLogo: data.organizationLogo,
    organizationIndustry: data.organizationIndustry,
    organizationIndustries: data.organizationIndustries,
    organizationSize: data.organizationSize,
    organizationFounded: data.organizationFounded,
    organizationRevenue: data.organizationRevenue,
    organizationRevenueRaw: data.organizationRevenueRaw,
    organizationDescription: data.organizationDescription,
    organizationKeywords: data.organizationKeywords,
    organizationPhone: data.organizationPhone,
    organizationCity: data.organizationCity,
    organizationState: data.organizationState,
    organizationCountry: data.organizationCountry,
    organizationLinkedin: data.organizationLinkedin,
    organizationTwitter: data.organizationTwitter,
    organizationTechnologies: data.organizationTechnologies,
    organizationHeadcountGrowth6mo: data.organizationHeadcountGrowth6mo,
    organizationHeadcountGrowth12mo: data.organizationHeadcountGrowth12mo,
    organizationHeadcountGrowth24mo: data.organizationHeadcountGrowth24mo,
    organizationSicCodes: data.organizationSicCodes,
    organizationNaicsCodes: data.organizationNaicsCodes,
  };
}

function extractPersonFields(data: ApolloData) {
  return {
    id: data.id,
    name: data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    title: data.title,
    headline: data.headline,
    photoUrl: data.photoUrl,
    email: data.email,
    emailStatus: data.emailStatus,
    phone: data.phone,
    phoneNumbers: data.phoneNumbers,
    city: data.city,
    state: data.state,
    country: data.country,
    linkedinUrl: data.linkedinUrl,
    twitterUrl: data.twitterUrl,
    seniority: data.seniority,
    departments: data.departments,
    isLikelyToEngage: data.isLikelyToEngage,
    intentStrength: data.intentStrength,
    employmentHistory: data.employmentHistory,
  };
}

function formatOrgLocation(data: ApolloData): string | null {
  const parts = [data.organizationCity, data.organizationState, data.organizationCountry].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ============================================================
// Ocean.io Sync
// ============================================================

type OceanData = {
  success: boolean;
  companyName?: string;
  domain?: string;
  companySize?: string;
  revenue?: string;
  description?: string;
  primaryCountry?: string;
  logo?: string;
  yearFounded?: string;
  industries?: string[];
  technologies?: string[];
  departmentSizes?: { department: string; size: number }[];
  webTraffic?: any;
  locations?: any[];
  keywords?: string[];
  [key: string]: any;
};

/**
 * Sync Ocean.io data to company brain.
 * Call this after ocean_data lands on a crawl_session.
 */
export async function syncOceanToCompanyBrain(
  oceanData: OceanData,
  sessionId: string,
  sessionDomain: string
): Promise<string | null> {
  if (!oceanData.success) return null;

  const domain = oceanData.domain || sessionDomain;
  if (!domain) return null;

  try {
    const { data: existing } = await supabase
      .from('companies')
      .select('id, enrichment_data')
      .eq('domain', domain)
      .maybeSingle();

    const enrichment = {
      ...(existing && typeof existing.enrichment_data === 'object' && existing.enrichment_data !== null
        ? existing.enrichment_data
        : {}),
      ocean: {
        companySize: oceanData.companySize,
        revenue: oceanData.revenue,
        yearFounded: oceanData.yearFounded,
        industries: oceanData.industries,
        technologies: oceanData.technologies,
        departmentSizes: oceanData.departmentSizes,
        webTraffic: oceanData.webTraffic,
        locations: oceanData.locations,
        keywords: oceanData.keywords,
      },
    };

    const location = oceanData.locations?.find((l: any) => l.primary)
      ? [
          oceanData.locations.find((l: any) => l.primary)?.locality,
          oceanData.locations.find((l: any) => l.primary)?.region,
          oceanData.locations.find((l: any) => l.primary)?.country?.toUpperCase(),
        ].filter(Boolean).join(', ')
      : null;

    if (existing) {
      await supabase
        .from('companies')
        .update({
          name: oceanData.companyName || undefined,
          description: oceanData.description || undefined,
          logo_url: oceanData.logo || undefined,
          location: location || undefined,
          enrichment_data: enrichment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      await linkSessionToCompany(sessionId, existing.id);
      console.log(`[companyBrain] Ocean synced to existing company=${existing.id}`);
      return existing.id;
    }

    // Create new company
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        name: oceanData.companyName || domain,
        domain,
        description: oceanData.description || null,
        logo_url: oceanData.logo || null,
        industry: oceanData.industries?.[0] || null,
        employee_count: oceanData.companySize || null,
        annual_revenue: oceanData.revenue || null,
        location,
        enrichment_data: enrichment,
        status: 'prospect',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[companyBrain] Failed to create company from Ocean:', error);
      return null;
    }

    await linkSessionToCompany(sessionId, newCompany.id);
    console.log(`[companyBrain] Ocean created new company=${newCompany.id}`);
    return newCompany.id;
  } catch (err) {
    console.error('[companyBrain] Ocean sync failed:', err);
    return null;
  }
}

// ============================================================
// HubSpot Sync
// ============================================================

type HubSpotCompany = {
  id: string;
  name?: string;
  domain?: string;
  industry?: string;
  numberofemployees?: string;
  annualrevenue?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  website?: string;
  description?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  [key: string]: any;
};

type HubSpotContact = {
  id: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobilephone?: string;
  jobtitle?: string;
  company?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  [key: string]: any;
};

type HubSpotDeal = {
  id: string;
  dealname?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
  createdate?: string;
  hubspot_owner_id?: string;
  deal_currency_code?: string;
  [key: string]: any;
};

type HubSpotEngagement = {
  id: string;
  type?: string;
  hs_timestamp?: string;
  hs_createdate?: string;
  hs_note_body?: string;
  hs_call_body?: string;
  hs_email_subject?: string;
  hs_email_text?: string;
  hs_meeting_title?: string;
  hs_task_subject?: string;
  hs_call_direction?: string;
  hs_email_direction?: string;
  [key: string]: any;
};

type HubSpotData = {
  success: boolean;
  companies?: HubSpotCompany[];
  contacts?: HubSpotContact[];
  deals?: HubSpotDeal[];
  engagements?: HubSpotEngagement[];
};

/**
 * Sync HubSpot data to company brain tables.
 * Call this after hubspot_data lands on a crawl_session.
 */
export async function syncHubSpotToCompanyBrain(
  hubspotData: HubSpotData,
  sessionId: string,
  sessionDomain: string
): Promise<{ companyId: string | null; contactIds: string[]; dealIds: string[]; engagementIds: string[] }> {
  if (!hubspotData.success) {
    return { companyId: null, contactIds: [], dealIds: [], engagementIds: [] };
  }

  try {
    // 1. Upsert company from HubSpot company data
    const hsCompany = hubspotData.companies?.[0];
    const companyId = await upsertCompanyFromHubSpot(hsCompany, sessionDomain);

    // 2. Link session to company
    if (companyId) {
      await linkSessionToCompany(sessionId, companyId);
    }

    // 3. Upsert contacts
    const contactIds: string[] = [];
    const contactIdMap = new Map<string, string>(); // hubspot_id -> local_id
    for (const hsContact of (hubspotData.contacts || []).slice(0, 50)) {
      const contactId = await upsertContactFromHubSpot(hsContact, companyId);
      if (contactId) {
        contactIds.push(contactId);
        contactIdMap.set(hsContact.id, contactId);
      }
    }

    // 4. Upsert deals
    const dealIds: string[] = [];
    for (const hsDeal of (hubspotData.deals || []).slice(0, 20)) {
      const dealId = await upsertDealFromHubSpot(hsDeal, companyId);
      if (dealId) dealIds.push(dealId);
    }

    // 5. Upsert engagements (cap at 50 most recent)
    const engagementIds: string[] = [];
    const sortedEngagements = [...(hubspotData.engagements || [])]
      .sort((a, b) => {
        const aTime = a.hs_timestamp || a.hs_createdate || '';
        const bTime = b.hs_timestamp || b.hs_createdate || '';
        return bTime.localeCompare(aTime);
      })
      .slice(0, 50);

    for (const hsEng of sortedEngagements) {
      const engId = await upsertEngagementFromHubSpot(hsEng, companyId);
      if (engId) engagementIds.push(engId);
    }

    console.log(`[companyBrain] HubSpot synced: company=${companyId}, contacts=${contactIds.length}, deals=${dealIds.length}, engagements=${engagementIds.length}`);
    return { companyId, contactIds, dealIds, engagementIds };
  } catch (err) {
    console.error('[companyBrain] HubSpot sync failed:', err);
    return { companyId: null, contactIds: [], dealIds: [], engagementIds: [] };
  }
}

async function upsertCompanyFromHubSpot(
  hsCompany: HubSpotCompany | undefined,
  sessionDomain: string
): Promise<string | null> {
  const domain = hsCompany?.domain || sessionDomain;
  if (!domain) return null;

  const name = hsCompany?.name || domain;
  const location = [hsCompany?.city, hsCompany?.state, hsCompany?.country].filter(Boolean).join(', ') || null;

  // Check if company exists
  const { data: existing } = await supabase
    .from('companies')
    .select('id, enrichment_data')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) {
    const enrichment = {
      ...(typeof existing.enrichment_data === 'object' && existing.enrichment_data !== null
        ? existing.enrichment_data
        : {}),
      hubspot_company: hsCompany || {},
    };

    await supabase
      .from('companies')
      .update({
        name: hsCompany?.name || undefined,
        industry: hsCompany?.industry?.toLowerCase().replace(/_/g, ' ') || undefined,
        employee_count: hsCompany?.numberofemployees || undefined,
        annual_revenue: hsCompany?.annualrevenue || undefined,
        location: location || undefined,
        description: hsCompany?.description || undefined,
        website_url: hsCompany?.website ? `https://${hsCompany.website}` : undefined,
        hubspot_company_id: hsCompany?.id || undefined,
        enrichment_data: enrichment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return existing.id;
  }

  // Create new
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name,
      domain,
      industry: hsCompany?.industry?.toLowerCase().replace(/_/g, ' ') || null,
      employee_count: hsCompany?.numberofemployees || null,
      annual_revenue: hsCompany?.annualrevenue || null,
      location,
      description: hsCompany?.description || null,
      website_url: hsCompany?.website ? `https://${hsCompany.website}` : null,
      hubspot_company_id: hsCompany?.id || null,
      enrichment_data: { hubspot_company: hsCompany || {} },
      status: 'prospect',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create company from HubSpot:', error);
    return null;
  }
  return newCompany.id;
}

async function upsertContactFromHubSpot(
  hsContact: HubSpotContact,
  companyId: string | null
): Promise<string | null> {
  if (!hsContact.email) return null;

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', hsContact.email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('contacts')
      .update({
        first_name: hsContact.firstname || undefined,
        last_name: hsContact.lastname || undefined,
        phone: hsContact.phone || hsContact.mobilephone || undefined,
        title: hsContact.jobtitle || undefined,
        company_id: companyId || undefined,
        hubspot_contact_id: hsContact.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      company_id: companyId,
      first_name: hsContact.firstname || null,
      last_name: hsContact.lastname || null,
      email: hsContact.email,
      phone: hsContact.phone || hsContact.mobilephone || null,
      title: hsContact.jobtitle || null,
      hubspot_contact_id: hsContact.id,
      is_primary: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create contact from HubSpot:', error);
    return null;
  }
  return newContact.id;
}

async function upsertDealFromHubSpot(
  hsDeal: HubSpotDeal,
  companyId: string | null
): Promise<string | null> {
  if (!hsDeal.dealname) return null;

  const { data: existing } = await supabase
    .from('deals')
    .select('id')
    .eq('hubspot_deal_id', hsDeal.id)
    .maybeSingle();

  const dealData = {
    company_id: companyId,
    hubspot_deal_id: hsDeal.id,
    name: hsDeal.dealname,
    amount: hsDeal.amount ? parseFloat(hsDeal.amount) : null,
    stage: hsDeal.dealstage || null,
    pipeline: hsDeal.pipeline || null,
    close_date: hsDeal.closedate ? hsDeal.closedate.split('T')[0] : null,
    properties: {
      hubspot_owner_id: hsDeal.hubspot_owner_id,
      deal_currency_code: hsDeal.deal_currency_code,
      createdate: hsDeal.createdate,
    },
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('deals').update(dealData).eq('id', existing.id);
    return existing.id;
  }

  const { data: newDeal, error } = await supabase
    .from('deals')
    .insert({ ...dealData, status: 'open' })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create deal from HubSpot:', error);
    return null;
  }
  return newDeal.id;
}

async function upsertEngagementFromHubSpot(
  hsEng: HubSpotEngagement,
  companyId: string | null
): Promise<string | null> {
  // Map HubSpot type to our enum
  const typeMap: Record<string, string> = {
    notes: 'note', note: 'note',
    emails: 'email', email: 'email',
    calls: 'call', call: 'call',
    meetings: 'meeting', meeting: 'meeting',
    tasks: 'task', task: 'task',
  };
  const engType = typeMap[hsEng.type || ''] || 'note';

  // Extract subject/body based on type
  let subject = '';
  let bodyPreview = '';
  let direction: string | null = null;

  switch (engType) {
    case 'email':
      subject = hsEng.hs_email_subject || '';
      bodyPreview = (hsEng.hs_email_text || '').slice(0, 500);
      direction = hsEng.hs_email_direction === 'INCOMING_EMAIL' ? 'inbound' : 'outbound';
      break;
    case 'call':
      subject = 'Call';
      bodyPreview = (hsEng.hs_call_body || '').slice(0, 500);
      direction = hsEng.hs_call_direction === 'INBOUND' ? 'inbound' : 'outbound';
      break;
    case 'meeting':
      subject = hsEng.hs_meeting_title || 'Meeting';
      break;
    case 'task':
      subject = hsEng.hs_task_subject || 'Task';
      break;
    case 'note':
      subject = 'Note';
      // Strip HTML tags for preview
      bodyPreview = (hsEng.hs_note_body || '').replace(/<[^>]*>/g, '').slice(0, 500);
      break;
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from('engagements')
    .select('id')
    .eq('hubspot_engagement_id', hsEng.id)
    .maybeSingle();

  if (existing) return existing.id; // Don't update engagements, they're immutable

  const { data: newEng, error } = await supabase
    .from('engagements')
    .insert({
      company_id: companyId,
      engagement_type: engType as any,
      hubspot_engagement_id: hsEng.id,
      subject,
      body_preview: bodyPreview || null,
      direction: direction as any,
      occurred_at: hsEng.hs_timestamp || hsEng.hs_createdate || null,
      metadata: { raw_type: hsEng.type },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[companyBrain] Failed to create engagement:', error);
    return null;
  }
  return newEng.id;
}
