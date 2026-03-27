import { supabase } from '@/integrations/supabase/client';

const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingest`;

/** Map of integration data keys to human-readable document names */
const INTEGRATION_DOC_NAMES: Record<string, string> = {
  semrush_data: 'SEMrush Domain Analysis',
  psi_data: 'PageSpeed Insights',
  crux_data: 'Chrome UX Report (CrUX)',
  builtwith_data: 'BuiltWith Technology Profile',
  wappalyzer_data: 'Wappalyzer Technology Detection',
  detectzestack_data: 'DetectZeStack Analysis',
  tech_analysis_data: 'Technology Analysis',
  wave_data: 'WAVE Accessibility Scan',
  observatory_data: 'Mozilla Observatory',
  ssllabs_data: 'SSL Labs Security Scan',
  httpstatus_data: 'HTTP Status & Redirects',
  linkcheck_data: 'Broken Links Report',
  w3c_data: 'W3C HTML Validation',
  schema_data: 'Schema.org Validation',
  readable_data: 'Readability Analysis',
  carbon_data: 'Website Carbon Footprint',
  yellowlab_data: 'Yellow Lab Tools',
  ocean_data: 'Ocean.io Company Data',
  apollo_data: 'Apollo Contact Data',
  apollo_team_data: 'Apollo Team Discovery',
  nav_structure: 'Site Navigation Structure',
  content_types_data: 'Content Types Analysis',
  sitemap_data: 'Sitemap Analysis',
  forms_data: 'Forms Detection',
  deep_research_data: 'Deep Research Report',
  observations_data: 'Observations & Insights',
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  emails: 'Email',
  calls: 'Call',
  meetings: 'Meeting',
  notes: 'Note',
  tasks: 'Task',
};

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
}

function formatEngagementDoc(eng: any): { title: string; content: string } {
  const type = eng.type || 'activity';
  const label = ENGAGEMENT_LABELS[type] || 'Activity';
  let title = '';
  const parts: string[] = [];

  switch (type) {
    case 'emails':
      title = eng.hs_email_subject || 'No subject';
      if (eng.hs_email_direction) parts.push(`Direction: ${eng.hs_email_direction === 'INCOMING_EMAIL' ? 'Received' : 'Sent'}`);
      if (eng.hs_email_sender_email) parts.push(`From: ${eng.hs_email_sender_email}`);
      if (eng.hs_email_to_email) parts.push(`To: ${eng.hs_email_to_email}`);
      if (eng.hs_email_text) parts.push(`\n${stripHtml(eng.hs_email_text)}`);
      break;
    case 'calls':
      title = eng.hs_call_title || 'Phone call';
      if (eng.hs_call_direction) parts.push(`Direction: ${eng.hs_call_direction === 'INBOUND' ? 'Inbound' : 'Outbound'}`);
      if (eng.hs_call_duration) parts.push(`Duration: ${Math.round(Number(eng.hs_call_duration) / 1000)}s`);
      if (eng.hs_call_body) parts.push(`\n${stripHtml(eng.hs_call_body)}`);
      break;
    case 'meetings':
      title = eng.hs_meeting_title || 'Meeting';
      if (eng.hs_meeting_start_time) parts.push(`Start: ${new Date(eng.hs_meeting_start_time).toLocaleString()}`);
      if (eng.hs_meeting_end_time) parts.push(`End: ${new Date(eng.hs_meeting_end_time).toLocaleString()}`);
      if (eng.hs_meeting_outcome) parts.push(`Outcome: ${eng.hs_meeting_outcome}`);
      if (eng.hs_meeting_body) parts.push(`\n${stripHtml(eng.hs_meeting_body)}`);
      break;
    case 'notes':
      title = stripHtml(eng.hs_note_body || '').substring(0, 60) || 'Note';
      if (eng.hs_note_body) parts.push(stripHtml(eng.hs_note_body));
      break;
    case 'tasks':
      title = eng.hs_task_subject || 'Task';
      if (eng.hs_task_body) parts.push(stripHtml(eng.hs_task_body));
      break;
    default:
      title = 'Activity';
      parts.push(JSON.stringify(eng, null, 2));
  }

  if (eng.hs_timestamp) parts.unshift(`Date: ${new Date(Number(eng.hs_timestamp)).toLocaleString()}`);

  return {
    title: `HubSpot ${label}: ${title}`,
    content: parts.join('\n'),
  };
}

/** Expand HubSpot data into per-activity documents + a contacts/deals summary */
function expandHubSpotDocs(
  hubspotData: any
): { name: string; content: string; source_key: string }[] {
  const docs: { name: string; content: string; source_key: string }[] = [];

  // Contacts + Deals + Company as one summary doc
  const summaryParts: string[] = [];
  if (hubspotData.contacts?.length) {
    summaryParts.push('## Contacts\n' + JSON.stringify(hubspotData.contacts, null, 2));
  }
  if (hubspotData.deals?.length) {
    summaryParts.push('## Deals\n' + JSON.stringify(hubspotData.deals, null, 2));
  }
  if (hubspotData.company) {
    summaryParts.push('## Company\n' + JSON.stringify(hubspotData.company, null, 2));
  }
  if (hubspotData.formSubmissions?.length) {
    summaryParts.push('## Form Submissions\n' + JSON.stringify(hubspotData.formSubmissions, null, 2));
  }
  if (summaryParts.length > 0) {
    docs.push({
      name: 'HubSpot CRM Summary',
      content: summaryParts.join('\n\n'),
      source_key: 'hubspot_data:summary',
    });
  }

  // Individual engagement documents
  const engagements = hubspotData.engagements || [];
  for (let i = 0; i < engagements.length; i++) {
    const eng = engagements[i];
    const { title, content } = formatEngagementDoc(eng);
    if (content.length < 20) continue;
    docs.push({
      name: title,
      content,
      source_key: `hubspot_data:engagement:${eng.hs_object_id || eng.id || i}`,
    });
  }

  return docs;
}

/** Expand Avoma data into per-meeting documents */
function expandAvomaDocs(
  avomaData: any
): { name: string; content: string; source_key: string }[] {
  const docs: { name: string; content: string; source_key: string }[] = [];
  const meetings = avomaData.meetings || [];

  for (const meeting of meetings) {
    const parts: string[] = [];
    const subject = meeting.subject || 'Untitled Meeting';

    // Meeting metadata
    if (meeting.startTime) parts.push(`Date: ${new Date(meeting.startTime).toLocaleString()}`);
    if (meeting.endTime) parts.push(`End: ${new Date(meeting.endTime).toLocaleString()}`);
    if (meeting.purpose) parts.push(`Purpose: ${meeting.purpose}`);
    if (meeting.outcome) parts.push(`Outcome: ${meeting.outcome}`);

    // Attendees
    if (meeting.attendees?.length) {
      const attendeeList = meeting.attendees.map((a: any) =>
        `${a.name || 'Unknown'}${a.email ? ` <${a.email}>` : ''}${a.is_rep ? ' (Rep)' : ''}`
      ).join(', ');
      parts.push(`Attendees: ${attendeeList}`);
    }

    // AI Notes
    if (meeting.insights?.aiNotes?.length) {
      parts.push('\n## AI Notes');
      for (const note of meeting.insights.aiNotes) {
        const label = note.noteType ? `[${note.noteType}] ` : '';
        parts.push(`- ${label}${note.text}`);
      }
    }

    // Keywords
    if (meeting.insights?.keywords?.length) {
      const kws = meeting.insights.keywords.map((k: any) => `${k.word} (${k.count})`).join(', ');
      parts.push(`\n## Keywords\n${kws}`);
    }

    // Speakers
    if (meeting.insights?.speakers?.length) {
      const speakers = meeting.insights.speakers.map((s: any) =>
        `${s.name}${s.email ? ` <${s.email}>` : ''}${s.is_rep ? ' (Rep)' : ''}`
      ).join(', ');
      parts.push(`\n## Speakers\n${speakers}`);
    }

    // Transcript
    if (meeting.transcript?.sentences?.length) {
      parts.push('\n## Transcript');
      for (const s of meeting.transcript.sentences) {
        parts.push(`[${s.speakerName || 'Unknown'}]: ${s.text}`);
      }
    }

    const content = parts.join('\n');
    if (content.length < 30) continue;

    docs.push({
      name: `Avoma Meeting: ${subject}`,
      content,
      source_key: `avoma_data:meeting:${meeting.uuid || meeting.id || meetings.indexOf(meeting)}`,
    });
  }

  return docs;
}

