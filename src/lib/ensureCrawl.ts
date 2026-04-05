import { supabase } from '@/integrations/supabase/client';

/**
 * Find or create a crawl session for a domain.
 * If a crawl exists, returns it. If not, creates one and fires crawl-start.
 */
export async function ensureCrawl(
  domain: string,
  companyId?: string | null
): Promise<{ sessionId: string; domain: string; createdAt: string; created: boolean }> {
  const normalized = domain.toLowerCase().replace(/^www\./, '');

  // Check for existing crawl
  const { data: existing } = await supabase
    .from('crawl_sessions')
    .select('id, domain, created_at')
    .eq('domain', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { sessionId: existing.id, domain: existing.domain, createdAt: existing.created_at, created: false };
  }

  // Create new crawl session
  const { data: session, error } = await supabase
    .from('crawl_sessions')
    .insert({
      domain: normalized,
      base_url: `https://${normalized}`,
      status: 'analyzing',
      company_id: companyId || null,
    } as any)
    .select('id, domain, created_at')
    .single();

  if (error || !session) {
    throw new Error(`Failed to create crawl session: ${error?.message}`);
  }

  // Fire crawl orchestrator (async, don't await)
  supabase.functions.invoke('crawl-start', {
    body: { session_id: session.id },
  }).catch(err => console.error('[ensureCrawl] crawl-start error:', err));

  return { sessionId: session.id, domain: session.domain, createdAt: session.created_at, created: true };
}
