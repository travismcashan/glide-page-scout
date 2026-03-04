import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'paused-integrations';

// Local cache for immediate UI reads
let cache: Set<string> | null = null;

export function getPausedIntegrations(): Set<string> {
  if (cache) return new Set(cache);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function isIntegrationPaused(name: string): boolean {
  return getPausedIntegrations().has(name);
}

/** Load paused state from database, sync to localStorage cache */
export async function loadPausedIntegrations(): Promise<Set<string>> {
  const { data } = await supabase
    .from('integration_settings')
    .select('id, paused');

  const paused = new Set<string>();
  if (data) {
    for (const row of data) {
      if (row.paused) paused.add(row.id);
    }
  }
  cache = paused;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(paused)));
  return paused;
}

/** Toggle pause state in database and return new paused value */
export async function toggleIntegrationPause(name: string): Promise<boolean> {
  const current = getPausedIntegrations();
  const newPaused = !current.has(name);

  // Upsert to database
  await supabase
    .from('integration_settings')
    .upsert({ id: name, paused: newPaused, updated_at: new Date().toISOString() }, { onConflict: 'id' });

  // Update local cache
  if (newPaused) {
    current.add(name);
  } else {
    current.delete(name);
  }
  cache = current;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
  return newPaused;
}