/** Format Apollo team discovery data as a readable markdown document */
function formatApolloTeamDoc(teamData: any): string {
  const parts: string[] = ['# Apollo Team Discovery'];
  if (teamData.domain) parts.push(`**Domain:** ${teamData.domain}`);
  parts.push(`**Total Contacts Found:** ${teamData.totalFound || 0}`);

  function formatContact(c: any): string {
    const lines: string[] = [];
    lines.push(`### ${c.name || 'Unknown'}`);
    if (c.title) lines.push(`**Title:** ${c.title}`);
    if (c.headline) lines.push(`**Headline:** ${c.headline}`);
    if (c.email) lines.push(`**Email:** ${c.email}`);
    if (c.seniority) lines.push(`**Seniority:** ${c.seniority}`);
    const location = [c.city, c.state, c.country].filter(Boolean).join(', ');
    if (location) lines.push(`**Location:** ${location}`);
    if (c.linkedinUrl) lines.push(`**LinkedIn:** ${c.linkedinUrl}`);
    if (c.organizationName) lines.push(`**Organization:** ${c.organizationName}`);

    if (c.employmentHistory?.length) {
      lines.push('\n**Employment History:**');
      for (const eh of c.employmentHistory) {
        if (eh.kind === 'education') {
          lines.push(`- 🎓 ${eh.organizationName || ''}${eh.degree ? ` — ${eh.degree}` : ''}`);
        } else {
          const dates = [eh.startDate, eh.endDate || (eh.current ? 'Present' : '')].filter(Boolean).join(' – ');
          lines.push(`- ${eh.title || 'Role'} at ${eh.organizationName || 'Unknown'}${dates ? ` (${dates})` : ''}`);
        }
      }
    }
    return lines.join('\n');
  }

  if (teamData.c_suite?.length) {
    parts.push('\n## C-Suite & Leadership');
    for (const c of teamData.c_suite) parts.push(formatContact(c));
  }
  if (teamData.marketing?.length) {
    parts.push('\n## Marketing Team');
    for (const c of teamData.marketing) parts.push(formatContact(c));
  }

  return parts.join('\n');
}

