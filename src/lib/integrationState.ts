const STORAGE_KEY = 'paused-integrations';

export function getPausedIntegrations(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleIntegrationPause(name: string): boolean {
  const paused = getPausedIntegrations();
  if (paused.has(name)) {
    paused.delete(name);
  } else {
    paused.add(name);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(paused)));
  return paused.has(name);
}

export function isIntegrationPaused(name: string): boolean {
  return getPausedIntegrations().has(name);
}
