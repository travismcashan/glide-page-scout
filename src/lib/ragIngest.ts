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
  avoma_data: 'Avoma Transcript',
  apollo_data: 'Apollo Contact Data',
  hubspot_data: 'HubSpot CRM Data',
  nav_structure: 'Site Navigation Structure',
  content_types_data: 'Content Types Analysis',
  sitemap_data: 'Sitemap Analysis',
  forms_data: 'Forms Detection',
  deep_research_data: 'Deep Research Report',
  observations_data: 'Observations & Insights',
};

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
      // Only re-ingest if the integration ran after the document was indexed
      const integrationRanAt = integrationTimestamps[key];
      if (!integrationRanAt || new Date(integrationRanAt) <= new Date(existingCreatedAt)) {
        continue; // Already up-to-date
      }
      // Delete the stale document so re-ingest replaces it
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
  await supabase
    .from('knowledge_documents')
    .delete()
    .eq('session_id', sessionId)
    .eq('source_key', SOURCE_KEY)
    .eq('source_type', 'chat');

  // Also delete orphaned chunks
  // (cascade should handle this, but be safe)

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