/**
 * Check which integrations have data but haven't been ingested yet,
 * and send them to the RAG ingest pipeline.
 */
export async function autoIngestIntegrations(
  sessionId: string,
  sessionData: Record<string, any>
): Promise<{ ingested: number; skipped: number }> {
  // Get already-ingested source keys with their creation timestamps
  const { data: existing } = await supabase
    .from('knowledge_documents')
    .select('source_key, created_at')
    .eq('session_id', sessionId)
    .eq('source_type', 'integration');

  const existingMap = new Map<string, string>();
  for (const d of (existing || []) as any[]) {
    if (d.source_key) existingMap.set(d.source_key, d.created_at);
  }

  // Integration timestamps tell us when each integration last ran
  const integrationTimestamps: Record<string, string> = sessionData.integration_timestamps || {};

  // Collect documents to ingest (new or updated since last indexed)
  const docsToIngest: { name: string; content: string; source_type: string; source_key: string }[] = [];

  for (const [key, docName] of Object.entries(INTEGRATION_DOC_NAMES)) {
    const data = sessionData[key];
    if (!data) continue;
    if (typeof data === 'object' && data._error) continue;

    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    if (content.length < 50) continue;

    const existingCreatedAt = existingMap.get(key);
    if (existingCreatedAt) {
      const integrationRanAt = integrationTimestamps[key];
      if (!integrationRanAt || new Date(integrationRanAt) <= new Date(existingCreatedAt)) {
        continue;
      }
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('session_id', sessionId)
        .eq('source_key', key)
        .eq('source_type', 'integration');
    }

    docsToIngest.push({
      name: docName,
      content,
      source_type: 'integration',
      source_key: key,
    });
  }

  // HubSpot: expand into per-activity documents
  const hubspotData = sessionData.hubspot_data;
  if (hubspotData && typeof hubspotData === 'object' && !hubspotData._error) {
    const hubspotTimestamp = integrationTimestamps.hubspot_data;
    // Check if any hubspot doc already exists and is up-to-date
    const hubspotExisting = existingMap.get('hubspot_data:summary');
    const needsReIngest = !hubspotExisting || (hubspotTimestamp && new Date(hubspotTimestamp) > new Date(hubspotExisting));

    if (needsReIngest) {
      // Delete all old hubspot docs (summary + individual engagements)
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('session_id', sessionId)
        .eq('source_type', 'integration')
        .like('source_key', 'hubspot_data:%');

      // Also delete the legacy single-blob hubspot doc
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('session_id', sessionId)
        .eq('source_type', 'integration')
        .eq('source_key', 'hubspot_data');

      const expandedDocs = expandHubSpotDocs(hubspotData);
      for (const doc of expandedDocs) {
        docsToIngest.push({
          name: doc.name,
          content: doc.content,
          source_type: 'integration',
          source_key: doc.source_key,
        });
      }
    }
  }

  // Avoma: expand into per-meeting documents
  const avomaData = sessionData.avoma_data;
  if (avomaData && typeof avomaData === 'object' && !avomaData._error) {
    const avomaTimestamp = integrationTimestamps.avoma_data;
    // Check if expanded docs exist; if only the legacy blob exists, re-ingest to expand
    const hasExpandedDocs = Array.from(existingMap.keys()).some(k => k.startsWith('avoma_data:'));
    const avomaLegacy = existingMap.get('avoma_data');
    const needsReIngest = !hasExpandedDocs || (avomaLegacy && !hasExpandedDocs) || (avomaTimestamp && hasExpandedDocs && new Date(avomaTimestamp) > new Date(existingMap.get('avoma_data:meeting:0') || '0'));

    if (needsReIngest) {
      // Delete all old avoma docs
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('session_id', sessionId)
        .eq('source_type', 'integration')
        .like('source_key', 'avoma_data:%');

      // Delete legacy single-blob avoma doc
      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('session_id', sessionId)
        .eq('source_type', 'integration')
        .eq('source_key', 'avoma_data');

      const expandedDocs = expandAvomaDocs(avomaData);
      for (const doc of expandedDocs) {
        docsToIngest.push({
          name: doc.name,
          content: doc.content,
          source_type: 'integration',
          source_key: doc.source_key,
        });
      }
    }
  }

  if (docsToIngest.length === 0) {
    return { ingested: 0, skipped: existingMap.size };
  }

  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
    });

    if (!response.ok) {
      console.error('Auto-ingest failed:', await response.text());
      return { ingested: 0, skipped: existingMap.size };
    }

    const result = await response.json();
    const readyCount = result.results?.filter((r: any) => r.status === 'ready').length || 0;
    console.log(`[auto-ingest] Ingested ${readyCount} integration documents for session ${sessionId}`);
    return { ingested: readyCount, skipped: existingMap.size };
  } catch (err) {
    console.error('Auto-ingest error:', err);
    return { ingested: 0, skipped: existingMap.size };
  }
}

/**
 * Ingest scraped page content into RAG
 */
export async function autoIngestPages(
  sessionId: string,
  pages: { url: string; title: string | null; ai_outline: string | null; raw_content: string | null }[]
): Promise<number> {
  // Get already-ingested scrape docs
  const { data: existing } = await supabase
    .from('knowledge_documents')
    .select('name')
    .eq('session_id', sessionId)
    .eq('source_type', 'scrape');

  const existingNames = new Set((existing || []).map((d: any) => d.name));

  const docsToIngest: { name: string; content: string; source_type: string; source_key: string }[] = [];

  for (const page of pages) {
    const content = page.ai_outline || page.raw_content;
    if (!content || content.length < 50) continue;

    const docName = `Page: ${page.title || page.url}`;
    if (existingNames.has(docName)) continue;

    docsToIngest.push({
      name: docName,
      content,
      source_type: 'scrape',
      source_key: page.url,
    });
  }

  if (docsToIngest.length === 0) return 0;

  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
    });

    if (!response.ok) return 0;
    const result = await response.json();
    return result.results?.filter((r: any) => r.status === 'ready').length || 0;
  } catch {
    return 0;
  }
}

/**
 * Ingest chat-uploaded files into RAG so they appear in the Document Library.
 */
export async function ingestChatUploads(
  sessionId: string,
  files: { name: string; content: string; type: 'text' | 'image' | 'document' }[]
): Promise<number> {
  const textFiles = files.filter(f => (f.type === 'text' || f.type === 'document') && f.content.length >= 50);
  if (textFiles.length === 0) return 0;

  const docsToIngest = textFiles.map(f => ({
    name: `Upload: ${f.name}`,
    content: f.content,
    source_type: 'upload',
    source_key: `chat-upload:${f.name}:${Date.now()}`,
  }));

  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ session_id: sessionId, documents: docsToIngest }),
    });

    if (!response.ok) return 0;
    const result = await response.json();
    return result.results?.filter((r: any) => r.status === 'ready').length || 0;
  } catch {
    return 0;
  }
}

/**
 * Ingest the current chat conversation as a single document into RAG.
 * Re-ingests (replaces) on every AI response so the document stays current.
 */
export async function ingestChatConversation(
  sessionId: string,
  messages: { role: string; content: string }[]
): Promise<void> {
  // Need at least one exchange (user + assistant)
  const meaningful = messages.filter(m => m.content && m.content.length > 20);
  if (meaningful.length < 2) return;

  const SOURCE_KEY = 'chat-conversation';
  const docName = 'AI Chat Conversation';

  // Format messages into a readable document
  const content = meaningful
    .map(m => `**${m.role === 'user' ? 'User' : 'Assistant'}:**\n${m.content}`)
    .join('\n\n---\n\n');

  if (content.length < 100) return;

  // Delete existing chat conversation document so we replace it
  const { error: delError } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('session_id', sessionId)
    .eq('source_key', SOURCE_KEY)
    .eq('source_type', 'chat');

  if (delError) {
    console.error('[chat-ingest] Delete failed:', delError);
  }

  // Small delay to ensure delete propagates before insert
  await new Promise(r => setTimeout(r, 300));

  try {
    const response = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        documents: [{
          name: docName,
          content,
          source_type: 'chat',
          source_key: SOURCE_KEY,
          skip_dedup: true,
        }],
      }),
    });

    if (!response.ok) {
      console.error('[chat-ingest] Failed:', await response.text());
      return;
    }
    const result = await response.json();
    console.log(`[chat-ingest] Ingested chat conversation: ${result.results?.[0]?.chunks || 0} chunks`);
  } catch (err) {
    console.error('[chat-ingest] Error:', err);
  }
}

const CAPTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caption-screenshots`;

/**
 * Auto-ingest screenshots into RAG by AI-captioning each image one-by-one
 * and indexing the descriptions as knowledge documents.
 */
export async function autoIngestScreenshots(sessionId: string): Promise<number> {
  // Fetch completed screenshots for this session
  const { data: screenshots, error } = await supabase
    .from('crawl_screenshots')
    .select('url, screenshot_url')
    .eq('session_id', sessionId)
    .eq('status', 'done')
    .not('screenshot_url', 'is', null);

  if (error || !screenshots?.length) return 0;

  // Check which screenshots are already ingested
  const { data: existing } = await supabase
    .from('knowledge_documents')
    .select('source_key')
    .eq('session_id', sessionId)
    .eq('source_type', 'screenshot');

  const existingKeys = new Set((existing || []).map((d: any) => d.source_key));
  const newScreenshots = screenshots.filter(s => !existingKeys.has(`screenshot:${s.url}`));
  if (newScreenshots.length === 0) return 0;

  console.log(`[screenshot-ingest] Captioning ${newScreenshots.length} new screenshots (one at a time)`);

  let ingestedCount = 0;

  for (let i = 0; i < newScreenshots.length; i++) {
    const screenshot = newScreenshots[i];
    try {
      // Rate-limit: wait 3s between calls (skip first)
      if (i > 0) await new Promise(r => setTimeout(r, 3000));

      // Caption one screenshot at a time
      const captionRes = await fetch(CAPTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          screenshot_url: screenshot.screenshot_url,
          page_url: screenshot.url,
        }),
      });

      if (!captionRes.ok) {
        console.error(`[screenshot-ingest] Caption failed for ${screenshot.url}:`, await captionRes.text());
        continue;
      }

      const { caption } = await captionRes.json();
      if (!caption) {
        console.warn(`[screenshot-ingest] No caption returned for ${screenshot.url}`);
        continue;
      }

      // Build the document name
      let urlPath: string;
      try {
        urlPath = new URL(screenshot.url).pathname || '/';
      } catch {
        urlPath = screenshot.url;
      }
      const docName = `📸 Screenshot: ${urlPath === '/' ? screenshot.url.replace(/^https?:\/\//, '') : urlPath}`;

      // Ingest the caption as a knowledge document
      const ingestRes = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          documents: [{
            name: docName,
            content: `# Screenshot Analysis: ${screenshot.url}\n\n${caption}`,
            source_type: 'screenshot',
            source_key: `screenshot:${screenshot.url}`,
          }],
        }),
      });

      if (ingestRes.ok) {
        const result = await ingestRes.json();
        if (result.results?.[0]?.status === 'ready') {
          ingestedCount++;
          console.log(`[screenshot-ingest] ✓ (${ingestedCount}/${newScreenshots.length}) ${docName}`);
        }
      }
    } catch (err) {
      console.error(`[screenshot-ingest] Error processing ${screenshot.url}:`, err);
    }
  }

  console.log(`[screenshot-ingest] Done: ${ingestedCount}/${newScreenshots.length} screenshots indexed`);
  return ingestedCount;
}
